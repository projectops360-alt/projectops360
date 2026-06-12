// ============================================================================
// ProjectOps360° — Variance Cause Classification Engine
// ============================================================================
// Deterministic cause classification for productivity variance. Examines
// readiness gaps, blockers, resource constraints, rework, capacity gaps,
// and other signals to identify the likely process cause of variance.
//
// Process-centered language: NEVER blames individual workers or crews.
// Always frames causes as process, system, or organizational failures.
//
// No database calls — operates on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
// ============================================================================

import type {
  ConstructionActivity,
  I18nField,
  Locale,
  TradeTaxonomy,
  ActivityDependency,
  LaborResource,
  ReadinessChecklistItem,
  ReadinessCriterion,
} from "@/types/database";
import { getI18nValue, getDelayReason } from "@/types/database";
import type {
  ActivityVarianceMetrics,
  LaborVarianceResult,
  VarianceSeverity,
  ProductivityAssessment,
} from "./labor-variance";
import type { WeeklyCapacityGap } from "./capacity";
import type { WorkfaceReadinessResult } from "./workface-readiness";
import { computeWorkfaceReadiness } from "./workface-readiness";
import type { LookaheadBlocker } from "./lookahead";

// ── Cause Categories ──────────────────────────────────────────────────────────

/** Process-centered cause categories for productivity variance.
 *  These always describe process or system failures, never worker attributes. */
export type VarianceCauseCategory =
  | "material_delay"
  | "rfi_unresolved"
  | "drawing_revision"
  | "permit_delay"
  | "area_access"
  | "predecessor_delay"
  | "crew_shortage"
  | "skill_mismatch"
  | "vendor_unconfirmed"
  | "resource_over_allocation"
  | "rework_quality"
  | "commissioning_complexity"
  | "production_rate_gap"
  | "crew_size_exceeded"
  | "unclassified";

/** Types of evidence signals that contribute to cause classification. */
export type EvidenceSignalType =
  | "readiness_gap"
  | "blocker"
  | "capacity_gap"
  | "resource_constraint"
  | "variance_metric"
  | "rework_cycle"
  | "delay_reason"
  | "dependency_delay"
  | "commissioning_level";

/** A single piece of evidence that contributed to a cause classification. */
export interface EvidenceSignal {
  /** What type of evidence this is. */
  signalType: EvidenceSignalType;
  /** Which subsystem produced this signal. */
  source: string;
  /** Bilingual description of what was found. */
  description: I18nField;
  /** How much weight this signal contributed to the confidence score. */
  weight: number;
}

/** A classified cause with confidence, evidence, and recommendation. */
export interface VarianceCauseClassification {
  /** The cause category identified. */
  cause: VarianceCauseCategory;
  /** Confidence score (0-1) based on evidence strength. */
  confidence: number;
  /** Bilingual explanation of why this cause was identified. */
  evidenceSummary: I18nField;
  /** Bilingual specific process improvement recommendation. */
  recommendedImprovement: I18nField;
  /** Which evidence signals contributed to this classification. */
  evidenceSignals: EvidenceSignal[];
}

/** Complete cause classification result for a single activity. */
export interface VarianceCauseResult {
  /** Activity key this result is for. */
  activityKey: string;
  /** The highest-confidence cause identified (or "unclassified" with confidence 0). */
  likelyCause: VarianceCauseClassification;
  /** Causes with confidence >= 0.5 (contributing causes). */
  contributingCauses: VarianceCauseClassification[];
  /** All identified causes sorted by confidence descending (confidence > 0 only). */
  allCauses: VarianceCauseClassification[];
  /** Variance percentage not explained by identified causes, or null if untracked. */
  unexplainedVariancePct: number | null;
  /** Bilingual summary sentence describing the overall classification. */
  summarySentence: I18nField;
}

// ── UI Constants ──────────────────────────────────────────────────────────────

/** Human-readable labels for cause categories (bilingual). */
export const VARIANCE_CAUSE_LABELS: Record<VarianceCauseCategory, I18nField> = {
  material_delay: { en: "Material Delay", es: "Retraso de Material" },
  rfi_unresolved: { en: "Unresolved RFI", es: "RFI No Resuelta" },
  drawing_revision: { en: "Drawing Revision", es: "Revisión de Planos" },
  permit_delay: { en: "Permit Delay", es: "Retraso de Permiso" },
  area_access: { en: "Area Access", es: "Acceso al Área" },
  predecessor_delay: { en: "Predecessor Delay", es: "Retraso de Predecesor" },
  crew_shortage: { en: "Crew Shortage", es: "Escasez de Cuadrilla" },
  skill_mismatch: { en: "Skill Mismatch", es: "Desajuste de Habilidades" },
  vendor_unconfirmed: { en: "Vendor Unconfirmed", es: "Proveedor No Confirmado" },
  resource_over_allocation: {
    en: "Resource Over-Allocation",
    es: "Sobre-asignación de Recursos",
  },
  rework_quality: {
    en: "Rework / Quality Process",
    es: "Retrabajo / Proceso de Calidad",
  },
  commissioning_complexity: {
    en: "Commissioning Complexity",
    es: "Complejidad de Comisionamiento",
  },
  production_rate_gap: {
    en: "Production Rate Gap",
    es: "Brecha en Tasa de Producción",
  },
  crew_size_exceeded: {
    en: "Crew Size Exceeded",
    es: "Tamaño de Cuadrilla Excedido",
  },
  unclassified: { en: "Unclassified", es: "Sin Clasificar" },
};

/** Lucide icon names for cause categories. */
export const VARIANCE_CAUSE_ICONS: Record<VarianceCauseCategory, string> = {
  material_delay: "Package",
  rfi_unresolved: "HelpCircle",
  drawing_revision: "FileEdit",
  permit_delay: "Shield",
  area_access: "MapPin",
  predecessor_delay: "ArrowRight",
  crew_shortage: "Users",
  skill_mismatch: "GraduationCap",
  vendor_unconfirmed: "Truck",
  resource_over_allocation: "Split",
  rework_quality: "RefreshCw",
  commissioning_complexity: "Settings",
  production_rate_gap: "TrendingDown",
  crew_size_exceeded: "UserPlus",
  unclassified: "QuestionMarkCircle",
};

/** Tailwind CSS classes for cause category badges. */
export const VARIANCE_CAUSE_COLORS: Record<
  VarianceCauseCategory,
  { bg: string; text: string; border: string }
