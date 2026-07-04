// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT — intent contract guards
// ============================================================================
// The deterministic-project-data policy is the foundation that prevents the
// reported "no verified answer" failure: a task report ALWAYS classifies as
// deterministic_project_report and requires deterministic retrieval. EN/ES +
// mixed-language examples are represented in the contract.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  INTENT_CATEGORY_CONTRACT,
  classifyIsabellaIntent,
  requiresDeterministicRetrieval,
} from "@/lib/isabella/process-intelligence/intent-contract";
import { ISABELLA_INTENT_CATEGORIES } from "@/lib/isabella/process-intelligence/types";

describe("intent contract", () => {
  it("declares every intent category with examples + behavior", () => {
    for (const cat of ISABELLA_INTENT_CATEGORIES) {
      const c = INTENT_CATEGORY_CONTRACT[cat];
      expect(c.category).toBe(cat);
      expect(c.examples.length).toBeGreaterThan(0);
      expect(c.behavior.length).toBeGreaterThan(0);
    }
  });

  it("represents the exact reported prompt + Spanish + mixed examples for reports", () => {
    const examples = INTENT_CATEGORY_CONTRACT.deterministic_project_report.examples;
    expect(examples).toContain("isabell anecesito un reporte con todas la tareas por title ordenado por desc");
    expect(examples.some((e) => /reporte de tareas/i.test(e))).toBe(true); // Spanish
    expect(examples.some((e) => /list all|show tasks/i.test(e))).toBe(true); // English
    expect(examples.some((e) => /por title/i.test(e))).toBe(true); // mixed ES/EN
  });

  it("classifies task report requests as deterministic_project_report (EN/ES/mixed)", () => {
    // Reuses the shipped conservative detectTaskReportIntent (report-noun or
    // all/todas qualifier). Broader phrasings without those cues are a KNOWN
    // LIMITATION widened by the Phase 5 · Task 2 retrieval layer.
    for (const q of [
      "isabell anecesito un reporte con todas la tareas por title ordenado por desc",
      "reporte de tareas",
      "list all tasks",
      "all tasks by title desc",
    ]) {
      const c = classifyIsabellaIntent(q);
      expect(c.category, q).toBe("deterministic_project_report");
      expect(c.deterministic, q).not.toBeNull();
    }
  });

  it("a deterministic report always requires deterministic retrieval (never generic reasoning)", () => {
    const c = classifyIsabellaIntent("reporte con todas las tareas por title desc");
    expect(requiresDeterministicRetrieval(c.category)).toBe(true);
    // non-report intents do not force deterministic retrieval
    expect(requiresDeterministicRetrieval("project_status_question")).toBe(false);
  });

  it("routes reasoning intents by keyword (future engines, not built here)", () => {
    expect(classifyIsabellaIntent("why is this milestone delayed?").category).toBe("root_cause_analysis");
    expect(classifyIsabellaIntent("¿cuáles son los próximos pasos?").category).toBe("recommendation_request");
    expect(classifyIsabellaIntent("¿en qué debo enfocarme hoy?").category).toBe("process_diagnosis");
    expect(classifyIsabellaIntent("how do I open Subtask Map?").category).toBe("navigation_or_how_to");
    // diagnosis/root-cause/recommendation engines are NOT implemented in Task 1
    expect(INTENT_CATEGORY_CONTRACT.process_diagnosis.implemented).toBe(false);
    expect(INTENT_CATEGORY_CONTRACT.root_cause_analysis.implemented).toBe(false);
    expect(INTENT_CATEGORY_CONTRACT.recommendation_request.implemented).toBe(false);
  });

  it("empty query → unsupported/missing context (never hallucinate)", () => {
    expect(classifyIsabellaIntent("").category).toBe("unsupported_or_missing_context");
    expect(classifyIsabellaIntent("   ").category).toBe("unsupported_or_missing_context");
  });
});
