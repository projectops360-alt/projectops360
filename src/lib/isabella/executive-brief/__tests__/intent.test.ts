// ============================================================================
// Isabella Executive Brief (REG-023) — intent detection contract
// ============================================================================
// Binds the APPROVED question set (both languages, multi-intent) and the
// non-goals: task reports, definitions/how-to, and pure recommendation asks
// stay with their existing owners. Cue-based and generic — never per-phrase.
// ============================================================================

import { describe, it, expect } from "vitest";
import { detectExecutiveIntents, hasExecutiveIntent, intentGoals } from "@/lib/isabella/executive-brief/intent";

describe("detectExecutiveIntents — approved project-summary questions", () => {
  const summaryQuestions = [
    "Dame un resumen del proyecto.",
    "¿Cómo está el proyecto?",
    "¿Cuál es la salud del proyecto?",
    "¿Qué tareas requieren atención?",
    "¿Qué cambió recientemente?",
    "Give me a project summary.",
    "How is the project?",
    "What is the project health?",
    "Which tasks need attention?",
    "What changed recently?",
    "How are we doing?",
  ];
  for (const q of summaryQuestions) {
    it(`detects project_summary: "${q}"`, () => {
      expect(detectExecutiveIntents(q).projectSummary).toBe(true);
    });
  }
});

describe("detectExecutiveIntents — approved risk questions", () => {
  const riskQuestions = [
    "¿Cuáles son los riesgos actuales?",
    "¿Cuáles son los posibles riesgos que tengo hoy en el proyecto?",
    "¿Qué puede impedir que terminemos a tiempo?",
    "¿Estamos en riesgo de incumplir un milestone?",
    "What are the current risks?",
    "What could go wrong?",
    "Are we at risk of missing a milestone?",
    "Can we finish on time?",
  ];
  for (const q of riskQuestions) {
    it(`detects risk_outlook: "${q}"`, () => {
      expect(detectExecutiveIntents(q).riskOutlook).toBe(true);
    });
  }
});

describe("detectExecutiveIntents — multi-intent (P0 report case)", () => {
  it("detects BOTH goals in the reported question", () => {
    const intents = detectExecutiveIntents(
      "Mira, necesito que me des un resumen del proyecto. ¿Cuáles son los posibles riesgos que tengo hoy en el proyecto?",
    );
    expect(intents).toEqual({ projectSummary: true, riskOutlook: true });
    expect(intentGoals(intents)).toEqual(["project_summary", "risk_outlook"]);
  });

  it("detects both goals in one English sentence", () => {
    const intents = detectExecutiveIntents("Give me a project summary and tell me today's risks");
    expect(intents.projectSummary).toBe(true);
    expect(intents.riskOutlook).toBe(true);
  });
});

describe("detectExecutiveIntents — non-goals stay with their owners", () => {
  it("does NOT claim task reports (query engine owns them)", () => {
    expect(hasExecutiveIntent(detectExecutiveIntents("resumen de tareas por estado"))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("tareas sin milestone ordenadas por fecha"))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("report of blocked tasks"))).toBe(false);
  });

  it("does NOT claim definitions / how-to (knowledge corpus owns them)", () => {
    expect(hasExecutiveIntent(detectExecutiveIntents("¿Qué es un riesgo?"))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("what is the living graph"))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("¿Cómo registro un riesgo?"))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("How do I create a milestone?"))).toBe(false);
  });

  it("does NOT claim pure recommendation asks (PI engine owns them)", () => {
    expect(hasExecutiveIntent(detectExecutiveIntents("¿Qué debería resolver primero?"))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("What should I do next?"))).toBe(false);
  });

  it("detects nothing on empty input", () => {
    expect(hasExecutiveIntent(detectExecutiveIntents(""))).toBe(false);
    expect(hasExecutiveIntent(detectExecutiveIntents("   "))).toBe(false);
  });
});
