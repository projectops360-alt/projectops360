import type {
  PmoPiExecutivePortfolioModel,
  PmoPiExecutiveProject,
  PmoPiExecutiveStage,
  PmoPiExecutiveStageKey,
} from "./executive-projection";
import type { PmoPiFilters } from "./contracts";

export type ProcessGraphHierarchyLevel =
  | "organization"
  | "stage"
  | "project"
  | "milestone";

export type ProcessGraphSemanticZoom =
  | "far"
  | "intermediate"
  | "close"
  | "deep";

export type ProcessGraphNodeKind =
  | "stage"
  | "project"
  | "milestone"
  | "activity";

export type ProcessGraphEdgeKind =
  | "execution-flow"
  | "secondary-flow"
  | "rework"
  | "dependency"
  | "resource-flow"
  | "budget-flow"
  | "risk-propagation"
  | "deliverable-flow";

export interface ProcessGraphMilestone {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  completedDate: string | null;
  progressPercent: number;
  orderIndex: number;
}

export interface ProcessGraphActivity {
  id: string;
  organizationId: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progressPercent: number;
  estimateHours: number | null;
  actualHours: number | null;
  startDate: string | null;
  endDate: string | null;
  isBlocked: boolean;
  blockerReason: string | null;
  isCritical: boolean;
  assignedTo: string | null;
  orderIndex: number;
}

export interface ProcessGraphDependency {
  id: string;
  organizationId: string;
  projectId: string;
  predecessorId: string;
  successorId: string;
  dependencyType: string;
  lagDays: number;
}

export interface ProcessGraphHierarchyModel {
  organizationId: string;
  milestones: ProcessGraphMilestone[];
  activities: ProcessGraphActivity[];
  dependencies: ProcessGraphDependency[];
  truncated: boolean;
  limitations: string[];
}

export interface ProcessGraphEntityMetrics {
  projectCount?: number;
  activeProjectCount?: number;
  cycleTimeMs?: number | null;
  targetCycleTimeMs?: number | null;
  outsideSlaProjectCount?: number | null;
  reworkOccurrences?: number;
  approvedBudget?: number | null;
  actualCost?: number | null;
  eac?: number | null;
  forecastVariance?: number | null;
  criticalRisks?: number;
  activeRisks?: number;
  overallocatedResources?: number;
  dataQualityScore?: number;
  healthScore?: number;
  progressPercent?: number;
  delayProbabilityPct?: number | null;
  cpi?: number | null;
  spi?: number | null;
  dependencyCount?: number;
  estimateHours?: number | null;
  actualHours?: number | null;
  forecastFinish?: string | null;
  projectManager?: string | null;
  trend?: "improving" | "stable" | "worsening" | "unavailable";
  budgetConsumedPct?: number | null;
}

export interface ProcessGraphEntity {
  id: string;
  kind: ProcessGraphNodeKind;
  label: string;
  definition: string;
  parentId: string | null;
  projectId: string | null;
  stageKey: PmoPiExecutiveStageKey | null;
  status: string;
  metrics: ProcessGraphEntityMetrics;
  includedEntityIds: string[];
  evidence: string[];
  href: string | null;
}

export interface ProcessGraphConnection {
  id: string;
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  kind: ProcessGraphEdgeKind;
  label: string;
  projectIds: string[];
  caseCount: number;
  transitionCount: number;
  frequency: number;
  averageTransitionMs: number | null;
  averageWaitMs: number | null;
  reworkCount: number;
  budgetImpact: number | null;
  lastObservedAt: string | null;
  dataQualityScore: number;
  evidence: string[];
}

export interface ProcessGraphNavigationState {
  level: ProcessGraphHierarchyLevel;
  stageKey: PmoPiExecutiveStageKey | null;
  projectId: string | null;
  milestoneId: string | null;
}

export interface ProcessGraphProjection {
  entities: ProcessGraphEntity[];
  connections: ProcessGraphConnection[];
  navigation: ProcessGraphNavigationState;
  activeBottleneck: string | null;
  activeVariant: string | null;
  dataQualityScore: number;
  limitations: string[];
}

export interface ProcessGraphBuildInput {
  locale: "en" | "es";
  base: string;
  executive: PmoPiExecutivePortfolioModel;
  hierarchy: ProcessGraphHierarchyModel;
  navigation: ProcessGraphNavigationState;
  semanticZoom: ProcessGraphSemanticZoom;
  expandedNodeIds: ReadonlySet<string>;
  layer: Exclude<PmoPiFilters["overlay"], "whatif">;
}

export interface ProcessGraphScreenContext {
  route: string;
  dashboardMode: "process-intelligence-beta";
  organizationId: string;
  portfolioId: string | null;
  programId: string | null;
  projectId: string | null;
  hierarchyLevel: ProcessGraphHierarchyLevel;
  activeLayer: PmoPiFilters["overlay"];
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  visibleNodeIds: string[];
  visibleNodeCount: number;
  visibleEdgeIds: string[];
  visibleEdgeCount: number;
  dateRange: { from: string | null; to: string | null };
  filters: {
    projectIds: string[];
    search: string;
    stageKey: PmoPiExecutiveStageKey | null;
  };
  viewport: { x: number; y: number; zoom: number };
  currentMetrics: ProcessGraphEntityMetrics | null;
  activeBottleneck: string | null;
  activeVariant: string | null;
  dataQuality: number;
  language: "en" | "es";
  visibleNodeLabels: string[];
}