> = {
  material_delay: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  rfi_unresolved: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  drawing_revision: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  permit_delay: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
  area_access: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  predecessor_delay: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  crew_shortage: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
  },
  skill_mismatch: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
  vendor_unconfirmed: {
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-200 dark:border-fuchsia-800",
  },
  resource_over_allocation: {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
  },
  rework_quality: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-800",
  },
  commissioning_complexity: {
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
  },
  production_rate_gap: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
  crew_size_exceeded: {
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
  },
  unclassified: {
    bg: "bg-gray-50 dark:bg-gray-950/30",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-800",
  },
};

/** Confidence level thresholds and labels. */
export const CONFIDENCE_LEVELS: Record<
  "high" | "moderate" | "low",
  { threshold: number; label: I18nField }
> = {
  high: {
    threshold: 0.7,
    label: { en: "High Confidence", es: "Alta Confianza" },
  },
  moderate: {
    threshold: 0.4,
    label: { en: "Moderate Confidence", es: "Confianza Moderada" },
  },
  low: {
    threshold: 0.1,
    label: { en: "Low Confidence", es: "Baja Confianza" },
  },
};

// ── Improvement Templates ──────────────────────────────────────────────────────

/** Process improvement recommendations for each cause category (bilingual). */
const IMPROVEMENT_TEMPLATES: Record<VarianceCauseCategory, I18nField> = {
  material_delay: {
    en: "Implement material tracking with 48-hour advance confirmation requirement.",
    es: "Implementar seguimiento de materiales con requisito de confirmación con 48 horas de anticipación.",
  },
  rfi_unresolved: {
    en: "Establish RFI response SLA of 48 hours with escalation protocol.",
    es: "Establecer SLA de respuesta a RFI de 48 horas con protocolo de escalamiento.",
  },
  drawing_revision: {
    en: "Implement drawing revision verification workflow with automatic status checks before activity start.",
    es: "Implementar flujo de verificación de revisión de planos con verificación automática de estado antes del inicio de la actividad.",
  },
  permit_delay: {
    en: "Create permit acquisition timeline with 2-week lead time and escalation at 72 hours before activity start.",
    es: "Crear cronograma de adquisición de permisos con 2 semanas de anticipación y escalamiento 72 horas antes del inicio de la actividad.",
  },
  area_access: {
    en: "Implement area release scheduling with cross-trade coordination protocol.",
    es: "Implementar programación de liberación de áreas con protocolo de coordinación entre oficios.",
  },
  predecessor_delay: {
    en: "Implement predecessor completion tracking with automatic successor readiness checks.",
    es: "Implementar seguimiento de completitud de predecesores con verificación automática de preparación de sucesores.",
  },
  crew_shortage: {
    en: "Establish crew allocation planning with 2-week lookahead and reinforcement hiring trigger.",
    es: "Establecer planificación de asignación de cuadrillas con mirada de 2 semanas y activación de contratación de refuerzo.",
  },
  skill_mismatch: {
    en: "Implement skill verification checklist with senior supervision requirement for commissioning-level activities.",
    es: "Implementar lista de verificación de habilidades con requisito de supervisión senior para actividades de nivel de comisionamiento.",
  },
  vendor_unconfirmed: {
    en: "Implement vendor confirmation protocol with 4-week advance booking and alternative vendor identification.",
    es: "Implementar protocolo de confirmación de proveedores con reserva de 4 semanas de anticipación e identificación de proveedor alternativo.",
  },
  resource_over_allocation: {
    en: "Implement dedicated resource allocation policy with cross-project conflict resolution before activity start.",
    es: "Implementar política de asignación dedicada de recursos con resolución de conflictos entre proyectos antes del inicio de la actividad.",
  },
  rework_quality: {
    en: "Implement scope clarification review at activity start and quality checkpoint at 50% completion.",
    es: "Implementar revisión de clarificación de alcance al inicio de la actividad y punto de control de calidad al 50% de completitud.",
  },
  commissioning_complexity: {
    en: "Implement phased commissioning protocol with dedicated commissioning supervision and extended QA checkpoints.",
    es: "Implementar protocolo de comisionamiento por fases con supervisión dedicada de comisionamiento y puntos de control de QA extendidos.",
  },
  production_rate_gap: {
    en: "Implement production rate monitoring with daily standup review when rate falls below 85% of plan.",
    es: "Implementar monitoreo de tasa de producción con revisión diaria de standup cuando la tasa cae por debajo del 85% del plan.",
  },
  crew_size_exceeded: {
    en: "Implement crew sizing governance with variance analysis when actual crew exceeds plan by more than 15%.",
    es: "Implementar gobernanza de dimensionamiento de cuadrilla con análisis de varianza cuando la cuadrilla real excede el plan por más del 15%.",
  },
  unclassified: {
    en: "Recommend detailed variance analysis to identify root cause. Consider adding more tracking data points.",
    es: "Recomendar análisis detallado de varianza para identificar causa raíz. Considerar agregar más puntos de datos de seguimiento.",
  },
};

// ── Delay Reason Keyword Maps ─────────────────────────────────────────────────

/** Bilingual keywords for matching delay reasons to cause categories. */
const DELAY_REASON_KEYWORDS: Record<
  VarianceCauseCategory,
  { en: string[]; es: string[] }
> = {
  material_delay: {
    en: ["material", "delivery", "supplier", "shipping", "logistics", "inventory"],
    es: ["material", "entrega", "proveedor", "envío", "logística", "inventario"],
  },
  rfi_unresolved: {
    en: ["rfi", "request for information", "clarification", "question"],
    es: ["rfi", "solicitud de información", "clarificación", "pregunta"],
  },
  drawing_revision: {
    en: ["drawing", "plan", "revision", "blueprint", "design change"],
    es: ["plano", "revisión", "diseño", "cambio de diseño", "planos"],
  },
  permit_delay: {
    en: ["permit", "safety", "inspection", "approval", "compliance"],
    es: ["permiso", "seguridad", "inspección", "aprobación", "cumplimiento"],
  },
  area_access: {
    en: ["area", "access", "zone", "release", "space", "room"],
    es: ["área", "acceso", "zona", "liberación", "espacio", "sala"],
  },
  predecessor_delay: {
    en: ["predecessor", "dependency", "upstream", "prior work"],
    es: ["predecesor", "dependencia", "trabajo previo", "actividad anterior"],
  },
  crew_shortage: {
    en: ["crew", "labor", "workforce", "staffing", "manpower", "shortage"],
    es: ["cuadrilla", "mano de obra", "personal", "dotación", "escasez"],
  },
  skill_mismatch: {
    en: ["skill", "qualification", "certification", "experience"],
    es: ["habilidad", "calificación", "certificación", "experiencia"],
  },
  vendor_unconfirmed: {
    en: ["vendor", "supplier", "contractor", "subcontractor"],
    es: ["proveedor", "contratista", "subcontratista", "vendedor"],
  },
  resource_over_allocation: {
    en: ["over allocated", "over-allocated", "concurrent", "multi-project", "over committed"],
    es: ["sobre-asignado", "concurrente", "multi-proyecto", "sobre-comprometido"],
  },
  rework_quality: {
    en: ["rework", "quality", "defect", "correction", "rejection", "punch list"],
    es: ["retrabajo", "calidad", "defecto", "corrección", "rechazo", "lista de verificación"],
  },
  commissioning_complexity: {
    en: ["commissioning", "testing", "startup", "verification", "functional test"],
    es: ["comisionamiento", "pruebas", "arranque", "verificación", "prueba funcional"],
  },
  production_rate_gap: {
    en: ["production rate", "productivity", "output", "throughput", "pace"],
    es: ["tasa de producción", "productividad", "rendimiento", "ritmo"],
  },
  crew_size_exceeded: {
    en: ["crew size", "overstaff", "extra crew", "staffing exceeded"],
    es: ["tamaño de cuadrilla", "exceso de personal", "cuadrilla extra"],
  },
  unclassified: { en: [], es: [] },
};

