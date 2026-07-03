// ============================================================================
// Phase 3 · Task 8 — MPF read-only projection adapter guards
// ============================================================================
// Protects PEG-MPF-LIVING-GRAPH-UI-CONSUMER (adapter layer): the adapter is
// deny-by-default (invalid id / unauthenticated / cross-org project → a safe
// `unauthorized` result with NO data), read-only (SELECT-only queries), and
// consumes the engine for ALL intelligence. Supabase + auth are mocked — no
// network, no real tenant data.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the auth + supabase server modules (adapter dependencies) ────────────

const mockOrg = {
  userId: "u1",
  email: "u@example.com",
  displayName: "U",
  avatarUrl: null,
  locale: "en",
  role: "member" as const,
  organizationId: "org-1",
  organizationName: {},
  organizationSlug: "org-1",
};

let orgContextImpl: () => Promise<typeof mockOrg>;
let tables: Record<string, { rows?: unknown[]; single?: unknown }>;

vi.mock("@/lib/auth", () => ({
  getOrgContext: () => orgContextImpl(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      const cfg = tables[table] ?? {};
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order", "limit"]) {
        chain[m] = () => chain;
      }
      chain.single = () =>
        Promise.resolve(
          cfg.single !== undefined
            ? { data: cfg.single, error: null }
            : { data: null, error: { message: "not found" } },
        );
      // The builder itself is awaited for list queries.
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: cfg.rows ?? [], error: null }).then(resolve);
      return chain;
    },
  }),
}));

import { loadMilestoneFlowProjection } from "../load-projection";

const PROJECT_ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  orgContextImpl = async () => mockOrg;
  tables = {};
});

describe("deny-by-default access (no permissive fallback)", () => {
  it("rejects a non-UUID project id with a safe unauthorized result and NO data", async () => {
    const result = await loadMilestoneFlowProjection("not-a-uuid", "en");
    expect(result).toEqual({ status: "unauthorized" });
  });

  it("rejects when the caller is not authenticated", async () => {
    orgContextImpl = async () => {
      throw new Error("Not authenticated");
    };
    const result = await loadMilestoneFlowProjection(PROJECT_ID, "en");
    expect(result).toEqual({ status: "unauthorized" });
  });

  it("rejects when the project does not exist inside the caller's organization (cross-org isolation)", async () => {
    tables = { projects: {} }; // .single() → not found
    const result = await loadMilestoneFlowProjection(PROJECT_ID, "en");
    expect(result).toEqual({ status: "unauthorized" });
    // The unauthorized result carries no projection, no evidence, no scope detail.
    expect(Object.keys(result)).toEqual(["status"]);
  });
});

describe("read-only engine consumption", () => {
  it("builds the projection through the MPF Engine for an authorized project (empty data → safe empty projection)", async () => {
    tables = {
      projects: { single: { id: PROJECT_ID, slug: "proj", title_i18n: { en: "Project" } } },
      milestones: { rows: [] },
      project_event_log: { rows: [] },
    };
    const result = await loadMilestoneFlowProjection(PROJECT_ID, "en");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.projection.transitions).toEqual([]);
    expect(result.projection.scope).toEqual({ organizationId: "org-1", projectId: PROJECT_ID });
    expect(result.projection.dataQualityFlags).toContain("insufficient_event_density");
    expect(result.projection.engineVersion).toBeDefined();
    expect(result.eventCount).toBe(0);
    expect(result.milestoneCount).toBe(0);
  });

  it("maps canonical milestones + events into engine refs and returns engine transitions", async () => {
    tables = {
      projects: { single: { id: PROJECT_ID, slug: "proj", title_i18n: { en: "Project" } } },
      milestones: {
        rows: [
          { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Design", status: "completed", start_date: null, target_date: "2026-01-01", completed_date: "2026-01-10T00:00:00.000Z", order_index: 0 },
          { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Build", status: "in_progress", start_date: null, target_date: "2026-02-01", completed_date: null, order_index: 1 },
        ],
      },
      project_event_log: {
        rows: [
          {
            event_id: "e1", event_type: "TaskStarted", event_category: "task",
            occurred_at: "2026-01-12T00:00:00.000Z", subject_type: "task", subject_id: "t1",
            from_state: null, to_state: "in_progress", event_lifecycle_class: "BUSINESS_EVENT",
            confidence: 0.95, is_compensating_event: false,
            payload: { milestone_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
          },
        ],
      },
    };
    const result = await loadMilestoneFlowProjection(PROJECT_ID, "en");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // The ENGINE derived the transition — the adapter only plumbed refs.
    expect(result.projection.transitions.length).toBeGreaterThan(0);
    expect(result.milestoneNamesById["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]).toBe("Build");
    expect(result.projection.observability).toBeDefined();
  });
});
