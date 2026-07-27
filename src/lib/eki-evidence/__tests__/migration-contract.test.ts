import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BINDING_STATES,
  CONTROL_STATES,
  EVIDENCE_OUTCOMES,
  EVIDENCE_RESOLVERS,
  FINDING_CONDITIONS,
} from "../types";

/**
 * Line endings are normalised on read. The migrations are checked out with CRLF
 * on Windows and LF on CI, so any pattern containing "\n" matches nothing on one
 * of the two — and the guard passes for a reason unrelated to the SQL.
 */
function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

function sql(name: string) {
  return read(`supabase/migrations/${name}`);
}

const scope = sql("20260863000000_eki_knowledge_scope_and_relations.sql");
const engine = sql("20260864000000_eki_evidence_engine.sql");
const governance = sql("20260865000000_eki_governance_audit_and_findings.sql");
const acceptance = read("supabase/tests/eki_macrophase2_acceptance.sql");

/**
 * The database is the enforcement point; the TypeScript vocabularies exist so a
 * caller gets a usable error before a constraint raises one. That is only true
 * while the two agree, and nothing else makes them agree — so this compares them
 * directly. A value added to one side and not the other fails here.
 */
describe("vocabulary drift between TypeScript and the migrations", () => {
  const cases: Array<[string, readonly string[], string]> = [
    ["outcome", EVIDENCE_OUTCOMES, engine],
    ["binding_state", BINDING_STATES, engine],
    ["control_state", CONTROL_STATES, engine],
    ["resolver_key", EVIDENCE_RESOLVERS, engine],
    ["condition_code", FINDING_CONDITIONS, engine],
  ];

  for (const [column, vocabulary, source] of cases) {
    it(`${column} matches its check constraint exactly`, () => {
      const match = source.match(new RegExp(`${column} text not null[^)]*?check \\(${column} in \\(([^)]*)\\)`, "s"));
      expect(match, `no check constraint found for ${column}`).not.toBeNull();
      const inDatabase = [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
      expect(inDatabase).toEqual([...vocabulary].sort());
    });
  }
});

describe("evidence engine migration contract", () => {
  it("creates the runtime tables with row level security", () => {
    for (const table of [
      "eki_evidence_binding_runtime",
      "eki_evidence_evaluations",
      "eki_control_runtime",
      "eki_control_state_transitions",
      "eki_open_findings",
    ]) {
      expect(engine).toContain(`create table public.${table}`);
      expect(engine).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps evaluations append-only", () => {
    expect(engine).toContain("eki_evaluations_immutable");
    expect(engine).toMatch(/create trigger eki_evaluations_no_update before update/);
    expect(engine).toMatch(/create trigger eki_evaluations_no_delete before delete/);
  });

  it("requires every mutation to run as the service role", () => {
    for (const fn of [
      "eki_evaluate_binding",
      "eki_recalculate_control_state",
      "eki_evaluate_and_sync",
      "eki_resolve_finding",
      "eki_assign_owner",
      "eki_record_governance_event",
    ]) {
      const body = extract(fn, `${engine}\n${governance}`);
      expect(body, `${fn} not found`).toBeTruthy();
      expect(body).toContain("auth.role() <> 'service_role'");
    }
  });

  it("refuses to store secrets, payloads or transcripts in the audit metadata", () => {
    const safe = extract("eki_safe_metadata", governance)!;
    for (const key of ["access_token", "authorization", "body", "content", "password", "payload", "raw_payload", "secret", "transcript"]) {
      expect(safe).toContain(`'${key}'`);
    }
  });

  it("chains governance audit records so a deletion is detectable", () => {
    const record = extract("eki_record_governance_event", governance)!;
    expect(record).toContain("pg_advisory_xact_lock");
    expect(record).toMatch(/digest|encode/);
  });

  it("attributes every control transition to a human or to an evaluation", () => {
    expect(engine).toContain("eki_transition_attribution");
    expect(engine).toContain("(driver = 'human' and actor_id is not null)");
    expect(engine).toContain("(driver = 'evidence' and evaluation_id is not null)");
  });

  it("makes a finding idempotent on organization, target and condition", () => {
    expect(engine).toContain("primary key (organization_id, target_object_id, condition_code)");
    expect(extract("eki_upsert_finding", governance)).toContain("occurrence_count");
  });
});

// ── Regression guards ───────────────────────────────────────────────────────
// Each of these was found by running the engine end to end against a real
// database. None was visible in review, which is why they are guarded here
// rather than remembered.

describe("REG-027 — a replaced view must keep its grants", () => {
  /**
   * `create or replace view` cannot reorder columns, so the migration drops and
   * recreates. Dropping a view discards its grants: without the regrant, every
   * authenticated reader silently loses access and the failure surfaces as an
   * empty screen, not an error.
   */
  it("restores the grant it dropped", () => {
    const drops = [...scope.matchAll(/drop view if exists public\.(\w+)/g)].map((m) => m[1]);
    expect(drops.length).toBeGreaterThan(0);
    for (const view of drops) {
      expect(scope, `view ${view} is dropped but never regranted`).toMatch(
        new RegExp(`grant select on public\\.${view} to authenticated`, "i"),
      );
    }
  });
});

describe("REG-028 — array append must not be written as concatenation with a literal", () => {
  /**
   * `failures := failures || 'no_fresh_evidence'` parses the right-hand side as
   * an ARRAY literal, not as an element, and raises `malformed array literal` at
   * runtime. `array_append` is unambiguous.
   */
  it("uses array_append for every text[] accumulation", () => {
    for (const source of [engine, governance]) {
      expect(source).not.toMatch(/\b(failures|reasons|reason_codes)\s*:=\s*\1\s*\|\|\s*'/);
    }
    expect(engine).toContain("array_append(failures,");
  });
});

describe("REG-029 — evaluation time is statement time, not transaction time", () => {
  /**
   * `now()` is the TRANSACTION timestamp. Two evaluations written in one
   * transaction received the identical value, `order by evaluated_at desc limit
   * 1` became non-deterministic, the engine read a stale evaluation as the
   * latest, and a control could never reach `operating`. Freshness measured as
   * `now() - latest` had the same defect from the other direction: a
   * long-running transaction compared against an increasingly wrong "now".
   */
  it("stamps evaluations with clock_timestamp and orders by an identity column", () => {
    expect(engine).toContain("evaluated_at timestamptz not null default clock_timestamp()");
    expect(engine).toContain("sequence_no bigint generated always as identity");
    expect(engine).not.toContain("evaluated_at timestamptz not null default now()");
  });

  it("measures freshness against clock_timestamp", () => {
    const resolver = extract("eki_resolve_governance_audit_activity", engine)!;
    expect(resolver).toContain("clock_timestamp() - v_latest");
    expect(resolver).not.toMatch(/now\(\)\s*-\s*v_latest/);
  });

  it("resolves the latest evaluation by sequence, never by timestamp alone", () => {
    // Comments are stripped first: the defect is described in a comment in the
    // migration, and matching the description instead of the code would make
    // this guard fail for the wrong reason — or pass once the comment is edited.
    const byTimestampOnly = /order by evaluated_at desc\s+limit 1/;
    expect(code(engine)).not.toMatch(byTimestampOnly);
    expect(code(governance)).not.toMatch(byTimestampOnly);
    expect(code(engine)).toMatch(/order by sequence_no desc/);
  });
});

describe("REG-030 — a shared trigger must not reference a column that is not on every table", () => {
  /**
   * One trigger function serves several knowledge tables. Evaluating
   * `new.knowledge_type` unconditionally raised `record "new" has no field
   * "knowledge_type"` on the tables that lack it. The column is read only inside
   * the branch for the table that has it.
   */
  it("reads table-specific columns only inside their own branch", () => {
    const trigger = code(extract("eki_audit_knowledge_mutation", governance)!).toLowerCase();
    expect(trigger).toMatch(/v_actor_type\s+text\s*:=\s*'human'/);

    // Every read of a column that does not exist on all served tables must come
    // after the branch that selects the table which has it.
    const branch = trigger.indexOf("tg_table_name = 'project_knowledge_objects'");
    expect(branch).toBeGreaterThan(-1);
    const firstTypeRead = trigger.indexOf("new.knowledge_type");
    expect(firstTypeRead).toBeGreaterThan(branch);

    // And it must not appear in the declaration block, which runs for every table.
    const declarations = trigger.slice(0, trigger.indexOf("\nbegin"));
    expect(declarations).not.toContain("new.knowledge_type");
  });
});

describe("REG-031 — a denial must be returned, never raised", () => {
  /**
   * `eki_resolve_finding` wrote its audit record and then RAISEd. The exception
   * rolled back the audit insert in the same transaction, so the refusal left no
   * trace: the system logged only its successes and could not demonstrate that
   * it refuses anything. Denials are returned as `{authorized: false}` and the
   * service layer turns them into errors for the caller.
   */
  it("returns authorized:false instead of raising after recording the denial", () => {
    for (const fn of ["eki_resolve_finding", "eki_assign_owner"]) {
      const body = extract(fn, governance)!;
      const denialAt = body.indexOf("'access_denied'");
      expect(denialAt, `${fn} does not record a denial`).toBeGreaterThan(-1);
      const afterDenial = body.slice(denialAt);
      const returnAt = afterDenial.indexOf("'authorized', false");
      const raiseAt = afterDenial.indexOf("raise exception");
      expect(returnAt, `${fn} records a denial but never returns it`).toBeGreaterThan(-1);
      if (raiseAt > -1) expect(returnAt).toBeLessThan(raiseAt);
    }
  });

  it("is covered by the real-database acceptance run", () => {
    expect(acceptance).toContain("denegacion_auditada");
    expect(acceptance).toContain("access_denied");
  });
});

describe("real-database acceptance script", () => {
  it("rolls back everything it creates", () => {
    const statements = code(acceptance).trim();
    expect(statements.startsWith("begin;")).toBe(true);
    expect(statements.endsWith("rollback;")).toBe(true);
    expect(statements).not.toMatch(/^\s*commit;/m);
  });

  it("asserts the full lifecycle, not just the happy path", () => {
    for (const marker of ["operating", "degraded", "implemented"]) {
      expect(acceptance).toContain(marker);
    }
  });
});

/** SQL with `--` comments removed, so a guard matches code and not prose. */
function code(source: string): string {
  // Split on /\r?\n/: the migrations are checked out with CRLF endings, and
  // anchoring the comment pattern to `$` silently strips nothing when a `\r`
  // sits between the comment and the end of the line.
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*/, ""))
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function extract(functionName: string, source: string): string | null {
  const start = source.indexOf(`create or replace function public.${functionName}`);
  if (start < 0) return null;
  const end = source.indexOf("\n$$;", start);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}