// ── Internal Types ────────────────────────────────────────────────────────────

/** Parameters for building evidence summary sentences. */
interface EvidenceTemplateParams {
  activityName: string;
  variancePct: string;
  tradeLabel: string;
  reworkCount: number;
  commissioningLevel: string;
  productivityAssessment: string;
}

/** Result of evaluating a single cause category. */
interface CauseEvaluation {
  cause: VarianceCauseCategory;
  signals: EvidenceSignal[];
  rawConfidence: number;
  crossValidationBoost: boolean;
}

// ── Helper Functions ───────────────────────────────────────────────────────────

/** Round a number to `decimals` decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Check if a bilingual delay reason contains keywords for a given cause. */
function delayReasonMatchesCause(
  delayReason: I18nField | null,
  cause: VarianceCauseCategory
): boolean {
  if (!delayReason) return false;
  const keywords = DELAY_REASON_KEYWORDS[cause];
  if (!keywords) return false;

  const enText = (getI18nValue(delayReason, "en") ?? "").toLowerCase();
  const esText = (getI18nValue(delayReason, "es") ?? "").toLowerCase();

  const allKeywords = [...keywords.en, ...keywords.es];
  return allKeywords.some(
    (kw) => enText.includes(kw) || esText.includes(kw)
  );
}

/** Resolve trade label from taxonomy. */
function resolveTradeLabel(
  tradeKey: string,
  taxonomy: TradeTaxonomy[]
): string {
  const trade = taxonomy.find((t) => t.trade_key === tradeKey);
  if (trade) {
    return getI18nValue(trade.label_i18n, "en") ?? tradeKey;
  }
  return tradeKey;
}

/** Filter blockers for a specific activity. */
function filterBlockersForActivity(
  blockers: LookaheadBlocker[],
  activityKey: string
): LookaheadBlocker[] {
  return blockers.filter((b) => b.activityKey === activityKey);
}

/** Filter capacity gaps relevant to a specific activity. */
function filterCapacityGapsForActivity(
  capacityGaps: WeeklyCapacityGap[],
  activity: ConstructionActivity
): WeeklyCapacityGap[] {
  return capacityGaps.filter(
    (g) =>
      g.tradeKey === activity.required_trade_key &&
      g.affectedActivityKeys.includes(activity.activity_key)
  );
}

/** Filter resources assigned to a specific activity. */
function filterResourcesForActivity(
  resources: LaborResource[],
  activity: ConstructionActivity
): LaborResource[] {
  return resources.filter((r) =>
    activity.assigned_resource_keys.includes(r.resource_key)
  );
}

/** Check if a readiness criterion is missing (required but not completed). */
function isReadinessGap(
  readiness: WorkfaceReadinessResult | null,
  criterion: ReadinessCriterion
): boolean {
  if (!readiness) return false;
  return readiness.missingPrerequisites.some(
    (item) => item.item_key === criterion
  );
}

/** Get missing prerequisite keys from readiness result. */
function getMissingKeys(
  readiness: WorkfaceReadinessResult | null
): Set<ReadinessCriterion> {
  if (!readiness) return new Set();
  return new Set(
    readiness.missingPrerequisites.map((item) => item.item_key)
  );
}

/** Check if a specific blocker type exists for this activity. */
function hasBlockerType(
  activityBlockers: LookaheadBlocker[],
  blockerType: string
): LookaheadBlocker | undefined {
  return activityBlockers.find((b) => b.blockerType === blockerType);
}

/** Build an EvidenceSignal with bilingual description. */
function signal(
  signalType: EvidenceSignalType,
  source: string,
  en: string,
  es: string,
  weight: number
): EvidenceSignal {
  return {
    signalType,
    source,
    description: { en, es },
    weight,
  };
}

/** Build an unclassified result for activities with no variance data. */
function buildUnclassifiedResult(activityKey: string): VarianceCauseResult {
  return {
    activityKey,
    likelyCause: {
      cause: "unclassified",
      confidence: 0,
      evidenceSummary: {
        en: `No variance data available for "${activityKey}" — cause classification requires tracked actuals.`,
        es: `Sin datos de varianza disponibles para "${activityKey}" — la clasificación de causa requiere datos reales registrados.`,
      },
      recommendedImprovement: IMPROVEMENT_TEMPLATES.unclassified,
      evidenceSignals: [],
    },
    contributingCauses: [],
    allCauses: [],
    unexplainedVariancePct: null,
    summarySentence: {
      en: `Variance cause could not be classified for "${activityKey}" — no tracking data available.`,
      es: `La causa de varianza no pudo ser clasificada para "${activityKey}" — sin datos de seguimiento disponibles.`,
    },
  };
}

/** Build the classification for a specific cause. */
function buildClassification(
  cause: VarianceCauseCategory,
  confidence: number,
  signals: EvidenceSignal[],
  params: EvidenceTemplateParams
): VarianceCauseClassification {
  const template = CAUSE_EVIDENCE_TEMPLATES[cause];
  return {
    cause,
    confidence: roundTo(confidence, 2),
    evidenceSummary: {
      en: template.buildEn(params),
      es: template.buildEs(params),
    },
    recommendedImprovement: IMPROVEMENT_TEMPLATES[cause],
    evidenceSignals: signals,
  };
}

// ── Evidence Template Builders ────────────────────────────────────────────────

const CAUSE_EVIDENCE_TEMPLATES: Record<
  VarianceCauseCategory,
  {
    buildEn: (p: EvidenceTemplateParams) => string;
    buildEs: (p: EvidenceTemplateParams) => string;
  }
