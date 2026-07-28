import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_RESOLVERS, RUN_ITEM_STATUSES, RUN_STATUSES, RUN_TRIGGERS } from "../types";

function read(path: string) {
  // CRLF on Windows, LF on CI. A pattern containing "\n" matches nothing on one
  // of the two, and the guard then passes for a reason unrelated to the SQL.
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const automation = read("supabase/migrations/20260866000000_eki_automated_evaluation.sql");
const actorRole = read("supabase/migrations/20260867000000_governance_audit_actor_role_none.sql");
const acceptance = read("supabase/tests/eki_macrophase3_acceptance.sql");

function code(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*/, ""))
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function extract(functionName: string, source: string): string {
  const start = source.indexOf(`create or replace function public.${functionName}`);
  if (start < 0) return "";
  const end = source.indexOf("\n$$;", start);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

describe("vocabulary drift — automation", () => {
  const cases: Array<[string, readonly string[]]> = [
    ["trigger_type", RUN_TRIGGERS],
    ["status", RUN_STATUSES],
    ["resolver_key", EVIDENCE_RESOLVERS],
  ];

  it("run trigger vocabulary matches the migration", () => {
    const match = automation.match(/trigger_type text not null check \(trigger_type in \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const inDatabase = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(inDatabase).toEqual([...RUN_TRIGGERS].sort());
  });

  it("run status vocabulary matches the migration", () => {
    const match = automation.match(/status text not null default 'running'\s*\n?\s*check \(status in \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const inDatabase = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(inDatabase).toEqual([...RUN_STATUSES].sort());
  });

  it("run item status vocabulary matches the migration", () => {
    const match = automation.match(/status text not null default 'claimed'\s*\n?\s*check \(status in \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const inDatabase = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(inDatabase).toEqual([...RUN_ITEM_STATUSES].sort());
  });

  it("the resolver vocabulary is widened by exactly one and stays closed", () => {
    const match = automation.match(/check \(resolver_key in \(([^)]*)\)\)/);
    expect(match).not.toBeNull();
    const inDatabase = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(inDatabase).toEqual(["governance_audit_activity", "privileged_access_activity"]);
    expect(cases.length).toBeGreaterThan(0);
  });
});

describe("claiming and concurrency", () => {
  /**
   * The whole mechanism. Without SKIP LOCKED a second worker blocks behind the
   * first instead of taking disjoint work, and two schedulers serialise into one.
   */
  it("claims with FOR UPDATE ... SKIP LOCKED", () => {
    const claim = code(extract("eki_claim_due_bindings", automation));
    expect(claim).toMatch(/for update of b skip locked/);
  });

  it("claims in a deterministic order", () => {
    const claim = code(extract("eki_claim_due_bindings", automation));
    expect(claim).toMatch(/order by b\.next_due_at asc, b\.binding_object_id asc/);
  });

  it("selects only bindings that are due, enabled and not retired", () => {
    const claim = code(extract("eki_claim_due_bindings", automation));
    expect(claim).toContain("b.evaluation_enabled");
    expect(claim).toContain("b.binding_state <> 'retired'");
    expect(claim).toContain("b.next_due_at <= clock_timestamp()");
  });

  it("excludes a binding whose control is retired or ineffective", () => {
    const claim = code(extract("eki_claim_due_bindings", automation));
    expect(claim).toMatch(/c\.control_state in \('retired', 'ineffective'\)/);
  });

  it("reclaims a lapsed claim so a crashed worker cannot park a binding forever", () => {
    const claim = code(extract("eki_claim_due_bindings", automation));
    expect(claim).toMatch(/claim_expires_at is null or b\.claim_expires_at <= clock_timestamp\(\)/);
  });

  /**
   * The fence. A worker whose claim was reissued stops BEFORE reading evidence:
   * recording its answer would make the older reading the newest row.
   */
  it("refuses a worker whose token no longer matches", () => {
    const evaluate = code(extract("eki_evaluate_claimed_binding", automation));
    expect(evaluate).toMatch(/claim_token is distinct from p_claim_token/);
    expect(evaluate).toContain("claim_superseded");
  });

  it("resolves supersession by sequence, never by timestamp", () => {
    const recalc = code(extract("eki_recalculate_control_state", automation));
    expect(recalc).toMatch(/p_evaluation_sequence <= c\.last_evaluation_sequence/);
    expect(recalc).toContain("superseded_by_newer_evaluation");
  });

  it("retires the unguarded two-argument recalculation", () => {
    expect(automation).toMatch(/drop function if exists public\.eki_recalculate_control_state\(uuid, uuid\)/);
  });

  it("collapses duplicate job delivery onto one run", () => {
    expect(automation).toContain("run_key text not null unique");
    const start = code(extract("eki_start_evaluation_run", automation));
    expect(start).toMatch(/on conflict \(run_key\) do nothing/);
    expect(start).toContain("'duplicate', true");
  });
});

describe("failure containment and retry", () => {
  it("contains one binding's failure instead of aborting the sweep", () => {
    const evaluate = code(extract("eki_evaluate_claimed_binding", automation));
    expect(evaluate).toMatch(/exception when others then/);
    expect(evaluate).toContain("'failed'");
    expect(evaluate).toContain("evaluation_error");
  });

  it("backs off on repeated execution failure, capped by the cadence", () => {
    const evaluate = code(extract("eki_evaluate_claimed_binding", automation));
    expect(evaluate).toMatch(/least\(\s*evaluation_interval/);
    expect(evaluate).toMatch(/power\(2, least\(execution_failures, 6\)\)/);
  });

  /**
   * Advancing by interval from a due date days in the past would queue one
   * catch-up run per missed cadence and flood the next sweep.
   */
  it("reschedules from now, not from the missed due time", () => {
    const evaluate = code(extract("eki_evaluate_claimed_binding", automation));
    expect(evaluate).toMatch(/next_due_at = clock_timestamp\(\) \+ evaluation_interval/);
  });

  it("records how many cadences were missed", () => {
    expect(automation).toContain("missed_intervals");
    expect(code(extract("eki_claim_due_bindings", automation))).toContain("missed_intervals");
  });

  it("separates execution failures from evaluation failures", () => {
    // Conflating them would let an unreachable source look like a failing control.
    expect(automation).toContain("execution_failures");
    expect(automation).toContain("consecutive_failures");
  });
});

describe("the second resolver", () => {
  const resolver = code(extract("eki_resolve_privileged_access_activity", automation));

  it("reads a real authoritative source", () => {
    expect(resolver).toContain("from public.audit_logs");
    expect(resolver).toContain("'organization_members'");
    expect(resolver).toContain("'project_team_members'");
  });

  it("is scoped to one organization", () => {
    expect(resolver).toMatch(/a\.organization_id = p_organization_id/);
  });

  it("fails closed on an unreadable source and on invalid input", () => {
    expect(resolver).toContain("'unavailable'");
    expect(resolver).toContain("source_unreadable");
    expect(resolver).toContain("'invalid'");
    expect(resolver).toContain("organization_required");
  });

  /** A privileged change attributed to a non-member is a fact the source can answer. */
  it("states a contradiction rather than only a freshness verdict", () => {
    expect(resolver).toContain("'contradictory'");
    expect(resolver).toContain("privileged_change_by_non_member");
    expect(resolver).toMatch(/not exists \(\s*select 1 from public\.organization_members/);
  });

  it("carries provenance and measures age against clock_timestamp", () => {
    expect(resolver).toContain("'source', 'audit_logs'");
    expect(resolver).toContain("'resolver', 'privileged_access_activity'");
    expect(resolver).toMatch(/clock_timestamp\(\) - v_latest/);
    expect(resolver).not.toMatch(/now\(\)\s*-\s*v_latest/);
  });

  it("is dispatched from the closed resolver switch", () => {
    const dispatch = code(extract("eki_evaluate_binding", automation));
    expect(dispatch).toContain("when 'privileged_access_activity' then");
    expect(dispatch).toContain("unknown_resolver");
  });
});

describe("security", () => {
  it("requires the service role for every automated mutation", () => {
    for (const fn of [
      "eki_start_evaluation_run",
      "eki_complete_evaluation_run",
      "eki_claim_due_bindings",
      "eki_evaluate_claimed_binding",
      "eki_request_evaluation",
      "eki_evaluate_binding",
      "eki_recalculate_control_state",
    ]) {
      expect(code(extract(fn, automation)), fn).toContain("auth.role() <> 'service_role'");
    }
  });

  it("fixes search_path on every privileged function", () => {
    const definers = automation.match(/security definer[^\n]*/g) ?? [];
    expect(definers.length).toBeGreaterThan(0);
    for (const line of definers) {
      expect(line).toContain("set search_path = public");
    }
  });

  it("enables RLS and revokes writes on the new tables", () => {
    for (const table of ["eki_evaluation_runs", "eki_evaluation_run_items"]) {
      expect(automation).toContain(`alter table public.${table} enable row level security`);
    }
    expect(automation).toContain("revoke insert, update, delete");
    expect(automation).toContain("public.is_org_member(organization_id)");
  });

  it("strips credentials from stored error text", () => {
    const safe = code(extract("eki_safe_error", automation));
    for (const secret of ["password", "secret", "token", "key", "bearer", "authorization"]) {
      expect(safe).toContain(secret);
    }
    expect(safe).toContain("redacted");
  });

  /** A denied manual request is returned, not raised — REG-031's rule holds here too. */
  it("returns a manual-evaluation denial instead of raising it", () => {
    const request = code(extract("eki_request_evaluation", automation));
    const denial = request.indexOf("'access_denied'");
    expect(denial).toBeGreaterThan(-1);
    expect(request.slice(denial)).toContain("'authorized', false");
  });

  it("lets an explicit request bypass the cadence but never the scheduler", () => {
    const request = code(extract("eki_request_evaluation", automation));
    expect(request).toContain("p_trigger_type not in ('manual', 'mutation')");
    // The claim function has no bypass: it only ever selects rows already due.
    expect(code(extract("eki_claim_due_bindings", automation))).toContain("b.next_due_at <= clock_timestamp()");
  });
});

describe("REG-034 — a refusal by an actor with no role", () => {
  /**
   * The audit could not express "no role", so the insert violated its check
   * constraint, the exception discarded the audit row AND the caller's answer,
   * and the most important denial there is — an actor with no standing — was the
   * one that could not be recorded.
   */
  it("admits `none` in the governance audit actor role", () => {
    expect(actorRole).toMatch(/actor_role in \('owner', 'admin', 'member', 'viewer', 'service', 'none'\)/);
  });

  it("widens and never narrows the existing vocabulary", () => {
    for (const role of ["owner", "admin", "member", "viewer", "service"]) {
      expect(actorRole).toContain(`'${role}'`);
    }
  });
});

describe("REG-036 — every EKI function must be revoked from the API roles", () => {
  /**
   * PostgreSQL grants EXECUTE to PUBLIC by default on CREATE FUNCTION, and
   * `anon` and `authenticated` inherit it. Macrophases 1 and 2 revoked
   * explicitly; Macrophase 3 did not, and
   * `eki_resolve_privileged_access_activity` — SECURITY DEFINER, no service-role
   * guard, because it is called from inside the engine — became readable by any
   * caller naming an arbitrary organization id. Verified in stage: RLS showed an
   * authenticated user 0 rows of another tenant's `audit_logs`; the resolver
   * returned 31 with an exact timestamp. `anon` reached it too, so a publishable
   * key and no session were enough.
   *
   * The guard is written over ALL EKI migrations rather than the new one, so a
   * function added by a later macrophase without a revoke fails here.
   */
  // Discovered from disk, not listed. A hard-coded list is a guard that stops
  // guarding the moment somebody adds a migration and forgets to register it
  // here — which is the same class of omission the guard exists to catch.
  const combined = readdirSync(resolve(process.cwd(), "supabase/migrations"))
    .filter((name) => name.endsWith(".sql") && name.includes("eki"))
    .map((name) => read(`supabase/migrations/${name}`))
    .join("\n");

  function namesMatching(pattern: RegExp): Set<string> {
    return new Set([...combined.matchAll(pattern)].map((m) => m[1]));
  }

  it("revokes execute from public, anon and authenticated for every function it creates", () => {
    const created = namesMatching(/create or replace function public\.(eki_\w+)\s*\(/g);
    const revoked = namesMatching(/revoke all on function public\.(eki_\w+)\s*\(/g);
    expect(created.size).toBeGreaterThan(10);

    const unprotected = [...created].filter((name) => !revoked.has(name));
    expect(unprotected, `EKI functions with no revoke: ${unprotected.join(", ")}`).toEqual([]);
  });

  it("revokes from all three API roles, never only from public", () => {
    for (const match of combined.matchAll(/revoke all on function public\.eki_\w+[^;]*;/g)) {
      expect(match[0]).toContain("from public, anon, authenticated");
    }
  });

  it("guards the resolver itself, so a restored grant cannot reopen the disclosure", () => {
    const resolver = code(extract("eki_resolve_privileged_access_activity", read(
      "supabase/migrations/20260868000000_eki_revoke_public_execute.sql",
    )));
    expect(resolver).toContain("eki_service_role_required");
    // NOT coalesce(): a NULL role means a direct database connection, which is
    // how the acceptance script and any scheduled job run and which already needs
    // credentials conferring more than this guard protects. The revoke is the
    // control; this is defence in depth.
    expect(resolver).toMatch(/auth\.role\(\) is not null and auth\.role\(\) <> 'service_role'/);
  });

  it("keeps service_role able to execute what it must", () => {
    const fix = read("supabase/migrations/20260868000000_eki_revoke_public_execute.sql");
    for (const fn of [
      "eki_resolve_privileged_access_activity",
      "eki_claim_due_bindings",
      "eki_evaluate_claimed_binding",
      "eki_request_evaluation",
      "eki_start_evaluation_run",
      "eki_complete_evaluation_run",
      "eki_recalculate_control_state",
    ]) {
      expect(fix, fn).toMatch(new RegExp(`grant execute on function public\\.${fn}\\(`));
    }
  });
});

describe("real-database acceptance script", () => {
  it("rolls back everything it creates", () => {
    const statements = code(acceptance).trim();
    expect(statements.startsWith("begin;")).toBe(true);
    expect(statements.endsWith("rollback;")).toBe(true);
    expect(statements).not.toMatch(/^\s*commit;/m);
  });

  it("covers the required end-to-end flow", () => {
    for (const marker of [
      "claim",
      "superseded",
      "operating",
      "degraded",
      "privileged_access_activity",
      "missed_intervals",
    ]) {
      expect(acceptance).toContain(marker);
    }
  });

  /** A step that cannot run must fail the script, never report a skip as a pass. */
  it("refuses to skip its preconditions", () => {
    expect(acceptance).toMatch(/raise exception 'acceptance_requires_/);
  });
});

describe("REG-037 — no API role may hold a write privilege on an EKI table", () => {
  /**
   * Supabase grants ALL on new `public` tables to `anon` and `authenticated`.
   * 20260864 and 20260866 revoked only `insert, update, delete`, and only `from
   * authenticated`. TRUNCATE survived for both roles on all seven EKI tables.
   *
   * TRUNCATE does not go through RLS and does not fire row-level triggers, so
   * the BEFORE DELETE append-only guards on `eki_evidence_evaluations` and
   * `eki_control_state_transitions` would never run. A holder of the publishable
   * key could erase the immutable evidence history, and the guards built to
   * prevent exactly that are structurally unable to see it.
   *
   * Found by a production probe, not by review.
   */
  const fix = read("supabase/migrations/20260869000000_eki_revoke_api_write_grants.sql");

  it("revokes ALL rather than enumerating privileges to remove", () => {
    // Enumerating is what produced the gap: TRUNCATE was simply not on the list.
    // `revoke all` is immune to the class, including privileges a future
    // PostgreSQL adds.
    expect(fix).toMatch(/revoke all on public\.%I from anon, authenticated/);
    expect(fix).not.toMatch(/revoke\s+(insert|update|delete)[^;]*from anon/i);
  });

  it("covers every EKI table and the relations table", () => {
    for (const table of [
      "eki_evidence_binding_runtime",
      "eki_evidence_evaluations",
      "eki_control_runtime",
      "eki_control_state_transitions",
      "eki_open_findings",
      "eki_evaluation_runs",
      "eki_evaluation_run_items",
      "project_knowledge_relations",
    ]) {
      expect(fix, table).toContain(`'${table}'`);
    }
  });

  it("grants back only SELECT to authenticated, and all to the service role", () => {
    expect(fix).toMatch(/grant select on public\.%I to authenticated/);
    expect(fix).toMatch(/grant all on public\.%I to service_role/);
    // Comments are stripped: the header explains that Supabase grants ALL "to anon
    // and authenticated" by default, and matching prose rather than code would
    // fail for the wrong reason.
    expect(code(fix)).not.toMatch(/grant[^;]*to anon/);
  });

  /** The earlier revokes stay in place; this one is additive hardening. */
  it("does not weaken the existing revokes", () => {
    const automationSql = read("supabase/migrations/20260866000000_eki_automated_evaluation.sql");
    expect(automationSql).toContain("revoke insert, update, delete");
  });
});
