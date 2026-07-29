import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Time Tracking Engine — tenant isolation & view refresh invariants
// ============================================================================
// Two properties that no pure-arithmetic test can reach, because they are about
// how the queries and mutations are SHAPED rather than what they compute:
//
//   12 — isolation between organizations: every read and write on the time log
//        is scoped by organization_id (RLS is the second line, not the only one).
//   13 — every mutation revalidates, so a logged entry reaches the subtask, the
//        task, the report and the dashboards without a manual page reload.
//
// Guard TIME-TRACKING-SCOPE-AND-REVALIDATE. These read the source on purpose: a
// dropped `.eq("organization_id", ...)` or a forgotten revalidate() is exactly
// the kind of edit that stays green under behavioural tests and leaks or goes
// stale in production.
// ============================================================================

const root = join(process.cwd(), "src", "lib", "time-tracking");
const read = (file: string) => readFileSync(join(root, file), "utf8");

const service = read("service.ts");
const actions = read("actions.ts");
const projectEffort = read("project-effort.ts");

/**
 * Split a file into the statement chains that touch a given table, so each one
 * can be checked for scoping on its own.
 */
function queryChains(source: string, table: string): string[] {
  const chains: string[] = [];
  const marker = `.from("${table}")`;
  let index = source.indexOf(marker);
  while (index !== -1) {
    // A chain ends at the first semicolon that closes the statement.
    const end = source.indexOf(";", index);
    chains.push(source.slice(index, end === -1 ? source.length : end));
    index = source.indexOf(marker, index + marker.length);
  }
  return chains;
}

describe("12 — isolation between organizations", () => {
  it("finds the time-log queries it is meant to be guarding", () => {
    // Without this, the loops below would pass vacuously if the table were
    // renamed or the queries moved elsewhere.
    const chains = [
      ...queryChains(service, "subtask_time_entries"),
      ...queryChains(actions, "subtask_time_entries"),
      ...queryChains(projectEffort, "subtask_time_entries"),
    ];
    expect(chains.length).toBeGreaterThanOrEqual(8);
  });

  it("scopes every time-log query by organization_id", () => {
    for (const [name, source] of [
      ["service.ts", service],
      ["actions.ts", actions],
      ["project-effort.ts", projectEffort],
    ] as const) {
      for (const chain of queryChains(source, "subtask_time_entries")) {
        expect(chain, `${name}: unscoped time-log query → ${chain.slice(0, 120)}`).toContain(
          "organization_id",
        );
      }
    }
  });

  it("scopes every derived-cache write by organization_id", () => {
    // The caches are written with the admin client, which bypasses RLS — so the
    // scope here IS the isolation, not a belt on top of one.
    for (const table of ["task_subtasks", "roadmap_tasks"]) {
      const writes = queryChains(service, table).filter((c) => c.includes(".update("));
      expect(writes.length, `no cache write found for ${table}`).toBeGreaterThan(0);
      for (const chain of writes) {
        expect(chain, `unscoped cache write on ${table}`).toContain("organization_id");
        expect(chain, `cache write on ${table} not scoped to a project`).toContain("project_id");
      }
    }
  });

  it("resolves the work item under the caller's own organization", () => {
    // A task or subtask id from another tenant must not resolve, which is what
    // makes a forged id a not-found rather than a cross-org write.
    for (const loader of ["loadSubtaskContext", "loadTaskContext"]) {
      const start = actions.indexOf(`async function ${loader}`);
      expect(start, `${loader} missing`).toBeGreaterThan(-1);
      const body = actions.slice(start, actions.indexOf("\n}", start));
      expect(body, `${loader} does not scope by organization`).toContain("org.organizationId");
      expect(body, `${loader} does not scope by project`).toContain("projectId");
    }
  });

  it("takes the organization from the trusted session, never from the caller", () => {
    // getOrgContext() reads the session; an organizationId in the input payload
    // would let a caller name the tenant it wants to write into.
    expect(actions).toContain("await getOrgContext()");
    expect(actions).not.toMatch(/organizationId:\s*(data|input)\./);
  });
});

describe("13 — every mutation refreshes the views", () => {
  const mutations = ["logTimeEntryAction", "updateTimeEntryAction", "deleteTimeEntryAction"];

  /** The body of one exported action, up to the next top-level declaration. */
  function actionBody(name: string): string {
    const start = actions.indexOf(`export async function ${name}`);
    expect(start, `${name} missing`).toBeGreaterThan(-1);
    const next = actions.indexOf("\nexport async function", start + 1);
    return actions.slice(start, next === -1 ? actions.length : next);
  }

  it("revalidates after creating, editing and deleting an entry", () => {
    for (const name of mutations) {
      expect(actionBody(name), `${name} never calls revalidate()`).toContain("revalidate()");
    }
  });

  it("revalidates the whole project layout, so sibling views refresh too", () => {
    // The task modal, the report, the PM dashboard and the PMO views are all
    // under this layout — revalidating it is what updates them together.
    expect(actions).toContain('revalidatePath("/[locale]/(app)/projects/[projectId]", "layout")');
  });

  it("refreshes BOTH derived caches on every mutation", () => {
    // This is the regression: refreshing only the subtask cache left the task,
    // the report and the dashboard reading a column nothing ever wrote.
    for (const name of mutations) {
      expect(actionBody(name), `${name} does not refresh the caches`).toContain("refreshCaches(");
    }
    const refresh = service;
    expect(refresh).toContain("export async function refreshTaskActualHours");
    expect(refresh).toContain("export async function refreshSubtaskActualHours");
  });

  it("rolls up to the task even for subtask-level entries", () => {
    const start = actions.indexOf("async function refreshCaches");
    const body = actions.slice(start, actions.indexOf("\n}", start));
    // The task refresh must be unconditional; only the subtask one is optional.
    expect(body).toContain("refreshTaskActualHours(");
    expect(body).toMatch(/ctx\.subtaskId\s*\n?\s*\?\s*await refreshSubtaskActualHours/);
  });
});