export interface ProcessGraphStageDefinition {
  key: PmoPiExecutiveStageKey;
  label: { en: string; es: string };
  definition: { en: string; es: string };
  includes: { en: string[]; es: string[] };
}

export const PROCESS_GRAPH_STAGE_DEFINITIONS: readonly ProcessGraphStageDefinition[] = [
  {
    key: "initiate",
    label: { en: "Initiate", es: "Iniciar" },
    definition: {
      en: "The phase where a project is evaluated, justified and authorized.",
      es: "La fase donde el proyecto se evalúa, justifica y autoriza.",
    },
    includes: {
      en: ["Intake", "Idea", "Request", "Business case", "Sponsor assignment", "Feasibility", "Initial estimate", "Go / no-go", "Charter approval"],
      es: ["Intake", "Idea", "Solicitud", "Caso de negocio", "Asignación de sponsor", "Factibilidad", "Estimado inicial", "Go / no-go", "Aprobación del charter"],
    },
  },
  {
    key: "plan",
    label: { en: "Plan", es: "Planificar" },
    definition: {
      en: "The phase where execution and control are defined before work advances.",
      es: "La fase donde se define cómo se ejecutará y controlará el proyecto.",
    },
    includes: {
      en: ["Scope", "Schedule", "Baseline", "Budget", "Resource plan", "Risk plan", "Procurement", "Quality plan", "Communications", "Dependency planning"],
      es: ["Alcance", "Cronograma", "Línea base", "Presupuesto", "Plan de recursos", "Plan de riesgos", "Procurement", "Plan de calidad", "Comunicaciones", "Planificación de dependencias"],
    },
  },
  {
    key: "execute",
    label: { en: "Execute", es: "Ejecutar" },
    definition: {
      en: "The phase where deliverables are produced and resources and actual costs are consumed.",
      es: "La fase donde se producen entregables y se consumen recursos y costos reales.",
    },
    includes: {
      en: ["Work execution", "Task progression", "Deliverables", "Team utilization", "Vendor work", "Actual costs", "Collaboration", "Issue resolution"],
      es: ["Ejecución del trabajo", "Avance de tareas", "Entregables", "Utilización del equipo", "Trabajo de proveedores", "Costos reales", "Colaboración", "Resolución de incidentes"],
    },
  },
  {
    key: "control",
    label: { en: "Control", es: "Controlar" },
    definition: {
      en: "The phase where plan and reality are compared and corrective actions are governed.",
      es: "La fase donde se comparan plan y realidad y se gobiernan acciones correctivas.",
    },
    includes: {
      en: ["Status control", "EVM", "Changes", "Risks", "Issues", "Quality", "Forecast", "Schedule control", "Cost control", "Corrective actions"],
      es: ["Control de estado", "EVM", "Cambios", "Riesgos", "Incidentes", "Calidad", "Pronóstico", "Control del cronograma", "Control de costos", "Acciones correctivas"],
    },
  },
  {
    key: "close",
    label: { en: "Close", es: "Cerrar" },
    definition: {
      en: "The phase where results are formally accepted, transferred and archived.",
      es: "La fase donde los resultados se aceptan, transfieren y archivan formalmente.",
    },
    includes: {
      en: ["Acceptance", "Handover", "Financial closure", "Vendor closure", "Resource release", "Lessons learned", "Benefits transition", "Archive"],
      es: ["Aceptación", "Handover", "Cierre financiero", "Cierre de proveedores", "Liberación de recursos", "Lecciones aprendidas", "Transición de beneficios", "Archivo"],
    },
  },
] as const;

export function stageDefinition(
  stage: PmoPiExecutiveStageKey,
): ProcessGraphStageDefinition {
  return PROCESS_GRAPH_STAGE_DEFINITIONS.find((item) => item.key === stage)!;
}

export function stageEntityMetrics(
  stage: PmoPiExecutiveStage,
  dataQualityScore: number,
): ProcessGraphEntityMetrics {
  return {
    projectCount: stage.projectCount,
    activeProjectCount: stage.activeProjectCount,
    cycleTimeMs: stage.averageCycleTimeMs,
    targetCycleTimeMs: stage.targetCycleTimeMs,
    outsideSlaProjectCount: stage.outsideSlaProjectCount,
    reworkOccurrences: stage.reworkOccurrences,
    approvedBudget: stage.baselineBudget,
    actualCost: stage.actualCost,
    eac: stage.eac,
    forecastVariance: stage.forecastVariance,
    budgetConsumedPct:
      stage.baselineBudget > 0
        ? (stage.actualCost / stage.baselineBudget) * 100
        : null,
    criticalRisks: stage.activeRisks,
    overallocatedResources: stage.overallocatedResources,
    dataQualityScore,
    trend: stage.trend,
  };
}

export function projectEntityMetrics(
  project: PmoPiExecutiveProject,
): ProcessGraphEntityMetrics {
  return {
    healthScore: project.healthScore,
    cycleTimeMs: project.cycleTimeMs,
    approvedBudget: project.approvedBudget,
    actualCost: project.actualCost,
    eac: project.eac,
    delayProbabilityPct: project.delayProbabilityPct,
    cpi: project.cpi,
    spi: project.spi,
    criticalRisks: project.criticalRisks,
    activeRisks: project.activeRisks,
    overallocatedResources: project.overallocatedResources,
    dependencyCount: project.dependencyCount,
    forecastFinish: project.forecastFinish,
    projectManager: project.projectManager,
    budgetConsumedPct:
      project.approvedBudget != null && project.approvedBudget > 0
        ? ((project.actualCost ?? 0) / project.approvedBudget) * 100
        : null,
  };
}
