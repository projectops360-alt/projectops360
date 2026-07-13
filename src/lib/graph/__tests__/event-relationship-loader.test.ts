// ============================================================================
// CAP-045 extension — Canonical-event loader security / read-scope tests
// ============================================================================
// Proves the read security contract WITHOUT a database, by injecting a fake
// Supabase client and recording how the loader queries it:
//   1. requires BOTH organizationId and projectId (no global reads);
//   2. every query is scoped by project_id AND organization_id;
//   3. the loader uses ONLY the supplied (authenticated, RLS) client — it never
//      constructs an admin/service-role client for an ordinary read;
//   4. cross-project rows that slip through the query are REJECTED by the
//      projection (single-project coherent).
// ============================================================================

import { describe, it, expect } from "vitest";
import { loadCanonicalEventProjection, EVENT_LOG_LIMIT } from "@/lib/graph/event-relationship-loader";
import type { SupabaseClient } from "@supabase/supabase-js";

const ORG = "org-1";
const PROJECT = "00000000-0000-0000-0000-000000000010";
const OTHER_PROJECT = "00000000-0000-0000-0000-000000000099";

interface RecordedQuery {
  table: string;
  eqs: Record<string, string>;
  ins: Record<string, string[]>;
}

/** Minimal chainable mock: records filters and returns canned data. */
function makeMockClient(opts: {
  logRows?: unknown[];
  objRows?: unknown[];
  logError?: boolean;
}): { client: SupabaseClient; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const chain = (table: string) => {
    const rec: RecordedQuery = { table, eqs: {}, ins: {} };
    let terminal: { data: unknown[] | null; error: { error: true } | null } = {
      data: null,
      error: null,
    };
    const builder = {
      select: () => builder,
      eq: (col: string, val: string) => {
        rec.eqs[col] = val;
        return builder;
      },
      order: () => builder,
      limit: () => {
        if (table === "project_event_log") {
          terminal = {
            data: opts.logError ? null : (opts.logRows ?? []),
            error: opts.logError ? { error: true } : null,
          };
        }
        return terminal;
      },
      in: (col: string, vals: string[]) => {
        rec.ins[col] = vals;
        if (table === "project_event_objects") {
          terminal = { data: opts.objRows ?? [], error: null };
        }
        return terminal;
      },
    };
    queries.push(rec);
    return builder;
  };
  const client = {
    from: (table: string) => chain(table),
  } as unknown as SupabaseClient;
  return { client, queries };
}

function logRow(event_id: string, project_id: string, sequence_number: number): Record<string, unknown> {
  return {
    event_id,
    organization_id: ORG,
    project_id,
    event_category: "risk",
    event_type: "risk_registered",
    event_schema_version: 1,
    event_importance: "MEDIUM",
    event_lifecycle_class: "BUSINESS_EVENT",
    subject_type: "risk",
    subject_id: "r1",
    actor_type: "human",
    actor_id: "u1",
    occurred_at: "2026-01-01T10:00:00.000Z",
    recorded_at: "2026-01-01T10:00:01.000Z",
    sequence_number,
    source_module: "x",
    source_entity_type: "risks",
    source_entity_id: "r1",
    from_state: null,
    to_state: null,
    caused_by: null,
    is_compensating_event: null,
    compensates_event_id: null,
    event_hash: "h",
    previous_event_hash: null,
    provenance: { capture_method: "direct" },
    confidence: null,
    payload: null,
    visibility: "members",
  };
}

describe("CAP-045 loader — read security / scope", () => {
  it("1. requires BOTH organizationId and projectId (no query issued when either is missing)", async () => {
    const { client, queries } = makeMockClient({ logRows: [] });
    await loadCanonicalEventProjection(client, "", PROJECT);
    expect(queries).toHaveLength(0);
    await loadCanonicalEventProjection(client, ORG, "");
    expect(queries).toHaveLength(0);
  });

  it("2. scopes the log query by project_id AND organization_id", async () => {
    const { client, queries } = makeMockClient({
      logRows: [logRow("e1", PROJECT, 1)],
      objRows: [{ event_id: "e1", object_type: "risk", object_id: "r1", role: "focal" }],
    });
    const res = await loadCanonicalEventProjection(client, ORG, PROJECT);
    const logQuery = queries.find((q) => q.table === "project_event_log");
    expect(logQuery).toBeDefined();
    expect(logQuery!.eqs.project_id).toBe(PROJECT);
    expect(logQuery!.eqs.organization_id).toBe(ORG);
    expect(res.canonicalEvents).toHaveLength(1);
    expect(res.eventsTruncated).toBe(false);
  });

  it("3. uses ONLY the supplied client (never an admin/service-role client)", async () => {
    // The loader has no path to construct an admin client: it operates purely
    // on the client passed in. We assert by recording that the ONLY tables
    // touched are project_event_log and project_event_objects — both ordinary
    // RLS-governed reads — and that the function returns data shaped by the
    // supplied client's response.
    const { client, queries } = makeMockClient({
      logRows: [logRow("e1", PROJECT, 1)],
      objRows: [{ event_id: "e1", object_type: "risk", object_id: "r1", role: "focal" }],
    });
    const res = await loadCanonicalEventProjection(client, ORG, PROJECT);
    const tables = new Set(queries.map((q) => q.table));
    expect(tables).toEqual(new Set(["project_event_log", "project_event_objects"]));
    // The object-refs query is bounded by the recovered event_ids only.
    const objQuery = queries.find((q) => q.table === "project_event_objects");
    expect(objQuery!.ins.event_id).toEqual(["e1"]);
    expect(res.canonicalEvents[0].objectRefs).toHaveLength(1);
  });

  it("4. cross-project rows are REJECTED by the projection (single-project coherent)", async () => {
    // Simulate a query that (defensively) returned a row from another project.
    const { client } = makeMockClient({
      logRows: [logRow("e1", PROJECT, 1), logRow("e2", OTHER_PROJECT, 2)],
      objRows: [],
    });
    const res = await loadCanonicalEventProjection(client, ORG, PROJECT);
    // Only the project-scoped event survives the projection's cross-project guard.
    expect(res.canonicalEvents.map((e) => e.eventId)).toEqual(["e1"]);
    expect(res.canonicalEvents.every((e) => e.projectId === PROJECT)).toBe(true);
    // No project_sequence_next edge formed across projects.
    expect(
      res.eventRelationships.some((r) => r.relationshipType === "project_sequence_next"),
    ).toBe(false);
  });

  it("non-fatal: a log read error yields an empty projection (view keeps current behavior)", async () => {
    const { client } = makeMockClient({ logError: true });
    const res = await loadCanonicalEventProjection(client, ORG, PROJECT);
    expect(res.canonicalEvents).toEqual([]);
    expect(res.eventRelationships).toEqual([]);
    expect(res.eventsTruncated).toBe(false);
  });

  it("truncation is detected and reported (limit + 1 read, never silently truncated)", async () => {
    const logRows = Array.from({ length: EVENT_LOG_LIMIT + 5 }, (_, i) =>
      logRow(`e${i}`, PROJECT, i + 1),
    );
    const { client } = makeMockClient({ logRows, objRows: [] });
    const res = await loadCanonicalEventProjection(client, ORG, PROJECT);
    expect(res.eventsTruncated).toBe(true);
    expect(res.canonicalEvents).toHaveLength(EVENT_LOG_LIMIT);
  });
});