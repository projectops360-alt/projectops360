// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION — tool gating
// ============================================================================
// The process-intelligence tools are registered/offered to the LLM ONLY when
// ISABELLA_PROCESS_INTELLIGENCE_ENABLED is on. Default OFF preserves the base set.
// ============================================================================

import { afterEach, describe, it, expect, vi } from "vitest";

const PI_TOOLS = ["get_daily_diagnosis", "get_root_cause_analysis", "get_recommendation_plan"];

afterEach(() => {
  delete process.env.ISABELLA_PROCESS_INTELLIGENCE_ENABLED;
  vi.resetModules();
});

describe("process-intelligence tool gating", () => {
  it("flag OFF → base tools only, no intelligence tools", async () => {
    const { listToolSpecs, getTool } = await import("@/lib/isabella/tools/registry");
    const names = listToolSpecs().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["query_tasks", "query_project_data", "get_project_summary"]));
    for (const t of PI_TOOLS) {
      expect(names).not.toContain(t);
      expect(getTool(t)).toBeNull();
    }
  });

  it("flag ON → intelligence tools become available (read-only wrappers)", async () => {
    process.env.ISABELLA_PROCESS_INTELLIGENCE_ENABLED = "true";
    vi.resetModules();
    const { listToolSpecs, getTool } = await import("@/lib/isabella/tools/registry");
    const names = listToolSpecs().map((t) => t.name);
    for (const t of PI_TOOLS) {
      expect(names).toContain(t);
      expect(getTool(t)).not.toBeNull();
    }
  });
});
