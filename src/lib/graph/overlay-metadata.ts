// ============================================================================
// ProjectOps360° — Living Graph overlay metadata & clarity model (Sprint #3)
// ============================================================================
// Every advanced overlay must answer three questions deterministically:
//   1. What am I looking at?  → purpose
//   2. Why is this node here?  → dataRequirements + "what shows"
//   3. What should I do next?  → userAction (+ empty/incomplete guidance)
//
// Pure data + a pure state resolver — no engines, no AI, no invented relations.
// The UI (overlay-info.tsx) renders this; Isabella may narrate it (ADR-005) but
// must not invent values beyond what this deterministic model + graph provide.
// ============================================================================

import type { I18nField } from "@/types/database";
import type {
  LivingGraphOverlay,
  LivingGraphViewLevel,
  LivingGraphLayoutMode,
} from "@/types/living-graph";

export type OverlayDataState = "ready" | "incomplete" | "empty";

export interface OverlayLegendItem {
  /** Hex color swatch. */
  color: string;
  label_i18n: I18nField;
}

export interface OverlayCta {
  label_i18n: I18nField;
  /** Builds an in-app href from the projectId; omit for a non-navigating hint. */
  href?: (projectId: string) => string;
}

export interface OverlayMeta {
  id: LivingGraphOverlay;
  label_i18n: I18nField;
  purpose_i18n: I18nField;
  /** What the user should do with this view. */
  userAction_i18n: I18nField;
  /** Short list of the data this overlay consumes. */
  dataRequirements_i18n: I18nField;
  /** Shown when there is no relevant data at all. */
  emptyTitle_i18n: I18nField;
  emptyDescription_i18n: I18nField;
  /** Shown when data exists but is partial (e.g. disconnected nodes). */
  incompleteMessage_i18n: I18nField;
  recommendedLevel?: LivingGraphViewLevel;
  recommendedLayout?: LivingGraphLayoutMode;
  cta?: OverlayCta;
  /** Product Intelligence doc that governs this overlay. */
  relatedDoc: string;
  legend: OverlayLegendItem[];
  canExplainWithIsabella: boolean;
}

const RED = "#ef4444";
const AMBER = "#f59e0b";
const GREEN = "#10b981";
const SLATE = "#94a3b8";
const BRAND = "#6366f1";
const ORANGE = "#f97316";

