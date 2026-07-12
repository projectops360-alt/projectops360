// ============================================================================
// CAP-046 F2 — Root Cause Miner formatter + delay-semantics tests.
// Guard id: PROCESS-MINING-ROOT-CAUSE-FORMATTER — bilingual evidence-only
// output; REG-010-compliant delay flag (terminal ≠ delayed).
// ============================================================================

import { describe, it, expect } from "vitest";
import { mineRootCauses } from "../engine";
import { formatRootCauseMinerForIsabella } from "../isabella-formatter";
import { isDelayedTask } from "../load-analysis";
import type { RootCauseTaskInput } from "../types";

function task(overrides: Partial<RootCauseTaskInput> = {}): RootCauseTaskInput {
  return {
    taskId: Math.random().toString(36).slice(2),
    title: "T",
    milestoneId: null,
    milestoneLabel: null,
    priority: "p2",
    hasOwner: true,
    isCritical: false,
    discipline: null,
    trade: null,
    location: null,
    isBlocked: false,
    isDelayed: false,
    reworkCount: 0,
    ...overrides,
  };
}

describe("PROCESS-MINING-ROOT-CAUSE-FORMATTER", () => {
  it("produces bilingual, evidence-only text with prevalence and influence scores", () => {
    const result = mineRootCauses([
      ...Array.from({ length: 6 }, () => task({ hasOwner: false, isDelayed: true })),
      ...Array.from({ length: 6 }, () => task({})),
    ]);
    const es = formatRootCauseMinerForIsabella(result, "Torre Norte", "es");
    expect(es).toContain("Torre Norte");
    expect(es).toContain("Retraso: 6/12");
    expect(es).toContain("Influence Score");
    expect(es).toContain("no son causas confirmadas ni recomendaciones");
    expect(es).not.toMatch(/deberías|recomiendo/i);

    const en = formatRootCauseMinerForIsabella(result, "North Tower", "en");
    expect(en).toContain("not confirmed causes, not recommendations");
  });

  it("reports the honest empty state when nothing is adverse", () => {
    const result = mineRootCauses(Array.from({ length: 12 }, () => task({})));
    const text = formatRootCauseMinerForIsabella(result, "Clean", "en");
    expect(text).toContain("No relevant adverse associations");
  });
});

describe("isDelayedTask (REG-010-compliant delay semantics)", () => {
  const now = "2026-07-11T00:00:00.000Z";

  it("open task past planned finish is delayed; without end_date it never is", () => {
    expect(isDelayedTask({ status: "in_progress", end_date: "2026-07-01", completed_at: null }, now)).toBe(true);
    expect(isDelayedTask({ status: "in_progress", end_date: null, completed_at: null }, now)).toBe(false);
    expect(isDelayedTask({ status: "in_progress", end_date: "2026-08-01", completed_at: null }, now)).toBe(false);
  });

  it("completed late is delayed; completed on time is not", () => {
    expect(isDelayedTask({ status: "done", end_date: "2026-07-01", completed_at: "2026-07-05" }, now)).toBe(true);
    expect(isDelayedTask({ status: "done", end_date: "2026-07-01", completed_at: "2026-06-28" }, now)).toBe(false);
  });

  it("terminal non-completed tasks (deferred/cancelled) are never delayed", () => {
    expect(isDelayedTask({ status: "deferred", end_date: "2026-07-01", completed_at: null }, now)).toBe(false);
    expect(isDelayedTask({ status: "cancelled", end_date: "2026-07-01", completed_at: null }, now)).toBe(false);
  });
});
