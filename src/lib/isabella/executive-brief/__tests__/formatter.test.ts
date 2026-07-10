// ============================================================================
// Isabella Executive Brief (REG-023) — formatter & result-semantics contract
// ============================================================================
// Binds the approved answer shape: executive, record-backed, bilingual; the
// forbidden phrases never appear; "no records" ≠ "I can't"; registered risks
// vs detected signals are separate; data gaps are named honestly.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  collectRiskSignals,
  formatExecutiveBriefAnswer,
  riskExposure,
} from "@/lib/isabella/executive-brief/formatter";
import { briefingFixture, executiveDataFixture, EXPERT } from "./fixtures";

const BOTH = { projectSummary: true, riskOutlook: true };
const FORBIDDEN = [
  "solo puedo generar reportes",
  "I can only report on tasks",
  "no tengo información",
  "revisa el panel",
];

describe("formatExecutiveBriefAnswer — full multi-intent answer (es)", () => {
  const answer = formatExecutiveBriefAnswer(executiveDataFixture(), BOTH, "es", EXPERT);

  it("is grounded, verified and in Spanish", () => {
    expect(answer.grounded).toBe(true);
    expect(answer.tier).toBe("verified");
    expect(answer.language).toBe("es");
  });

  it("contains the summary section with real numbers", () => {
    expect(answer.answer).toContain("Torre Norte");
    expect(answer.answer).toContain("62% completado");
    expect(answer.answer).toContain("25/40 tareas");
    expect(answer.answer).toContain("Production Readiness");
  });

  it("separates registered risks from detected operational signals", () => {
    expect(answer.answer).toContain("Riesgos registrados (2):");
    expect(answer.answer).toContain("Integración con proveedor externo");
    expect(answer.answer).toContain("severidad alta");
    expect(answer.answer).toContain("Señales operativas detectadas:");
    expect(answer.answer).toContain("2 tarea(s) bloqueada(s)");
    expect(answer.answer).toContain("1 hito(s) en riesgo");
  });

  it("gives a deterministic recommended priority (blockers first)", () => {
    expect(answer.answer).toContain("La prioridad recomendada es resolver los 2 bloqueos activos");
  });

  it("closes with the evidence base and never uses forbidden phrases", () => {
    expect(answer.answer).toContain("Basado en las tareas, hitos, dependencias, riesgos y memoria");
    for (const phrase of FORBIDDEN) {
      expect(answer.answer.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});

describe("formatExecutiveBriefAnswer — English equivalence", () => {
  it("produces the same sections in English", () => {
    const answer = formatExecutiveBriefAnswer(executiveDataFixture(), BOTH, "en", EXPERT);
    expect(answer.language).toBe("en");
    expect(answer.answer).toContain("62% complete");
    expect(answer.answer).toContain("Registered risks (2):");
    expect(answer.answer).toContain("Detected operational signals:");
    expect(answer.answer).toContain("The recommended priority is resolving the 2 active blockers");
  });
});

describe("result semantics — empty vs gaps vs unreadable", () => {
  it('says "no formally registered risks" when the register is empty (never "I can\'t")', () => {
    const data = executiveDataFixture({
      registeredRisks: [],
      briefing: briefingFixture({ risks: { open: 0, high: 0, available: true } }),
    });
    const answer = formatExecutiveBriefAnswer(data, { projectSummary: false, riskOutlook: true }, "es", EXPERT);
    expect(answer.answer).toContain("No hay riesgos formalmente registrados en este proyecto.");
    expect(answer.answer.toLowerCase()).not.toContain("solo puedo");
  });

  it("reports an unreadable risk register honestly (execution error semantics)", () => {
    const data = executiveDataFixture({ registeredRisks: null });
    const answer = formatExecutiveBriefAnswer(data, { projectSummary: false, riskOutlook: true }, "es", EXPERT);
    expect(answer.answer).toContain("No pude leer el registro de riesgos");
    expect(answer.answer).not.toContain("Riesgos registrados (");
  });

  it("says there are no operational signals when execution is clean", () => {
    const clean = briefingFixture({
      execution: { activeBlockers: 0, waitingOnDependency: 0, atRiskMilestones: 0, overdue: 0 },
      capacity: { unassignedActive: 0, missingEstimateActive: 0, evaluable: true },
      memory: { recentDecisions: [], unresolvedActions: [], recentNotes: [], available: true },
      healthBand: "healthy",
    });
    const answer = formatExecutiveBriefAnswer(
      { briefing: clean, registeredRisks: [] },
      { projectSummary: false, riskOutlook: true },
      "es",
      EXPERT,
    );
    expect(answer.answer).toContain("No detecté señales operativas de riesgo");
  });

  it("names incomplete data as explicit gaps (no tasks / no milestones)", () => {
    const gappy = briefingFixture({ dataGaps: ["no_tasks", "no_milestones"] });
    const answer = formatExecutiveBriefAnswer(
      { briefing: gappy, registeredRisks: [] },
      BOTH,
      "es",
      EXPERT,
    );
    expect(answer.answer).toContain("Datos no evaluables:");
    expect(answer.answer).toContain("el proyecto aún no tiene tareas");
    expect(answer.answer).toContain("no hay hitos definidos");
  });
});

describe("deterministic signal + exposure helpers", () => {
  it("collects signals only from non-zero deterministic counts", () => {
    const signals = collectRiskSignals(briefingFixture());
    expect(signals.map((s) => s.key)).toEqual([
      "active_blockers",
      "overdue",
      "at_risk_milestones",
      "unassigned_active",
      "unresolved_actions",
    ]);
  });

  it("exposure is high with blockers + at-risk milestones, low when clean", () => {
    expect(riskExposure(briefingFixture(), 2, collectRiskSignals(briefingFixture()))).toBe("high");
    const clean = briefingFixture({
      execution: { activeBlockers: 0, waitingOnDependency: 0, atRiskMilestones: 0, overdue: 0 },
      capacity: { unassignedActive: 0, missingEstimateActive: 0, evaluable: true },
      memory: { recentDecisions: [], unresolvedActions: [], recentNotes: [], available: true },
      risks: { open: 0, high: 0, available: true },
    });
    expect(riskExposure(clean, 0, collectRiskSignals(clean))).toBe("low");
  });
});