/** Metadata for the advanced overlays Sprint #3 makes self-explanatory. */
export const OVERLAY_META: Partial<Record<LivingGraphOverlay, OverlayMeta>> = {
  risk: {
    id: "risk",
    label_i18n: { en: "Risk View", es: "Vista de Riesgos" },
    recommendedLayout: "hierarchical",
    purpose_i18n: {
      en: "Shows project risks and the work they threaten — so you can act on the risks that matter.",
      es: "Muestra los riesgos del proyecto y el trabajo que amenazan — para actuar sobre los que importan.",
    },
    userAction_i18n: {
      en: "Review high-impact risks and link any unlinked risk to the affected task or milestone.",
      es: "Revisa los riesgos de alto impacto y vincula los no enlazados a la tarea o hito afectado.",
    },
    dataRequirements_i18n: {
      en: "Risks · risk→task/milestone links · severity/impact · status",
      es: "Riesgos · enlaces riesgo→tarea/hito · severidad/impacto · estado",
    },
    emptyTitle_i18n: { en: "No risks to show", es: "Sin riesgos que mostrar" },
    emptyDescription_i18n: {
      en: "This project has no recorded risks yet. Capture risks to see their impact on the graph.",
      es: "Este proyecto aún no tiene riesgos registrados. Captura riesgos para ver su impacto en el grafo.",
    },
    incompleteMessage_i18n: {
      en: "Some risks are not linked to tasks or milestones yet. Link them to improve impact analysis.",
      es: "Algunos riesgos aún no están vinculados a tareas o hitos. Vincúlalos para mejorar el análisis de impacto.",
    },
    relatedDoc: "12-living-graph-strategy.md",
    legend: [
      { color: RED, label_i18n: { en: "High risk", es: "Riesgo alto" } },
      { color: AMBER, label_i18n: { en: "Medium risk", es: "Riesgo medio" } },
      { color: GREEN, label_i18n: { en: "Low risk", es: "Riesgo bajo" } },
      { color: SLATE, label_i18n: { en: "Unlinked risk", es: "Riesgo sin vincular" } },
    ],
    canExplainWithIsabella: true,
  },

  sopCandidate: {
    id: "sopCandidate",
    label_i18n: { en: "SOP Candidate View", es: "Vista de Candidatos a SOP" },
    recommendedLayout: "force",
    purpose_i18n: {
      en: "Highlights clean, well-evidenced, repeatable work that could become a Standard Operating Procedure.",
      es: "Resalta trabajo limpio, bien evidenciado y repetible que podría convertirse en un Procedimiento Estándar (SOP).",
    },
    userAction_i18n: {
      en: "Review each candidate and decide whether to formalize it as an SOP, or dismiss it.",
      es: "Revisa cada candidato y decide si formalizarlo como SOP o descartarlo.",
    },
    dataRequirements_i18n: {
      en: "Completed work · evidence/traceability · repeated patterns",
      es: "Trabajo completado · evidencia/trazabilidad · patrones repetidos",
    },
    emptyTitle_i18n: { en: "No SOP candidates detected", es: "Sin candidatos a SOP detectados" },
    emptyDescription_i18n: {
      en: "Candidates appear from completed, well-evidenced work. Complete and document more work to surface candidates.",
      es: "Los candidatos surgen de trabajo completado y bien evidenciado. Completa y documenta más trabajo para que aparezcan.",
    },
    incompleteMessage_i18n: {
      en: "SOP candidates are detected from repeated task patterns and may not yet be linked to a formal process.",
      es: "Los candidatos a SOP se detectan por patrones repetidos y pueden no estar aún vinculados a un proceso formal.",
    },
    relatedDoc: "12-living-graph-strategy.md",
    legend: [
      { color: GREEN, label_i18n: { en: "Suggested candidate", es: "Candidato sugerido" } },
      { color: SLATE, label_i18n: { en: "Not yet linked to a process", es: "Aún sin proceso formal" } },
    ],
    canExplainWithIsabella: true,
  },

  variance: {
    id: "variance",
    label_i18n: { en: "Variance View", es: "Vista de Variación" },
    recommendedLayout: "hierarchical",
    purpose_i18n: {
      en: "Answers \"what changed vs the plan?\" — deviation between planned and actual/forecast.",
      es: "Responde \"¿qué cambió vs el plan?\" — la desviación entre lo planificado y lo real/pronosticado.",
    },
    userAction_i18n: {
      en: "Review deviations and decide whether to take corrective action or re-baseline.",
      es: "Revisa las desviaciones y decide si tomar acción correctiva o re-establecer la línea base.",
    },
    dataRequirements_i18n: {
      en: "Baseline (planned dates/effort) · current/actual/forecast · variance",
      es: "Línea base (fechas/esfuerzo planificados) · real/pronóstico · variación",
    },
    emptyTitle_i18n: { en: "Variance View requires baseline/variance data", es: "La Vista de Variación requiere línea base/datos de variación" },
    emptyDescription_i18n: {
      en: "To compare planned vs actual, this project needs a baseline and tracked progress. Set one up in the Delivery Framework or Charter & Governance.",
      es: "Para comparar planificado vs real, el proyecto necesita una línea base y avance registrado. Configúralo en el Marco de Entrega o en el Charter y Gobernanza.",
    },
    incompleteMessage_i18n: {
      en: "Some items have no baseline yet, so their variance can't be computed.",
      es: "Algunos elementos aún no tienen línea base, por lo que su variación no puede calcularse.",
    },
    recommendedLevel: "activities",
    cta: {
      label_i18n: { en: "Open Delivery Framework", es: "Abrir Marco de Entrega" },
      href: (p) => `/projects/${p}/delivery`,
    },
    relatedDoc: "12-living-graph-strategy.md",
    legend: [
      { color: RED, label_i18n: { en: "Behind plan", es: "Atrasado" } },
      { color: ORANGE, label_i18n: { en: "Over effort", es: "Sobre-esfuerzo" } },
      { color: GREEN, label_i18n: { en: "Ahead / under", es: "Adelantado / bajo plan" } },
      { color: SLATE, label_i18n: { en: "No baseline", es: "Sin línea base" } },
    ],
    canExplainWithIsabella: true,
  },

  timeline: {
    id: "timeline",
    label_i18n: { en: "Timeline Playback", es: "Reproducción de Línea de Tiempo" },
    recommendedLayout: "timeline",
    purpose_i18n: {
      en: "Answers \"how did the project get here?\" — replays how the graph changed over time.",
      es: "Responde \"¿cómo llegó aquí el proyecto?\" — reproduce cómo cambió el grafo en el tiempo.",
    },
    userAction_i18n: {
      en: "Play the project's evolution to understand how it reached its current state.",
      es: "Reproduce la evolución del proyecto para entender cómo llegó a su estado actual.",
    },
    dataRequirements_i18n: {
      en: "Project events · status/milestone changes · graph snapshots",
      es: "Eventos del proyecto · cambios de estado/hitos · snapshots del grafo",
    },
    emptyTitle_i18n: { en: "Timeline Playback requires project history", es: "La Reproducción requiere historial del proyecto" },
    emptyDescription_i18n: {
      en: "This view replays how the project changed over time. Capture events, decisions, and status changes to enable playback.",
      es: "Esta vista reproduce cómo cambió el proyecto. Captura eventos, decisiones y cambios de estado para habilitar la reproducción.",
    },
    incompleteMessage_i18n: {
      en: "Limited history available — playback shows the events captured so far.",
      es: "Historial limitado — la reproducción muestra los eventos capturados hasta ahora.",
    },
    relatedDoc: "12-living-graph-strategy.md",
    legend: [
      { color: BRAND, label_i18n: { en: "Changed / active node", es: "Nodo cambiado / activo" } },
      { color: GREEN, label_i18n: { en: "Completed", es: "Completado" } },
      { color: SLATE, label_i18n: { en: "Not yet occurred", es: "Aún no ocurrido" } },
    ],
    canExplainWithIsabella: true,
  },

  simulation: {
    id: "simulation",
    label_i18n: { en: "What-if Simulation", es: "Simulación What-if" },
    recommendedLayout: "hierarchical",
    purpose_i18n: {
      en: "Answers \"what happens if something changes?\" — test impact before touching the real project.",
      es: "Responde \"¿qué pasa si algo cambia?\" — prueba el impacto antes de tocar el proyecto real.",
    },
    userAction_i18n: {
      en: "Select a node, then choose a scenario (delay, mark blocked, change duration) to see downstream impact.",
      es: "Selecciona un nodo y elige un escenario (retraso, marcar bloqueado, cambiar duración) para ver el impacto en cascada.",
    },
    dataRequirements_i18n: {
      en: "Dependencies · dates/durations · critical path (capacity if simulating resources)",
      es: "Dependencias · fechas/duraciones · ruta crítica (capacidad si se simulan recursos)",
    },
    emptyTitle_i18n: { en: "Pick a node to simulate", es: "Elige un nodo para simular" },
    emptyDescription_i18n: {
      en: "Select any node and choose a what-if scenario. Results are an estimate only — no project data changes until you apply it.",
      es: "Selecciona cualquier nodo y elige un escenario what-if. Los resultados son solo una estimación — no se cambia ningún dato del proyecto hasta que lo apliques.",
    },
    incompleteMessage_i18n: {
      en: "Simulation only — no project data has been changed.",
      es: "Solo simulación — no se ha cambiado ningún dato del proyecto.",
    },
    relatedDoc: "12-living-graph-strategy.md",
    legend: [
      { color: ORANGE, label_i18n: { en: "Simulated impact", es: "Impacto simulado" } },
      { color: RED, label_i18n: { en: "Critical path affected", es: "Ruta crítica afectada" } },
      { color: SLATE, label_i18n: { en: "Not applied (estimate)", es: "No aplicado (estimación)" } },
    ],
    canExplainWithIsabella: true,
  },
};