> = {
  material_delay: {
    buildEn: (p) =>
      `Material delivery was not confirmed onsite before work began on "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `La entrega de material no fue confirmada en sitio antes de comenzar el trabajo en "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  rfi_unresolved: {
    buildEn: (p) =>
      `An RFI was not answered before work started on "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `Una Solicitud de Información (RFI) no fue respondida antes de iniciar el trabajo en "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  drawing_revision: {
    buildEn: (p) =>
      `Drawings were not confirmed current before work began on "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `Los planos no fueron confirmados como vigentes antes de comenzar el trabajo en "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  permit_delay: {
    buildEn: (p) =>
      `Permit or safety approval was not obtained before work began on "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `El permiso o aprobación de seguridad no fue obtenido antes de comenzar el trabajo en "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  area_access: {
    buildEn: (p) =>
      `The work area was not released before work began on "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `El área de trabajo no fue liberada antes de comenzar el trabajo en "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  predecessor_delay: {
    buildEn: (p) =>
      `A predecessor activity was not completed before "${p.activityName}" was scheduled to start, contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `Una actividad predecesora no fue completada antes de que "${p.activityName}" estuviera programada para iniciar, contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  crew_shortage: {
    buildEn: (p) =>
      `Crew allocation for the ${p.tradeLabel} trade was below planned staffing level on "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `La asignación de cuadrilla para el oficio ${p.tradeLabel} estaba por debajo del nivel planificado en "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  skill_mismatch: {
    buildEn: (p) =>
      `Assigned crew skill level may not fully meet the requirements for "${p.activityName}", indicating a process gap in skill verification.`,
    buildEs: (p) =>
      `El nivel de habilidad de la cuadrilla asignada puede no cumplir completamente con los requisitos para "${p.activityName}", indicando una brecha de proceso en la verificación de habilidades.`,
  },
  vendor_unconfirmed: {
    buildEn: (p) =>
      `A vendor resource was not confirmed for "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `Un recurso de proveedor no fue confirmado para "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  resource_over_allocation: {
    buildEn: (p) =>
      `A resource was allocated across multiple concurrent projects on "${p.activityName}", reducing effective capacity and contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `Un recurso fue asignado a múltiples proyectos concurrentes en "${p.activityName}", reduciendo la capacidad efectiva y contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  rework_quality: {
    buildEn: (p) =>
      `${p.reworkCount} rework cycle${p.reworkCount > 1 ? "s were" : " was"} identified on "${p.activityName}", indicating scope clarification or quality process gaps that contributed to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `${p.reworkCount} ciclo${p.reworkCount > 1 ? "s" : ""} de retrabajo ${p.reworkCount > 1 ? "fueron" : "fue"} identificado${p.reworkCount > 1 ? "s" : ""} en "${p.activityName}", indicando brechas de proceso en la clarificación del alcance o calidad que contribuyeron al exceso de ${p.variancePct}% en horas.`,
  },
  commissioning_complexity: {
    buildEn: (p) =>
      `Commissioning level ${p.commissioningLevel} introduces inherent process complexity for "${p.activityName}", contributing to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `El nivel de comisionamiento ${p.commissioningLevel} introduce complejidad de proceso inherente para "${p.activityName}", contribuyendo al exceso de ${p.variancePct}% en horas.`,
  },
  production_rate_gap: {
    buildEn: (p) =>
      `Production rate was ${p.productivityAssessment === "stalled" ? "stalled" : "below plan"} on "${p.activityName}", indicating scope or process misalignment that contributed to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `La tasa de producción estuvo ${p.productivityAssessment === "stalled" ? "detenida" : "debajo del plan"} en "${p.activityName}", indicando desalineación de alcance o proceso que contribuyó al exceso de ${p.variancePct}% en horas.`,
  },
  crew_size_exceeded: {
    buildEn: (p) =>
      `Crew allocation exceeded planned staffing level on "${p.activityName}", indicating scope creep or process inefficiency that contributed to the ${p.variancePct}% hours overrun.`,
    buildEs: (p) =>
      `La asignación de cuadrilla excedió el nivel planificado en "${p.activityName}", indicando desviación de alcance o ineficiencia de proceso que contribuyó al exceso de ${p.variancePct}% en horas.`,
  },
  unclassified: {
    buildEn: (p) =>
      `No specific process cause was identified for the variance on "${p.activityName}".`,
    buildEs: (p) =>
      `No se identificó una causa de proceso específica para la varianza en "${p.activityName}".`,
  },
};

// ── Per-Cause Evaluators ──────────────────────────────────────────────────────

function evaluateMaterialDelay(
  readiness: WorkfaceReadinessResult | null,
  activityBlockers: LookaheadBlocker[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  // Readiness gap: material_onsite missing
  if (isReadinessGap(readiness, "material_onsite")) {
    confidence += 0.50;
    signals.push(
      signal(
        "readiness_gap",
        "readiness_checklist",
        "Material onsite prerequisite not completed",
        "Prerrequisito de material en sitio no completado",
        0.50
      )
    );
  }

  // Blocker: checklist_incomplete
  if (hasBlockerType(activityBlockers, "checklist_incomplete")) {
    confidence += 0.25;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Checklist incomplete blocker identified",
        "Bloqueador de lista de verificación incompleta identificado",
        0.25
      )
    );
  }

  // Delay reason keyword
  if (delayReasonMatchesCause(delayReason, "material_delay")) {
    confidence += 0.25;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions material or delivery",
        "Razón de retraso menciona material o entrega",
        0.25
      )
    );
  }

  return {
    cause: "material_delay",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateRfiUnresolved(
  readiness: WorkfaceReadinessResult | null,
  activityBlockers: LookaheadBlocker[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (isReadinessGap(readiness, "rfi_answered")) {
    confidence += 0.50;
    signals.push(
      signal(
        "readiness_gap",
        "readiness_checklist",
        "RFI prerequisite not completed",
        "Prerrequisito de RFI no completado",
        0.50
      )
    );
  }

  if (hasBlockerType(activityBlockers, "checklist_incomplete")) {
    confidence += 0.25;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Checklist incomplete blocker identified",
        "Bloqueador de lista de verificación incompleta identificado",
        0.25
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "rfi_unresolved")) {
    confidence += 0.25;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions RFI or clarification",
        "Razón de retraso menciona RFI o clarificación",
        0.25
      )
    );
  }

  return {
    cause: "rfi_unresolved",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateDrawingRevision(
  readiness: WorkfaceReadinessResult | null,
  activityBlockers: LookaheadBlocker[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (isReadinessGap(readiness, "drawing_current")) {
    confidence += 0.50;
    signals.push(
      signal(
        "readiness_gap",
        "readiness_checklist",
        "Drawing currency prerequisite not completed",
        "Prerrequisito de plano vigente no completado",
        0.50
      )
    );
  }

  if (hasBlockerType(activityBlockers, "checklist_incomplete")) {
    confidence += 0.25;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Checklist incomplete blocker identified",
        "Bloqueador de lista de verificación incompleta identificado",
        0.25
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "drawing_revision")) {
    confidence += 0.25;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions drawing or revision",
        "Razón de retraso menciona plano o revisión",
        0.25
      )
    );
  }

  return {
    cause: "drawing_revision",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluatePermitDelay(
  readiness: WorkfaceReadinessResult | null,
  activityBlockers: LookaheadBlocker[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  // Permit gaps are inherently high-severity per workface-readiness
  if (isReadinessGap(readiness, "permit_ready")) {
    confidence += 0.55;
    signals.push(
      signal(
        "readiness_gap",
        "readiness_checklist",
        "Permit/safety prerequisite not completed",
        "Prerrequisito de permiso/seguridad no completado",
        0.55
      )
    );
  }

  if (hasBlockerType(activityBlockers, "checklist_incomplete")) {
    confidence += 0.25;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Checklist incomplete blocker identified",
        "Bloqueador de lista de verificación incompleta identificado",
        0.25
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "permit_delay")) {
    confidence += 0.20;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions permit or safety approval",
        "Razón de retraso menciona permiso o aprobación de seguridad",
        0.20
      )
    );
  }

  return {
    cause: "permit_delay",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateAreaAccess(
  readiness: WorkfaceReadinessResult | null,
  activityBlockers: LookaheadBlocker[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (isReadinessGap(readiness, "area_released")) {
    confidence += 0.50;
    signals.push(
      signal(
        "readiness_gap",
        "readiness_checklist",
        "Area release prerequisite not completed",
        "Prerrequisito de liberación de área no completado",
        0.50
      )
    );
  }

  if (hasBlockerType(activityBlockers, "checklist_incomplete")) {
    confidence += 0.25;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Checklist incomplete blocker identified",
        "Bloqueador de lista de verificación incompleta identificado",
        0.25
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "area_access")) {
    confidence += 0.25;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions area access or release",
        "Razón de retraso menciona acceso al área o liberación",
        0.25
      )
    );
  }

  return {
    cause: "area_access",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluatePredecessorDelay(
  readiness: WorkfaceReadinessResult | null,
  activityBlockers: LookaheadBlocker[],
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  activityKey: string,
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (isReadinessGap(readiness, "predecessor_complete")) {
    confidence += 0.35;
    signals.push(
      signal(
        "readiness_gap",
        "readiness_checklist",
        "Predecessor completion prerequisite not met",
        "Prerrequisito de predecesor completo no cumplido",
        0.35
      )
    );
  }

  if (hasBlockerType(activityBlockers, "unmet_dependency")) {
    confidence += 0.45;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Unmet dependency blocker identified",
        "Bloqueador de dependencia no cumplida identificado",
        0.45
      )
    );
  }

  // Check if any predecessor is not completed
  const predecessorIds = dependencies
    .filter((d) => d.successor_id === activityKey || d.successor_id === "")
    .map((d) => d.predecessor_id);
  const activityMap = new Map(allActivities.map((a) => [a.id, a]));
  const incompletePredecessors = predecessorIds.filter((pid) => {
    const pred = activityMap.get(pid);
    return pred && pred.status !== "completed";
  });
  if (incompletePredecessors.length > 0) {
    confidence += 0.20;
    signals.push(
      signal(
        "dependency_delay",
        "dependencies",
        `${incompletePredecessors.length} predecessor(s) not completed`,
        `${incompletePredecessors.length} predecesor(es) no completado(s)`,
        0.20
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "predecessor_delay")) {
    confidence += 0.15;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions predecessor or dependency",
        "Razón de retraso menciona predecesor o dependencia",
        0.15
      )
    );
  }

  return {
    cause: "predecessor_delay",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateCrewShortage(
  activityBlockers: LookaheadBlocker[],
  capacityGapsForActivity: WeeklyCapacityGap[],
  metrics: ActivityVarianceMetrics,
  activity: ConstructionActivity,
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (hasBlockerType(activityBlockers, "labor_shortage")) {
    confidence += 0.40;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Labor shortage blocker identified",
        "Bloqueador de escasez laboral identificado",
        0.40
      )
    );
  }

  if (capacityGapsForActivity.length > 0) {
    const worstRisk = capacityGapsForActivity.some(
      (g) => g.shortageRisk === "critical" || g.shortageRisk === "high"
    );
    confidence += worstRisk ? 0.35 : 0.20;
    signals.push(
      signal(
        "capacity_gap",
        "labor_capacity",
        worstRisk
          ? "Critical/high capacity gap for this trade"
          : "Capacity gap identified for this trade",
        worstRisk
          ? "Brecha de capacidad crítica/alta para este oficio"
          : "Brecha de capacidad identificada para este oficio",
        worstRisk ? 0.35 : 0.20
      )
    );
  }

  if (metrics.crewRatio !== null && metrics.crewRatio < 0.85) {
    confidence += 0.25;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        `Crew ratio ${roundTo(metrics.crewRatio, 2)} is below 85% of planned level`,
        `Ratio de cuadrilla ${roundTo(metrics.crewRatio, 2)} está por debajo del 85% del nivel planificado`,
        0.25
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "crew_shortage")) {
    confidence += 0.15;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions crew or labor shortage",
        "Razón de retraso menciona cuadrilla o escasez laboral",
        0.15
      )
    );
  }

  return {
    cause: "crew_shortage",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateSkillMismatch(
  assignedResources: LaborResource[],
  activity: ConstructionActivity
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  const commissioningLevel = activity.commissioning_level;

  // Check if apprentice-level resource assigned to commissioning work
  const hasApprenticeOnHighLevel =
    commissioningLevel &&
    ["L3", "L4", "L5", "L6"].includes(commissioningLevel) &&
    assignedResources.some((r) => r.skill_level === "apprentice");

  if (hasApprenticeOnHighLevel) {
    confidence += 0.40;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Apprentice-level resource assigned to commissioning-level activity",
        "Recurso de nivel aprendiz asignado a actividad de nivel de comisionamiento",
        0.40
      )
    );
  }

  // Check for partial availability constraint
  const hasPartial = assignedResources.some(
    (r) =>
      r.constraints &&
      typeof r.constraints === "object" &&
      "type" in r.constraints &&
      r.constraints.type === "partial"
  );

  if (hasPartial) {
    confidence += 0.20;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Resource with partial availability assigned",
        "Recurso con disponibilidad parcial asignado",
        0.20
      )
    );
  }

  // Check if specialist/inspector needed but not assigned
  const needsSpecialistOrInspector =
    commissioningLevel &&
    ["L3", "L4", "L5", "L6"].includes(commissioningLevel);
  const hasSpecialistOrInspector = assignedResources.some(
    (r) => r.resource_type === "specialist" || r.resource_type === "inspector"
  );

  if (needsSpecialistOrInspector && !hasSpecialistOrInspector && assignedResources.length > 0) {
    confidence += 0.40;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Commissioning-level activity without specialist or inspector assigned",
        "Actividad de nivel de comisionamiento sin especialista o inspector asignado",
        0.40
      )
    );
  }

  return {
    cause: "skill_mismatch",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateVendorUnconfirmed(
  activityBlockers: LookaheadBlocker[],
  assignedResources: LaborResource[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (hasBlockerType(activityBlockers, "vendor_unconfirmed")) {
    confidence += 0.45;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Vendor unconfirmed blocker identified",
        "Bloqueador de proveedor no confirmado identificado",
        0.45
      )
    );
  }

  const hasVendorUnconfirmed = assignedResources.some(
    (r) =>
      r.constraints &&
      typeof r.constraints === "object" &&
      "type" in r.constraints &&
      r.constraints.type === "vendor_unconfirmed"
  );

  if (hasVendorUnconfirmed) {
    confidence += 0.35;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Assigned resource has vendor_unconfirmed constraint",
        "Recurso asignado tiene restricción de proveedor no confirmado",
        0.35
      )
    );
  }

  const hasUnconfirmed = assignedResources.some(
    (r) =>
      r.constraints &&
      typeof r.constraints === "object" &&
      "confirmed" in r.constraints &&
      r.constraints.confirmed === false
  );

  if (hasUnconfirmed) {
    confidence += 0.20;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Assigned resource confirmation pending",
        "Confirmación de recurso asignado pendiente",
        0.20
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "vendor_unconfirmed")) {
    confidence += 0.15;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions vendor or contractor",
        "Razón de retraso menciona proveedor o contratista",
        0.15
      )
    );
  }

  return {
    cause: "vendor_unconfirmed",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateResourceOverAllocation(
  activityBlockers: LookaheadBlocker[],
  assignedResources: LaborResource[],
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  if (hasBlockerType(activityBlockers, "over_allocated")) {
    confidence += 0.40;
    signals.push(
      signal(
        "blocker",
        "lookahead_blocker",
        "Over-allocation blocker identified",
        "Bloqueador de sobre-asignación identificado",
        0.40
      )
    );
  }

  const hasOverAllocated = assignedResources.some(
    (r) =>
      r.constraints &&
      typeof r.constraints === "object" &&
      "type" in r.constraints &&
      r.constraints.type === "over_allocated"
  );

  if (hasOverAllocated) {
    confidence += 0.35;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Assigned resource has over_allocated constraint",
        "Recurso asignado tiene restricción de sobre-asignación",
        0.35
      )
    );
  }

  const hasConcurrentProjects = assignedResources.some(
    (r) =>
      r.constraints &&
      typeof r.constraints === "object" &&
      "concurrent_projects" in r.constraints &&
      typeof r.constraints.concurrent_projects === "number" &&
      r.constraints.concurrent_projects > 1
  );

  if (hasConcurrentProjects) {
    confidence += 0.25;
    signals.push(
      signal(
        "resource_constraint",
        "labor_resources",
        "Assigned resource allocated across multiple concurrent projects",
        "Recurso asignado distribuido entre múltiples proyectos concurrentes",
        0.25
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "resource_over_allocation")) {
    confidence += 0.15;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions over-allocation or concurrent projects",
        "Razón de retraso menciona sobre-asignación o proyectos concurrentes",
        0.15
      )
    );
  }

  return {
    cause: "resource_over_allocation",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateReworkQuality(
  metrics: ActivityVarianceMetrics,
  delayReason: I18nField | null
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  // FP-8: rework_quality requires hasRework
  if (!metrics.hasRework) {
    return {
      cause: "rework_quality",
      signals: [],
      rawConfidence: 0,
      crossValidationBoost: false,
    };
  }

  if (metrics.reworkCount >= 3) {
    confidence += 0.55;
    signals.push(
      signal(
        "rework_cycle",
        "labor_variance",
        `${metrics.reworkCount} rework cycles identified (high)`,
        `${metrics.reworkCount} ciclos de retrabajo identificados (alto)`,
        0.55
      )
    );
  } else if (metrics.reworkCount >= 1) {
    confidence += 0.35;
    signals.push(
      signal(
        "rework_cycle",
        "labor_variance",
        `${metrics.reworkCount} rework cycle(s) identified`,
        `${metrics.reworkCount} ciclo(s) de retrabajo identificado(s)`,
        0.35
      )
    );
  }

  // Additive confirmation signal
  if (metrics.hasRework) {
    confidence += 0.10;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        "Rework confirmed in activity metrics",
        "Retrabajo confirmado en métricas de la actividad",
        0.10
      )
    );
  }

  if (delayReasonMatchesCause(delayReason, "rework_quality")) {
    confidence += 0.20;
    signals.push(
      signal(
        "delay_reason",
        "metadata",
        "Delay reason mentions rework, quality, or defect",
        "Razón de retraso menciona retrabajo, calidad o defecto",
        0.20
      )
    );
  }

  return {
    cause: "rework_quality",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateCommissioningComplexity(
  activity: ConstructionActivity,
  metrics: ActivityVarianceMetrics
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;
  const level = activity.commissioning_level;

  // Gate: must be L3+ commissioning level
  if (!level || !["L3", "L4", "L5", "L6"].includes(level)) {
    return {
      cause: "commissioning_complexity",
      signals: [],
      rawConfidence: 0,
      crossValidationBoost: false,
    };
  }

  // Base signal: commissioning level present
  confidence += 0.30;
  signals.push(
    signal(
      "commissioning_level",
      "activity_metadata",
      `Activity at commissioning level ${level}`,
      `Actividad en nivel de comisionamiento ${level}`,
      0.30
    )
  );

  // Boost if variance is major or critical
  if (
    metrics.varianceSeverity === "major" ||
    metrics.varianceSeverity === "critical"
  ) {
    confidence = 0.55; // Replace, not additive
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        `Commissioning-level activity with ${metrics.varianceSeverity} variance`,
        `Actividad de nivel de comisionamiento con varianza ${metrics.varianceSeverity}`,
        0.25
      )
    );
  }

  // Additive if rework present
  if (metrics.hasRework) {
    confidence += 0.15;
    signals.push(
      signal(
        "rework_cycle",
        "labor_variance",
        "Rework cycles in commissioning-level activity",
        "Ciclos de retrabajo en actividad de nivel de comisionamiento",
        0.15
      )
    );
  }

  // FP-7: commissioning complexity alone (without major/critical) max 0.25
  if (
    metrics.varianceSeverity !== "major" &&
    metrics.varianceSeverity !== "critical" &&
    !metrics.hasRework
  ) {
    confidence = Math.min(confidence, 0.25);
  }

  return {
    cause: "commissioning_complexity",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateProductionRateGap(
  metrics: ActivityVarianceMetrics
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  // FP-9: production_rate_gap requires stalled or below_plan
  if (
    metrics.productivityAssessment !== "stalled" &&
    metrics.productivityAssessment !== "below_plan"
  ) {
    return {
      cause: "production_rate_gap",
      signals: [],
      rawConfidence: 0,
      crossValidationBoost: false,
    };
  }

  if (metrics.productivityAssessment === "stalled") {
    confidence += 0.55;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        "Production rate stalled (actual rate = 0)",
        "Tasa de producción detenida (tasa actual = 0)",
        0.55
      )
    );
  } else if (metrics.productivityAssessment === "below_plan") {
    confidence += 0.40;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        `Production rate below plan (ratio: ${roundTo(metrics.productionRateRatio ?? 0, 2)})`,
        `Tasa de producción debajo del plan (ratio: ${roundTo(metrics.productionRateRatio ?? 0, 2)})`,
        0.40
      )
    );
  }

  // Additive: strong below-plan
  if (
    metrics.productionRateRatio !== null &&
    metrics.productionRateRatio < 0.70
  ) {
    confidence += 0.30;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        "Production rate below 70% of plan",
        "Tasa de producción por debajo del 70% del plan",
        0.30
      )
    );
  }

  return {
    cause: "production_rate_gap",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

function evaluateCrewSizeExceeded(
  metrics: ActivityVarianceMetrics
): CauseEvaluation {
  const signals: EvidenceSignal[] = [];
  let confidence = 0;

  // FP-10: crew_size_exceeded requires crewExceeded=true or crewRatio > 1.0
  if (metrics.crewExceeded !== true && (metrics.crewRatio === null || metrics.crewRatio <= 1.0)) {
    return {
      cause: "crew_size_exceeded",
      signals: [],
      rawConfidence: 0,
      crossValidationBoost: false,
    };
  }

  if (metrics.crewExceeded === true) {
    confidence += 0.50;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        `Crew exceeded planned size (${metrics.actualCrewSize} actual vs ${metrics.plannedCrewCount} planned)`,
        `Cuadrilla excedió tamaño planificado (${metrics.actualCrewSize} actual vs ${metrics.plannedCrewCount} planificado)`,
        0.50
      )
    );
  }

  if (metrics.crewRatio !== null && metrics.crewRatio > 1.0) {
    confidence += 0.30;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        `Crew ratio ${roundTo(metrics.crewRatio, 2)} exceeds plan`,
        `Ratio de cuadrilla ${roundTo(metrics.crewRatio, 2)} excede el plan`,
        0.30
      )
    );
  }

  // Extra weight if major/critical variance
  if (
    metrics.crewExceeded &&
    (metrics.varianceSeverity === "major" || metrics.varianceSeverity === "critical")
  ) {
    confidence += 0.20;
    signals.push(
      signal(
        "variance_metric",
        "labor_variance",
        "Crew exceeded in combination with major/critical variance",
        "Cuadrilla excedida en combinación con varianza mayor/crítica",
        0.20
      )
    );
  }

  return {
    cause: "crew_size_exceeded",
    signals,
    rawConfidence: confidence,
    crossValidationBoost:
      signals.length >= 2 &&
      new Set(signals.map((s) => s.signalType)).size >= 2,
  };
}

// ── Readiness Gate Checks ─────────────────────────────────────────────────────

/** Mapping from readiness criterion to the cause category it gates.
 *  If the criterion IS completed, that cause's confidence must be forced to 0. */
const READINESS_CAUSE_GATE: Partial<Record<ReadinessCriterion, VarianceCauseCategory>> = {
  material_onsite: "material_delay",
  rfi_answered: "rfi_unresolved",
  drawing_current: "drawing_revision",
  permit_ready: "permit_delay",
  area_released: "area_access",
  predecessor_complete: "predecessor_delay",
};

/** FP-3: If a readiness criterion IS completed, force its mapped cause's confidence to 0. */
function isReadinessGateClosed(
  readiness: WorkfaceReadinessResult | null,
  cause: VarianceCauseCategory
): boolean {
  if (!readiness) return false;

  for (const [criterion, mappedCause] of Object.entries(READINESS_CAUSE_GATE)) {
    if (mappedCause === cause) {
      // If the criterion exists in the checklist and IS completed, gate is closed
      const item = readiness.checklist.find(
        (ci) => ci.item_key === criterion
      );
      if (item && item.completed) {
        return true;
      }
    }
  }

  return false;
}

// ── Main Classification Function ───────────────────────────────────────────────

/**
 * Classify the likely cause(s) of productivity variance for a single activity.
 *
 * Pure function: same inputs → same outputs. No database calls. No AI calls.
 * Process-centered language: never blames individual workers or crews.
 */
export function classifyVarianceCauses(
  activity: ConstructionActivity,
  varianceMetrics: ActivityVarianceMetrics,
  readiness: WorkfaceReadinessResult | null,
  blockers: LookaheadBlocker[],
  resources: LaborResource[],
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  capacityGaps: WeeklyCapacityGap[],
  taxonomy: TradeTaxonomy[]
): VarianceCauseResult {
  const activityKey = activity.activity_key;

  // FP-1: No variance data → unclassified
  if (!varianceMetrics.isTracked) {
    return buildUnclassifiedResult(activityKey);
  }

  // Compute readiness if not provided
  const readinessResult =
    readiness ??
    computeWorkfaceReadiness(
      activity.activity_key,
      activity.readiness_checklist
    );

  // Filter relevant data for this activity
  const activityBlockers = filterBlockersForActivity(blockers, activityKey);
  const capacityGapsForActivity = filterCapacityGapsForActivity(
    capacityGaps,
    activity
  );
  const assignedResources = filterResourcesForActivity(resources, activity);
  const delayReason = getDelayReason(activity.metadata);
  const tradeLabel = resolveTradeLabel(activity.required_trade_key, taxonomy);

  // FP-2: Minimal variance penalty
  const variancePct = varianceMetrics.variancePct ?? 0;
  const minimalVariance = Math.abs(variancePct) < 5;
  const variancePenalty = minimalVariance ? 0.5 : 1.0;

  // Template params for evidence summaries
  const params: EvidenceTemplateParams = {
    activityName: varianceMetrics.activityName,
    variancePct: String(roundTo(Math.abs(varianceMetrics.variancePct ?? 0), 1)),
    tradeLabel,
    reworkCount: varianceMetrics.reworkCount,
    commissioningLevel: activity.commissioning_level ?? "N/A",
    productivityAssessment: varianceMetrics.productivityAssessment,
  };

  // Evaluate all 14 cause categories
  const evaluations: CauseEvaluation[] = [
    evaluateMaterialDelay(readinessResult, activityBlockers, delayReason),
    evaluateRfiUnresolved(readinessResult, activityBlockers, delayReason),
    evaluateDrawingRevision(readinessResult, activityBlockers, delayReason),
    evaluatePermitDelay(readinessResult, activityBlockers, delayReason),
    evaluateAreaAccess(readinessResult, activityBlockers, delayReason),
    evaluatePredecessorDelay(
      readinessResult,
      activityBlockers,
      dependencies,
      allActivities,
      activity.id,
      delayReason
    ),
    evaluateCrewShortage(
      activityBlockers,
      capacityGapsForActivity,
      varianceMetrics,
      activity,
      delayReason
    ),
    evaluateSkillMismatch(assignedResources, activity),
    evaluateVendorUnconfirmed(activityBlockers, assignedResources, delayReason),
    evaluateResourceOverAllocation(
      activityBlockers,
      assignedResources,
      delayReason
    ),
    evaluateReworkQuality(varianceMetrics, delayReason),
    evaluateCommissioningComplexity(activity, varianceMetrics),
    evaluateProductionRateGap(varianceMetrics),
    evaluateCrewSizeExceeded(varianceMetrics),
  ];

  // Apply false positive protection rules and build classifications
  const causes: VarianceCauseClassification[] = [];

  for (const evalResult of evaluations) {
    let confidence = evalResult.rawConfidence;

    // FP-3: Readiness gate — if criterion IS completed, force confidence to 0
    if (
      isReadinessGateClosed(readinessResult, evalResult.cause) &&
      evalResult.cause !== "unclassified"
    ) {
      confidence = 0;
    }

    // FP-2: Minimal variance penalty
    confidence *= variancePenalty;

    // Cross-validation boost: +0.10 if 2+ independent signal types
    if (evalResult.crossValidationBoost) {
      confidence = Math.min(confidence + 0.10, 1.0);
    }

    // Cap at 1.0
    confidence = Math.min(roundTo(confidence, 2), 1.0);

    if (confidence > 0) {
      causes.push(
        buildClassification(evalResult.cause, confidence, evalResult.signals, params)
      );
    }
  }

  // Sort by confidence descending
  causes.sort((a, b) => b.confidence - a.confidence);

  // Determine likely cause
  const likelyCause: VarianceCauseClassification =
    causes.length > 0
      ? causes[0]
      : buildClassification("unclassified", 0, [], params);

  // Contributing causes (confidence >= 0.5)
  const contributingCauses = causes.filter((c) => c.confidence >= 0.5);

  // Compute unexplained variance
  const totalExplainedWeight = Math.min(
    causes.reduce((sum, c) => sum + c.confidence, 0),
    1.0
  );
  const explanationPct = totalExplainedWeight * 100;
  const unexplainedVariancePct =
    varianceMetrics.variancePct !== null
      ? roundTo(Math.max(0, Math.abs(varianceMetrics.variancePct) - explanationPct), 1)
      : null;

  // Build summary sentence
  const likelyLabel = VARIANCE_CAUSE_LABELS[likelyCause.cause];
  const contributingCount = contributingCauses.length;
  let summarySentence: I18nField;

  if (likelyCause.cause === "unclassified") {
    summarySentence = {
      en: `No specific process cause was identified for the variance on "${params.activityName}".`,
      es: `No se identificó una causa de proceso específica para la varianza en "${params.activityName}".`,
    };
  } else if (contributingCount > 0) {
    summarySentence = {
      en: `Likely cause: ${likelyLabel.en} (confidence: ${Math.round(likelyCause.confidence * 100)}%) for "${params.activityName}", with ${contributingCount} contributing factor(s).`,
      es: `Causa probable: ${likelyLabel.es} (confianza: ${Math.round(likelyCause.confidence * 100)}%) para "${params.activityName}", con ${contributingCount} factor(es) contribuyente(s).`,
    };
  } else {
    summarySentence = {
      en: `Likely cause: ${likelyLabel.en} (confidence: ${Math.round(likelyCause.confidence * 100)}%) for "${params.activityName}".`,
      es: `Causa probable: ${likelyLabel.es} (confianza: ${Math.round(likelyCause.confidence * 100)}%) para "${params.activityName}".`,
    };
  }

  return {
    activityKey,
    likelyCause,
    contributingCauses,
    allCauses: causes,
    unexplainedVariancePct,
    summarySentence,
  };
}

/**
 * Batch classify variance causes for all activities.
 * Returns results sorted by likely cause confidence descending (worst first).
 */
export function classifyAllVarianceCauses(
  activities: ConstructionActivity[],
  varianceResult: LaborVarianceResult,
  readinessResults: Map<string, WorkfaceReadinessResult>,
  blockers: LookaheadBlocker[],
  resources: LaborResource[],
  dependencies: ActivityDependency[],
  capacityGaps: WeeklyCapacityGap[],
  taxonomy: TradeTaxonomy[]
): VarianceCauseResult[] {
  const activityMap = new Map(activities.map((a) => [a.activity_key, a]));
  const metricsMap = new Map(
    varianceResult.activities.map((m) => [m.activityKey, m])
  );

  const results: VarianceCauseResult[] = [];

  for (const activity of activities) {
    const metrics = metricsMap.get(activity.activity_key);
    if (!metrics) continue;

    const readiness = readinessResults.get(activity.activity_key) ?? null;

    const result = classifyVarianceCauses(
      activity,
      metrics,
      readiness,
      blockers,
      resources,
      dependencies,
      activities,
      capacityGaps,
      taxonomy
    );

    results.push(result);
  }

  // Sort by likely cause confidence descending
  results.sort((a, b) => b.likelyCause.confidence - a.likelyCause.confidence);

  return results;
}