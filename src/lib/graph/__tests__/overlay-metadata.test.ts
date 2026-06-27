import { describe, it, expect } from "vitest";
import {
  OVERLAY_META,
  ADVANCED_OVERLAYS,
  resolveOverlayState,
} from "@/lib/graph/overlay-metadata";

describe("resolveOverlayState (Sprint #3 overlay clarity)", () => {
  it("empty when there is no relevant data", () => {
    expect(resolveOverlayState({ totalCount: 0, disconnectedCount: 0 })).toBe("empty");
  });
  it("incomplete when some items are disconnected", () => {
    expect(resolveOverlayState({ totalCount: 5, disconnectedCount: 2 })).toBe("incomplete");
  });
  it("ready when data exists and is connected", () => {
    expect(resolveOverlayState({ totalCount: 5, disconnectedCount: 0 })).toBe("ready");
  });
});

describe("OVERLAY_META", () => {
  const advanced = ["risk", "sopCandidate", "variance", "timeline", "simulation"] as const;

  it("covers every advanced overlay", () => {
    for (const id of advanced) expect(OVERLAY_META[id]).toBeDefined();
    expect(ADVANCED_OVERLAYS.sort()).toEqual([...advanced].sort());
  });

  it("answers the 3 questions for each overlay (purpose, action, data, empty, legend)", () => {
    for (const id of advanced) {
      const m = OVERLAY_META[id]!;
      expect(m.purpose_i18n.en && m.purpose_i18n.es).toBeTruthy(); // what am I looking at
      expect(m.userAction_i18n.en && m.userAction_i18n.es).toBeTruthy(); // what to do next
      expect(m.dataRequirements_i18n.en).toBeTruthy(); // why nodes appear / what's needed
      expect(m.emptyTitle_i18n.en && m.emptyDescription_i18n.en).toBeTruthy(); // useful empty state
      expect(m.incompleteMessage_i18n.en).toBeTruthy();
      expect(m.legend.length).toBeGreaterThan(0); // overlay-specific legend
      for (const item of m.legend) {
        expect(item.color).toMatch(/^#/);
        expect(item.label_i18n.en && item.label_i18n.es).toBeTruthy();
      }
    }
  });

  it("variance overlay offers a CTA to set up a baseline", () => {
    expect(OVERLAY_META.variance!.cta?.href?.("proj-1")).toContain("/projects/proj-1/");
  });
});
