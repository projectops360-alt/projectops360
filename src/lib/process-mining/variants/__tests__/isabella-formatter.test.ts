// ============================================================================
// CAP-046 F1 — Isabella variant formatter tests. Guard id:
// PROCESS-MINING-VARIANT-ISABELLA-FORMATTER — compact bilingual, evidence-only
// output; explicit honesty when no reference variant exists.
// ============================================================================

import { describe, it, expect } from "vitest";
import { analyzeVariants } from "../engine";
import { formatVariantAnalysisForIsabella } from "../isabella-formatter";
import type { VariantCaseInput, VariantEventRef } from "../types";

function caseOf(
  caseId: string,
  activities: string[],
  outcome: VariantCaseInput["outcome"] = "open",
): VariantCaseInput {
  const events: VariantEventRef[] = activities.map((activity, index) => ({
    eventId: `${caseId}-${index}`,
    eventType: activity,
    eventCategory: "task",
    occurredAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
  }));
  return { caseId, events, outcome };
}

describe("PROCESS-MINING-VARIANT-ISABELLA-FORMATTER", () => {
  it("describes the focus project's variant and the comparison in Spanish", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      caseOf("p1", ["TaskCreated", "TaskCompleted"], "success"),
      caseOf("p2", ["TaskCreated", "TaskBlocked"], "failure"),
    ]);
    const focus = analysis.assignments.find((a) => a.caseId === "p2") ?? null;
    const text = formatVariantAnalysisForIsabella(analysis, focus, "Torre Norte", "es");

    expect(text).toContain("Torre Norte");
    expect(text).toContain("Secuencia: Task Created → Task Blocked");
    expect(text).toContain("Ajuste frente a la variante más exitosa");
    expect(text).toContain("No realizadas vs referencia: Task Completed");
    expect(text).not.toContain("recomend"); // evidence-only, no recommendations
  });

  it("states explicitly when no reference exists (honesty guardrail)", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      caseOf("p1", ["TaskCreated", "TaskCompleted"]),
    ]);
    const focus = analysis.assignments[0] ?? null;
    const en = formatVariantAnalysisForIsabella(analysis, focus, "North Tower", "en");
    expect(en).toContain("No reference variant yet");
    expect(en).toContain("Nothing is inferred");
  });

  it("handles a project without events without inventing a path", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      caseOf("p1", ["TaskCreated"]),
    ]);
    const text = formatVariantAnalysisForIsabella(analysis, null, "Empty One", "en");
    expect(text).toContain("has no business events yet");
  });
});
