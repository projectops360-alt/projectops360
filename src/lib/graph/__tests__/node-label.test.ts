// ============================================================================
// LGS-NODE-LABEL-CANONICAL — Living Graph node label = canonical truth
// ============================================================================
// Protects "different views, same truth" for LABELS (REG-018 / CAP-001):
// a task/milestone node shows the CANONICAL title (roadmap_tasks / milestones)
// so the Living Graph matches the Workboard — never a stale process_node title.
// ============================================================================

import { describe, it, expect } from "vitest";
import { resolveCanonicalNodeLabel } from "@/lib/graph/node-label";

describe("resolveCanonicalNodeLabel", () => {
  it("prefers the canonical task title over the stale process_node title", () => {
    // A task renamed after its last transition: process_node kept the old title.
    expect(
      resolveCanonicalNodeLabel({
        processTitle: "Add last updated and change tracking",
        taskTitle: "Build Living Graph Delta Store & Sync",
      }),
    ).toBe("Build Living Graph Delta Store & Sync");
  });

  it("prefers the canonical milestone title for milestone nodes", () => {
    expect(
      resolveCanonicalNodeLabel({
        processTitle: "old phase name",
        milestoneTitle: "Phase 4 — Living Graph Realtime",
      }),
    ).toBe("Phase 4 — Living Graph Realtime");
  });

  it("falls back to the process_node title for non-canonical nodes (decisions, docs)", () => {
    expect(resolveCanonicalNodeLabel({ processTitle: "Decision: adopt X" })).toBe("Decision: adopt X");
    expect(
      resolveCanonicalNodeLabel({ processTitle: "Doc", taskTitle: null, milestoneTitle: null }),
    ).toBe("Doc");
  });

  it("ignores blank/whitespace canonical titles and falls back", () => {
    expect(resolveCanonicalNodeLabel({ processTitle: "kept", taskTitle: "   " })).toBe("kept");
    expect(resolveCanonicalNodeLabel({ processTitle: "kept", taskTitle: "" })).toBe("kept");
  });

  it("task title wins over milestone title when both are (defensively) present", () => {
    expect(
      resolveCanonicalNodeLabel({ processTitle: "p", taskTitle: "T", milestoneTitle: "M" }),
    ).toBe("T");
  });
});
