// ============================================================================
// Phase 4B · Task 4 — Beta Readiness Smoke Pass (CI-safe gate)
// Guard: PHASE4B-BETA-READINESS-SMOKE-PASS
// ============================================================================
// The beta gate as an executable meta-check: every beta-readiness GATE must be
// backed by a protecting regression guard in the map AND a real test file on
// disk. If a future change deletes a guard row or its test, this smoke gate
// fails in CI — so "beta ready" can never silently rot. It also confirms the
// cross-browser E2E is env-gated (never a flaky CI blocker) and that the
// operational health migration exists in the repo.
// ============================================================================

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const map = readFileSync(join(root, "docs/product-brain/regression-test-map.md"), "utf8");

interface Gate {
  gate: string;
  /** Guard rows that must exist in the regression map. */
  guards: string[];
  /** Representative test files that must exist on disk. */
  tests: string[];
}

const GATES: Gate[] = [
  {
    gate: "Gate 1 — Core Realtime (Workboard + Living Graph auto-update, honest freshness)",
    guards: ["REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC", "REALTIME-LIVE-CHANNEL-PUSH"],
    tests: [
      "src/lib/living-graph-realtime-ui/__tests__/realtime-consumer.test.ts",
      "src/lib/events/__tests__/task-status-emission.test.ts",
    ],
  },
  {
    gate: "Gate 2 — Cross-Browser (real multi-tab E2E + CI-safe selector guard)",
    guards: ["PHASE4B-REAL-MULTI-TAB-REALTIME-E2E"],
    tests: ["src/lib/workboard/__tests__/realtime-e2e-selectors.test.ts", "e2e/realtime-sync.spec.ts"],
  },
  {
    gate: "Gate 3 — Hierarchy (milestone→tasks→subtasks, evidence hidden, scoped expand)",
    guards: [
      "LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION",
      "LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE",
      "LIVING-GRAPH-HIERARCHY-CONSISTENCY",
    ],
    tests: [
      "src/lib/living-graph-realtime-ui/__tests__/realtime-consumer.test.ts",
      "src/lib/living-graph/realtime/__tests__/living-graph-realtime-integration-readiness.test.ts",
    ],
  },
  {
    gate: "Gate 4 — Milestone Inclusion (new milestone visible; chain not a dependency)",
    guards: ["LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION", "LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY"],
    tests: [
      "src/lib/graph/__tests__/living-graph-new-milestone-inclusion.test.ts",
      "src/lib/graph/__tests__/living-graph-status.test.ts",
    ],
  },
  {
    gate: "Gate 5 — Observability (admin panel, safe aggregates, honest unavailable)",
    guards: ["PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL"],
    tests: ["src/lib/living-graph/realtime/__tests__/living-graph-observability.test.ts"],
  },
  {
    gate: "Gate 6 — Security/RBAC (deny-by-default subscription/delta + admin allowlist)",
    guards: ["LGRE-SUBSCRIPTION", "LGRE-DELTA-SYNC-HIERARCHY-SAFE", "PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL"],
    tests: [
      "src/lib/living-graph/realtime/__tests__/living-graph-realtime-subscription.test.ts",
      "src/lib/living-graph/realtime/__tests__/living-graph-realtime-delta-sync.test.ts",
    ],
  },
  {
    gate: "Gate 7 — Performance/Degradation + hook hygiene",
    guards: ["LGRE-PERFORMANCE-THROTTLING-OBSERVABILITY-SAFEGUARDS", "PHASE4B-REALTIME-HOOKS-LINT-HARDENING"],
    tests: [
      "src/lib/living-graph/realtime/__tests__/living-graph-realtime-performance.test.ts",
      "src/components/living-graph-realtime/__tests__/realtime-graph.render.test.tsx",
    ],
  },
];

describe("PHASE4B-BETA-READINESS-SMOKE-PASS", () => {
  for (const g of GATES) {
    describe(g.gate, () => {
      for (const guard of g.guards) {
        it(`is protected by regression guard ${guard}`, () => {
          expect(map, `missing guard row: ${guard}`).toMatch(new RegExp(`\\b${guard}\\b`));
        });
      }
      for (const t of g.tests) {
        it(`has its test on disk: ${t}`, () => {
          expect(existsSync(join(root, t)), `missing test file: ${t}`).toBe(true);
        });
      }
    });
  }

  it("the cross-browser E2E is env-gated (self-skips) so it never flakes CI", () => {
    const spec = readFileSync(join(root, "e2e/realtime-sync.spec.ts"), "utf8");
    expect(spec).toMatch(/test\.skip\(!HAS_ENV/);
    // Assert on executable code only — banners legitimately mention page.reload().
    const code = spec.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).not.toMatch(/waitForTimeout\(|\.reload\(/);
  });

  it("the operational realtime-health migration ships in the repo", () => {
    expect(existsSync(join(root, "supabase/migrations/20260836000000_living_graph_realtime_health_fn.sql"))).toBe(true);
    expect(existsSync(join(root, "supabase/migrations/20260833000000_project_event_log_realtime.sql"))).toBe(true);
  });

  it("this smoke pass itself is registered in the regression map", () => {
    expect(map).toMatch(/PHASE4B-BETA-READINESS-SMOKE-PASS/);
  });
});
