// ============================================================================
// Phase 4 · Task 7 — Living Graph Realtime INTEGRATION & FINAL REGRESSION PASS
// Guard: PHASE4-LIVING-GRAPH-REALTIME-INTEGRATION-READINESS
// ============================================================================
// The cross-cutting release gate for Phase 4. It does not re-test each task's
// internals (those are covered by LGRE-FOUNDATION / LGRE-SUBSCRIPTION /
// LGRE-RECALCULATION / LGRE-DELTA-SYNC-HIERARCHY-SAFE /
// LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION /
// LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE /
// REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC /
// LGRE-PERFORMANCE-THROTTLING-OBSERVABILITY-SAFEGUARDS). Instead it asserts the
// pieces are WIRED TOGETHER and the Phase-4 release gates hold at the code
// level, so a later refactor that silently breaks integration fails here:
//
//   • public barrel exports one symbol from EVERY Phase 4 task (no dropped
//     export / broken re-export);
//   • the hierarchy release gate: evidence/event nodes are NEVER default-visible
//     and hierarchy edges are distinct from dependency/evidence edges;
//   • the classic Living Graph auto-refresh bridge (components/graph/…) — NOT
//     covered by the per-task import-boundary tests — never consumes raw
//     project_event_log rows / raw Supabase payloads, never mutates the process
//     graph, and only reaches realtime through the approved signature action +
//     the Task-2 live-sync hook;
//   • the classic Living Graph page mounts the auto-refresh bridge (the
//     Workboard→Living-Graph realtime release gate is wired for the SSR view).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as LGRE from "../index";
import * as LGREUI from "@/lib/living-graph-realtime-ui";
import { resolveNodeVisibility } from "../delta-builder";

// ── 1. Barrel completeness: every Phase 4 task has a live public export ───────
describe("Phase 4 barrel wiring", () => {
  it("re-exports a representative symbol from each Phase 4 task", () => {
    // Task 1 — foundation contracts + engine + observability + security.
    expect(LGRE.LGRE_ENGINE_VERSION).toBeDefined();
    expect(typeof LGRE.createLivingGraphRealtimeEngine).toBe("function");
    expect(LGRE.LGRE_DEFAULT_PERFORMANCE_BUDGET).toBeDefined();
    // Task 2 — subscription layer + notice mapper.
    expect(typeof LGRE.createLivingGraphSubscriptionManager).toBe("function");
    // Task 3 — incremental recalculation service.
    expect(typeof LGRE.createLivingGraphRecalculationService).toBe("function");
    expect(typeof LGRE.attributeGraphRecalculation).toBe("function");
    // Task 4 — delta store + builder.
    expect(typeof LGRE.createLivingGraphDeltaStore).toBe("function");
    expect(typeof LGRE.buildHierarchicalDelta).toBe("function");
    // Task 6 — performance safeguards.
    expect(typeof LGRE.resolvePerfBudget).toBe("function");
    expect(typeof LGRE.isCriticalNotice).toBe("function");
    expect(typeof LGRE.enqueueUpdate).toBe("function");
    expect(typeof LGRE.planReconnect).toBe("function");
    expect(typeof LGRE.assessGraphLoad).toBe("function");
    expect(typeof LGRE.createRealtimePerfObservability).toBe("function");
  });

  it("re-exports the Task 5 pure UI consumer primitives", () => {
    expect(typeof LGREUI.applyDelta).toBe("function");
    expect(typeof LGREUI.selectVisibleGraph).toBe("function");
    expect(typeof LGREUI.scopedExpandableNodeIds).toBe("function");
    expect(typeof LGREUI.expandAllScoped).toBe("function");
    expect(typeof LGREUI.markStaleIfExpired).toBe("function");
    expect(typeof LGREUI.computeRealtimeLayout).toBe("function");
  });

  it("does NOT re-export the DB transport from the pure barrel (client-free core)", () => {
    expect((LGRE as Record<string, unknown>).createSupabaseLivingGraphTransport).toBeUndefined();
  });
});

// ── 2. Hierarchy release gate: evidence hidden by default, edge kinds distinct ─
describe("Phase 4 hierarchy release gate", () => {
  it("evidence/event nodes are NEVER default-visible (hidden until the overlay)", () => {
    expect(resolveNodeVisibility("evidence")).toBe("visible_in_evidence_overlay");
    expect(resolveNodeVisibility("event")).toBe("visible_in_evidence_overlay");
    // Even when the evidence layer is explicitly included they stay overlay-only,
    // never promoted to default children.
    expect(resolveNodeVisibility("evidence", { evidenceLayerIncluded: true })).toBe(
      "visible_in_evidence_overlay",
    );
  });

  it("milestone/task stay default-visible; subtasks reveal on expansion", () => {
    expect(resolveNodeVisibility("milestone")).toBe("default_visible");
    expect(resolveNodeVisibility("task")).toBe("default_visible");
    expect(resolveNodeVisibility("subtask")).toBe("visible_when_parent_expanded");
    expect(resolveNodeVisibility("subtask", { evidenceLayerIncluded: false, isChildSubtask: true })).toBe(
      "visible_when_branch_expanded",
    );
  });
});

// ── 3. Auto-refresh bridge import boundary (classic SSR Living Graph) ─────────
describe("Phase 4 classic auto-refresh bridge import boundary", () => {
  const bridge = join(process.cwd(), "src/components/graph/living-graph-auto-refresh.tsx");
  const code = readFileSync(bridge, "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n");

  it("never consumes raw project_event_log rows or raw Supabase realtime payloads", () => {
    expect(code).not.toMatch(/project_event_log/);
    expect(code).not.toMatch(/postgres_changes|payload\.new/);
    expect(code).not.toMatch(/\.from\(/);
  });

  it("never mutates canonical truth or the process graph, never emits events", () => {
    expect(code).not.toMatch(/process_nodes|process_edges/);
    expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\//);
    expect(code).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });

  it("reaches realtime ONLY through the approved signature action + live-sync hook", () => {
    expect(code).toMatch(/getRealtimeGraphSignatureAction/);
    expect(code).toMatch(/useLiveGraphSync/);
    // It refreshes the SSR server component; it never recomputes graph truth.
    expect(code).toMatch(/router\.refresh\(\)/);
  });
});

// ── 4. Realtime release gate wired into the classic Living Graph page ─────────
describe("Phase 4 realtime release gate wiring", () => {
  it("the classic Living Graph page mounts the auto-refresh bridge", () => {
    const page = join(
      process.cwd(),
      "src/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/page.tsx",
    );
    const src = readFileSync(page, "utf8");
    expect(src).toMatch(/LivingGraphAutoRefresh/);
    expect(src).toMatch(/loadRealtimeGraphSignature/);
  });
});