/** Overlays Sprint #3 attaches a clarity card to. */
export const ADVANCED_OVERLAYS = Object.keys(OVERLAY_META) as LivingGraphOverlay[];

export interface OverlaySignals {
  /** Total nodes/items relevant to this overlay in the current view. */
  totalCount: number;
  /** Of those, how many are disconnected (no edges / not linked). */
  disconnectedCount: number;
}

/**
 * Deterministic overlay state:
 *   • empty      → no relevant data at all.
 *   • incomplete → data exists but some is disconnected / lacks links.
 *   • ready      → data exists and is connected.
 */
export function resolveOverlayState(signals: OverlaySignals): OverlayDataState {
  if (signals.totalCount <= 0) return "empty";
  if (signals.disconnectedCount > 0) return "incomplete";
  return "ready";
}

/**
 * Distinct calendar days across event timestamps — the deterministic signal for
 * whether Timeline Playback has REAL history to replay. A project whose events
 * all share one day (e.g. created in a single import) has no evolution to play,
 * so the overlay shows the "requires history" empty state instead of fake playback.
 */
export function countDistinctEventDays(isoDates: (string | null | undefined)[]): number {
  const days = new Set<string>();
  for (const d of isoDates) {
    if (typeof d === "string" && d.length >= 10) days.add(d.slice(0, 10));
  }
  return days.size;
}
