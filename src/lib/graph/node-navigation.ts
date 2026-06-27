// ============================================================================
// ProjectOps360° — Living Graph node → real record navigation (Sprint #4)
// ============================================================================
// Maps a graph node to the real app area for its source record, so the Living
// Graph becomes a navigation hub (not dead visual objects). Where a dedicated
// page exists, the action is enabled and deep-links to it; where it does not,
// the action is returned DISABLED with an honest reason (never fake navigation).
//
// Pure + deterministic. Routes are locale-less app paths; the caller localizes.
// ============================================================================

import type { I18nField } from "@/types/database";
import type { LivingGraphNode } from "@/types/living-graph";

export interface NodeNavAction {
  id: string;
  label_i18n: I18nField;
  /** Locale-less app path (e.g. /projects/:id/workboard), or null when no page exists. */
  href: string | null;
  enabled: boolean;
  disabledReason_i18n?: I18nField;
}

const NO_PAGE_REASON: I18nField = {
  en: "This record type does not have a dedicated page yet.",
  es: "Este tipo de registro aún no tiene una página dedicada.",
};

interface RouteDef {
  label_i18n: I18nField;
  build: (projectId: string) => string;
}

/** Source entity types that have a real, navigable page in the app today. */
const ROUTE_BY_SOURCE: Record<string, RouteDef> = {
  roadmap_tasks: {
    label_i18n: { en: "Open in Workboard", es: "Abrir en Workboard" },
    build: (p) => `/projects/${p}/workboard`,
  },
  milestones: {
    label_i18n: { en: "Open in Execution Map", es: "Abrir en Mapa de Ejecución" },
    build: (p) => `/projects/${p}/execution-map`,
  },
  decisions: {
    label_i18n: { en: "Open Decisions", es: "Abrir Decisiones" },
    build: (p) => `/projects/${p}/decisions`,
  },
  communication_items: {
    label_i18n: { en: "Open Communications", es: "Abrir Comunicaciones" },
    build: (p) => `/projects/${p}/communications`,
  },
  meetings: {
    label_i18n: { en: "Open Meetings", es: "Abrir Reuniones" },
    build: (p) => `/projects/${p}/meetings`,
  },
  documents: {
    label_i18n: { en: "Open Documents", es: "Abrir Documentos" },
    build: (p) => `/projects/${p}/documents`,
  },
  drawing_files: {
    label_i18n: { en: "Open Drawing Intelligence", es: "Abrir Inteligencia de Planos" },
    build: (p) => `/projects/${p}/drawing-intelligence`,
  },
  drawing_insights: {
    label_i18n: { en: "Open Drawing Intelligence", es: "Abrir Inteligencia de Planos" },
    build: (p) => `/projects/${p}/drawing-intelligence`,
  },
  resources: {
    label_i18n: { en: "Open Resource Capacity", es: "Abrir Capacidad de Recursos" },
    build: (p) => `/projects/${p}/resource-capacity`,
  },
  construction_activities: {
    label_i18n: { en: "Open Labor Capacity", es: "Abrir Capacidad Laboral" },
    build: (p) => `/projects/${p}/labor-capacity`,
  },
  budget_items: {
    label_i18n: { en: "Open Budget", es: "Abrir Presupuesto" },
    build: (p) => `/projects/${p}/budget`,
  },
  project_memory_items: {
    label_i18n: { en: "Open in Project Memory", es: "Abrir en Memoria del Proyecto" },
    build: (p) => `/projects/${p}/memory`,
  },
};

/** Known record types that have NO dedicated page yet → honest disabled action. */
const NO_PAGE_LABEL: Record<string, I18nField> = {
  risks: { en: "Open Risk", es: "Abrir Riesgo" },
  rfis: { en: "Open RFI", es: "Abrir RFI" },
  submittals: { en: "Open Submittal", es: "Abrir Submittal" },
  inspections: { en: "Open Inspection", es: "Abrir Inspección" },
  permits: { en: "Open Permit", es: "Abrir Permiso" },
  material_requirements: { en: "Open Material", es: "Abrir Material" },
  procurement_items: { en: "Open Procurement", es: "Abrir Compra" },
  critical_path_snapshots: { en: "Open Critical Path", es: "Abrir Ruta Crítica" },
};

/**
 * Navigation actions for a node. Returns at least one action: an enabled deep
 * link when a page exists, otherwise a disabled action explaining the record has
 * no page yet. Synthetic/aggregate nodes (milestone:* ids) route to the source.
 */
export function getNodeNavActions(node: LivingGraphNode, projectId: string): NodeNavAction[] {
  const src = node.sourceEntityType as string;
  const route = ROUTE_BY_SOURCE[src];
  if (route) {
    return [{ id: `open-${src}`, label_i18n: route.label_i18n, href: route.build(projectId), enabled: true }];
  }
  return [
    {
      id: `open-${src}`,
      label_i18n: NO_PAGE_LABEL[src] ?? { en: "Open record", es: "Abrir registro" },
      href: null,
      enabled: false,
      disabledReason_i18n: NO_PAGE_REASON,
    },
  ];
}

/** True when the node points at a record the user can actually open. */
export function nodeHasNavigation(node: LivingGraphNode): boolean {
  return (node.sourceEntityType as string) in ROUTE_BY_SOURCE;
}
