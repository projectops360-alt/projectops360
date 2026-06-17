// ============================================================================
// ProjectOps360° — Delivery Framework recommendation engine (pure, rule-based)
// ============================================================================
// Diagnoses the project context and recommends a delivery method with a
// confidence score, a plain-language reason, and a suggested setup. No AI
// needed (an AI variant lives in ai.ts); this is deterministic and instant.
// ============================================================================

import { boardTemplateFor, BOARD_TEMPLATES, MEETING_RHYTHM, DELIVERY_METHODS, type DeliveryMethod } from "./config";

export interface FrameworkInputs {
  projectType: string;
  uncertainty: string;        // low | medium | high
  governance: string;         // light | moderate | high | regulatory
  documentation: string;      // light | moderate | comprehensive | regulatory
  changeControl: string;      // none | recommended | major | all
  feedbackFreq: string;       // continuous | weekly | every_cycle | monthly | milestones | close
  vendorDep: string;          // none | low | medium | high
}

export interface FrameworkRecommendation {
  method: DeliveryMethod;
  confidence: number;         // 0-100
  reasonEs: string;
  reasonEn: string;
  cadence: string;            // value from CADENCE
  reviewCadence: string;
  governanceMode: string;
  boardTemplate: string;
  boardColumns: string[];
  meetingRhythm: { es: string; en: string }[];
}

const REGULATORY_TYPES = ["compliance"];
const PHASE_TYPES = ["construction", "erp", "procurement", "infrastructure" as string];

export function recommendFramework(i: FrameworkInputs): FrameworkRecommendation {
  const high = i.uncertainty === "high";
  const heavyGov = i.governance === "high" || i.governance === "regulatory";
  const heavyDocs = i.documentation === "comprehensive" || i.documentation === "regulatory";
  const strongChange = i.changeControl === "major" || i.changeControl === "all";
  const continuous = i.feedbackFreq === "continuous";
  const regulatory = i.governance === "regulatory" || i.documentation === "regulatory" || REGULATORY_TYPES.includes(i.projectType);

  let method: DeliveryMethod = "hybrid";
  let confidence = 70;
  let es = "", en = "";

  // Rule precedence (most specific first).
  if (regulatory) {
    method = heavyGov || strongChange ? "hybrid" : "predictive";
    confidence = 82;
    es = "El proyecto tiene requisitos regulatorios/de cumplimiento, por lo que necesita fases formales, documentación y control de cambios.";
    en = "The project has regulatory/compliance requirements, so it needs formal phases, documentation and change control.";
  } else if (i.projectType === "construction") {
    method = strongChange || heavyDocs ? "hybrid" : "predictive";
    confidence = 80;
    es = "En construcción/campo conviene fuerte control de hitos, inspecciones y cambios, con ejecución adaptativa donde aporte.";
    en = "Construction/field work benefits from strong milestone, inspection and change control, with adaptive execution where it helps.";
  } else if (i.projectType === "erp" && heavyGov) {
    method = "hybrid"; confidence = 84;
    es = "Un ERP con alta gobernanza requiere control ejecutivo por hitos y a la vez ejecución por ciclos adaptativos.";
    en = "An ERP with high governance needs executive milestone control plus adaptive cycle-based execution.";
  } else if (continuous && (i.projectType === "operations" || i.projectType === "procurement" || i.governance === "light")) {
    method = "kanban"; confidence = 78;
    es = "El trabajo es continuo y basado en solicitudes, ideal para un flujo Kanban con control de WIP.";
    en = "The work is continuous and request-based — ideal for a Kanban flow with WIP control.";
  } else if (high && heavyGov) {
    method = "hybrid"; confidence = 85;
    es = "Alta incertidumbre con gobernanza fuerte: combina control formal con ciclos cortos de feedback y planeación adaptativa.";
    en = "High uncertainty with strong governance: combine formal control with short feedback cycles and adaptive planning.";
  } else if (high) {
    method = i.projectType === "software" || i.projectType === "data_bi" ? "scrum" : "agile";
    confidence = 80;
    es = "Alta incertidumbre con gobernanza ligera/moderada: una ejecución ágil/adaptativa por ciclos cortos reduce el riesgo.";
    en = "High uncertainty with light/moderate governance: agile/adaptive short-cycle execution reduces risk.";
  } else if (heavyDocs || heavyGov) {
    method = "hybrid"; confidence = 74;
    es = "Documentación o gobernanza exigentes: un modelo híbrido da control formal sin perder agilidad en la ejecución.";
    en = "Demanding documentation or governance: a hybrid model gives formal control without losing execution agility.";
  } else if (i.uncertainty === "low" && (i.documentation === "comprehensive" || PHASE_TYPES.includes(i.projectType))) {
    method = "predictive"; confidence = 76;
    es = "Alcance estable y entrega por fases: un enfoque predictivo/cascada con hitos y entregas formales es lo más eficiente.";
    en = "Stable scope and phase-based delivery: a predictive/waterfall approach with milestones and formal handoffs is most efficient.";
  } else {
    method = "hybrid"; confidence = 68;
    es = "El contexto mezcla control y adaptación: un modelo híbrido equilibra gobernanza con feedback frecuente.";
    en = "The context mixes control and adaptation: a hybrid model balances governance with frequent feedback.";
  }

  // Suggested cadence & review.
  const cadence = method === "kanban" ? "continuous"
    : method === "predictive" ? "phase"
    : i.uncertainty === "high" ? "biweekly" : "monthly";
  const reviewCadence = method === "kanban" ? "continuous"
    : heavyGov ? "monthly" : "every_cycle";
  const governanceMode = i.governance || (heavyGov ? "high" : "moderate");
  const boardTemplate = boardTemplateFor(method, i.projectType);

  return {
    method, confidence,
    reasonEs: es, reasonEn: en,
    cadence, reviewCadence, governanceMode,
    boardTemplate,
    boardColumns: BOARD_TEMPLATES[boardTemplate] ?? BOARD_TEMPLATES.generic,
    meetingRhythm: MEETING_RHYTHM[method],
  };
}

/** One-line plain summary of a recommendation. */
export function recommendationHeadline(rec: FrameworkRecommendation, isEs: boolean): string {
  const m = DELIVERY_METHODS[rec.method];
  return `${isEs ? m.es : m.en} · ${rec.confidence}%`;
}
