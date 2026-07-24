import type { PmoPiCase, PmoPiFlowModel } from "./contracts";
import type {
  PmoPiFinanceOverlayModel,
  PmoPiFinanceRow,
} from "./financial-overlay";
import type { PmoPiOverlaysData } from "./overlays-read.server";

export const EXECUTIVE_STAGE_ORDER = [
  "initiate",
  "plan",
  "execute",
  "control",
  "close",
] as const;

export type PmoPiExecutiveStageKey = (typeof EXECUTIVE_STAGE_ORDER)[number];
export type PmoPiExecutiveStatus =
  | "on_target"
  | "stable"
  | "attention"
  | "critical"
  | "insufficient";

export interface PmoPiProjectDirectoryEntry {
  id: string;
  title: string;
  status: string;
  projectType: string;
  startDate: string | null;
  targetEndDate: string | null;
  projectManager: string | null;
  sponsor: string | null;
}

export interface PmoPiExecutiveStage {
  key: PmoPiExecutiveStageKey;
  projectIds: string[];
  projectCount: number;
  activeProjectCount: number;
  averageCycleTimeMs: number | null;
  targetCycleTimeMs: number | null;
  outsideSlaProjectCount: number | null;
  reworkOccurrences: number;
  baselineBudget: number;
  actualCost: number;
  eac: number;
  forecastVariance: number;
  activeRisks: number;
  overallocatedResources: number;
  trend: "improving" | "stable" | "worsening" | "unavailable";
  status: PmoPiExecutiveStatus;
}

export interface PmoPiExecutiveConnection {
  from: PmoPiExecutiveStageKey;
  to: PmoPiExecutiveStageKey;
  projectCount: number;
  frequency: number;
  status: PmoPiExecutiveStatus;
}

export interface PmoPiExecutiveVariant {
  id: string;
  kind: "dominant" | "secondary" | "critical";
  stagePath: PmoPiExecutiveStageKey[];
  projectIds: string[];
  projectCount: number;
  sharePct: number;
  averageCycleTimeMs: number | null;
  reworkRate: number;
  financialImpact: number;
  activeRiskCount: number;
}

export interface PmoPiExecutiveBottleneck {
  stage: PmoPiExecutiveStageKey;
  affectedProjectIds: string[];
  affectedProjectCount: number;
  averageWaitMs: number | null;
  financialImpact: number;
  score: number;
  technicalActivities: string[];
}

export interface PmoPiExecutiveReworkLoop {
  from: PmoPiExecutiveStageKey;
  to: PmoPiExecutiveStageKey;
  frequency: number;
  affectedProjectCount: number;
  technicalTransitions: string[];
}

export interface PmoPiExecutiveProject {
  id: string;
  title: string;
  status: string;
  projectType: string;
  startDate: string | null;
  targetEndDate: string | null;
  projectManager: string | null;
  sponsor: string | null;
  currentStage: PmoPiExecutiveStageKey;
  healthScore: number;
  processEventCount: number;
  cycleTimeMs: number | null;
  forecastFinish: string | null;
  delayProbabilityPct: number | null;
  originalBudget: number | null;
  currentBaseline: number | null;
  approvedBudget: number | null;
  committedCost: number | null;
  actualCost: number | null;
  accruedCost: number | null;
  etc: number | null;
  eac: number | null;
  vac: number | null;
  cpi: number | null;
  spi: number | null;
  contingency: number | null;
  criticalRisks: number;
  activeRisks: number;
  overallocatedResources: number;
  dependencyCount: number;
  latestSignificantEvents: {
    stage: PmoPiExecutiveStageKey;
    occurredAt: string;
  }[];
}

export interface PmoPiExecutivePortfolioModel {
  stages: PmoPiExecutiveStage[];
  connections: PmoPiExecutiveConnection[];
  variants: PmoPiExecutiveVariant[];
  bottlenecks: PmoPiExecutiveBottleneck[];
  reworkLoops: PmoPiExecutiveReworkLoop[];
  projects: PmoPiExecutiveProject[];
  portfolioHealthScore: number | null;
  generatedAt: string;
  dataQualityScore: number;
  limitations: string[];
}

const STAGE_INDEX = new Map<PmoPiExecutiveStageKey, number>(
  EXECUTIVE_STAGE_ORDER.map((stage, index) => [stage, index]),
);

function minableEvents(projectCase: PmoPiCase) {
  return [...projectCase.events]
    .filter(
      (event) =>
        event.lifecycleClass === "BUSINESS_EVENT" &&
        !event.isCompensatingEvent,
    )
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.eventId.localeCompare(right.eventId),
    );
}

export function classifyExecutiveStage(
  eventType: string,
): PmoPiExecutiveStageKey {
  const normalized = eventType.toLowerCase();
  if (
    /projectclosed|projectcompleted|closeout|archiv|benefitrealized|finalacceptance/.test(
      normalized,
    )
  ) {
    return "close";
  }
  if (
    /risk|issue|decision|approval|approved|statuschanged|progresschanged|deferred|reopened|reassigned|duedatechanged|estimatechanged|deleted|blocked|quality|inspection/.test(
      normalized,
    )
  ) {
    return "control";
  }
  if (
    /started|resumed|subtask|taskcompleted|milestonecompleted|materialized|delivered|deployed|executed/.test(
      normalized,
    )
  ) {
    return "execute";
  }
  if (
    /taskcreated|taskassigned|dependency|estimate|budget|baseline|scheduled|milestonecreated|planned|forecast|resourceassigned/.test(
      normalized,
    )
  ) {
    return "plan";
  }
  return "initiate";
}

export function executiveStageLabel(
  stage: PmoPiExecutiveStageKey,
  locale: "en" | "es",
): string {
  const labels: Record<PmoPiExecutiveStageKey, { en: string; es: string }> = {
    initiate: { en: "Initiate", es: "Iniciar" },
    plan: { en: "Plan", es: "Planificar" },
    execute: { en: "Execute", es: "Ejecutar" },
    control: { en: "Control", es: "Controlar" },
    close: { en: "Close", es: "Cerrar" },
  };
  return labels[stage][locale];
}

export function executiveActivityLabel(
  eventType: string,
  locale: "en" | "es",
): string {
  const normalized = eventType.toLowerCase();
  const labels = locale === "es"
    ? {
        status: "la aprobación y actualización de ejecución",
        risk: "el control de riesgos",
        dependency: "la coordinación de dependencias",
        estimate: "la actualización del estimado",
        assignment: "la asignación de responsables",
        dueDate: "el control de fechas comprometidas",
        subtask: "la ejecución de actividades",
        completed: "el cierre del trabajo",
        fallback: "el siguiente control del proceso",
      }
    : {
        status: "execution approval and status control",
        risk: "risk control",
        dependency: "dependency coordination",
        estimate: "estimate control",
        assignment: "ownership assignment",
        dueDate: "committed-date control",
        subtask: "activity execution",
        completed: "work closure",
        fallback: "the next process control",
      };
  if (/statuschanged|approval|approved/.test(normalized)) return labels.status;
  if (/risk|issue/.test(normalized)) return labels.risk;
  if (/dependency/.test(normalized)) return labels.dependency;
  if (/estimate|budget|baseline/.test(normalized)) return labels.estimate;
  if (/assigned|reassigned/.test(normalized)) return labels.assignment;
  if (/duedate|scheduled|forecast/.test(normalized)) return labels.dueDate;
  if (/subtask|started|resumed/.test(normalized)) return labels.subtask;
  if (/completed|closed|archived/.test(normalized)) return labels.completed;
  return labels.fallback;
}

function collapseStages(stages: readonly PmoPiExecutiveStageKey[]) {
  const collapsed: PmoPiExecutiveStageKey[] = [];
  for (const stage of stages) {
    if (collapsed.at(-1) !== stage) collapsed.push(stage);
  }
  return collapsed;
}

function financeByProject(finance: PmoPiFinanceOverlayModel | null) {
  return new Map(
    (finance?.rows ?? []).map((row) => [row.projectId, row] as const),
  );
}

function riskByProject(overlays: PmoPiOverlaysData | null) {
  return new Map(
    (overlays?.risk.rows ?? []).map((row) => [row.projectId, row] as const),
  );
}

function capacityByProject(overlays: PmoPiOverlaysData | null) {
  return new Map(
    (overlays?.capacity ?? []).map((row) => [row.projectId, row] as const),
  );
}

function dependencyByProject(overlays: PmoPiOverlaysData | null) {
  return new Map(
    (overlays?.dependencies.perProject ?? []).map(
      (row) => [row.projectId, row.dependencyCount] as const,
    ),
  );
}

function projectFinancialImpact(row: PmoPiFinanceRow | undefined): number {
  if (!row || row.baseline == null || row.latestEac == null) return 0;
  return Math.max(0, row.latestEac - row.baseline);
}

function statusForStage(input: {
  projectCount: number;
  forecastVariance: number;
  activeRisks: number;
  overallocatedResources: number;
  reworkOccurrences: number;
}): PmoPiExecutiveStatus {
  if (input.projectCount === 0) return "insufficient";
  if (
    input.forecastVariance < 0 ||
    input.activeRisks >= 3 ||
    input.overallocatedResources >= 3
  ) {
    return "critical";
  }
  if (
    input.activeRisks > 0 ||
    input.overallocatedResources > 0 ||
    input.reworkOccurrences > 0
  ) {
    return "attention";
  }
  return "stable";
}

function projectHealth(input: {
  status: string;
  finance: PmoPiFinanceRow | undefined;
  criticalRisks: number;
  overallocatedResources: number;
}): number {
  let score = 100;
  if (input.status === "on_hold") score -= 20;
  if (input.status === "cancelled") score -= 45;
  if (input.finance?.cpi != null && input.finance.cpi < 0.9) score -= 15;
  if (input.finance?.spi != null && input.finance.spi < 0.9) score -= 15;
  score -= Math.min(20, input.criticalRisks * 5);
  score -= Math.min(15, input.overallocatedResources * 5);
  score -= Math.min(20, projectFinancialImpact(input.finance) > 0 ? 20 : 0);
  return Math.max(0, Math.min(100, score));
}

export function buildExecutivePortfolioModel(input: {
  cases: readonly PmoPiCase[];
  technicalFlow: PmoPiFlowModel;
  projects: readonly PmoPiProjectDirectoryEntry[];
  finance: PmoPiFinanceOverlayModel | null;
  overlays: PmoPiOverlaysData | null;
  generatedAt: string;
}): PmoPiExecutivePortfolioModel {
  const caseByProject = new Map(input.cases.map((projectCase) => [
    projectCase.projectId,
    projectCase,
  ]));
  const financeMap = financeByProject(input.finance);
  const riskMap = riskByProject(input.overlays);
  const capacityMap = capacityByProject(input.overlays);
  const dependencyMap = dependencyByProject(input.overlays);

  const currentStageByProject = new Map<string, PmoPiExecutiveStageKey>();
  const stageVisits = new Map<PmoPiExecutiveStageKey, Set<string>>(
    EXECUTIVE_STAGE_ORDER.map((stage) => [stage, new Set<string>()]),
  );
  const stageDurations = new Map<PmoPiExecutiveStageKey, number[]>(
    EXECUTIVE_STAGE_ORDER.map((stage) => [stage, []]),
  );
  const stageRework = new Map<PmoPiExecutiveStageKey, number>(
    EXECUTIVE_STAGE_ORDER.map((stage) => [stage, 0]),
  );
  const connectionCounts = new Map<string, {
    from: PmoPiExecutiveStageKey;
    to: PmoPiExecutiveStageKey;
    projectIds: Set<string>;
    frequency: number;
  }>();

  for (const project of input.projects) {
    const projectCase = caseByProject.get(project.id);
    const events = projectCase ? minableEvents(projectCase) : [];
    const stages = events.map((event) => classifyExecutiveStage(event.eventType));
    const collapsed = collapseStages(stages);
    const currentStage = collapsed.at(-1) ?? "initiate";
    currentStageByProject.set(project.id, currentStage);
    stageVisits.get(currentStage)?.add(project.id);

    const firstLast = new Map<PmoPiExecutiveStageKey, { first: number; last: number }>();
    const seenActivities = new Map<PmoPiExecutiveStageKey, Set<string>>();
    for (const event of events) {
      const stage = classifyExecutiveStage(event.eventType);
      const occurredAt = Date.parse(event.occurredAt);
      if (Number.isFinite(occurredAt)) {
        const current = firstLast.get(stage);
        firstLast.set(stage, {
          first: current ? Math.min(current.first, occurredAt) : occurredAt,
          last: current ? Math.max(current.last, occurredAt) : occurredAt,
        });
      }
      const seen = seenActivities.get(stage) ?? new Set<string>();
      if (seen.has(event.eventType)) {
        stageRework.set(stage, (stageRework.get(stage) ?? 0) + 1);
      }
      seen.add(event.eventType);
      seenActivities.set(stage, seen);
    }
    for (const [stage, range] of firstLast) {
      stageDurations.get(stage)?.push(Math.max(0, range.last - range.first));
    }
    for (let index = 1; index < collapsed.length; index++) {
      const from = collapsed[index - 1];
      const to = collapsed[index];
      if (from === to) continue;
      const key = `${from}:${to}`;
      const connection = connectionCounts.get(key) ?? {
        from,
        to,
        projectIds: new Set<string>(),
        frequency: 0,
      };
      connection.projectIds.add(project.id);
      connection.frequency += 1;
      connectionCounts.set(key, connection);
    }
  }

  const stages = EXECUTIVE_STAGE_ORDER.map((stage): PmoPiExecutiveStage => {
    const projectIds = [...(stageVisits.get(stage) ?? new Set<string>())].sort();
    const financialRows = projectIds
      .map((projectId) => financeMap.get(projectId))
      .filter((row): row is PmoPiFinanceRow => row !== undefined);
    const baselineBudget = financialRows.reduce(
      (sum, row) => sum + (row.baseline ?? 0),
      0,
    );
    const actualCost = financialRows.reduce(
      (sum, row) => sum + row.actualCost,
      0,
    );
    const eac = financialRows.reduce(
      (sum, row) => sum + (row.latestEac ?? 0),
      0,
    );
    const activeRisks = projectIds.reduce(
      (sum, projectId) => sum + (riskMap.get(projectId)?.openCount ?? 0),
      0,
    );
    const overallocatedResources = projectIds.reduce(
      (sum, projectId) =>
        sum + (capacityMap.get(projectId)?.overallocatedResourceCount ?? 0),
      0,
    );
    const durations = stageDurations.get(stage) ?? [];
    const averageCycleTimeMs = durations.length > 0
      ? Math.round(
          durations.reduce((sum, duration) => sum + duration, 0) /
            durations.length,
        )
      : null;
    const forecastVariance = baselineBudget - eac;
    const reworkOccurrences = stageRework.get(stage) ?? 0;
    return {
      key: stage,
      projectIds,
      projectCount: projectIds.length,
      activeProjectCount: projectIds.filter(
        (projectId) =>
          input.projects.find((project) => project.id === projectId)?.status ===
          "active",
      ).length,
      averageCycleTimeMs,
      targetCycleTimeMs: null,
      outsideSlaProjectCount: null,
      reworkOccurrences,
      baselineBudget,
      actualCost,
      eac,
      forecastVariance,
      activeRisks,
      overallocatedResources,
      trend: "unavailable",
      status: statusForStage({
        projectCount: projectIds.length,
        forecastVariance,
        activeRisks,
        overallocatedResources,
        reworkOccurrences,
      }),
    };
  });

  const connections = [...connectionCounts.values()]
    .filter(
      (connection) =>
        (STAGE_INDEX.get(connection.to) ?? 0) >
        (STAGE_INDEX.get(connection.from) ?? 0),
    )
    .sort(
      (left, right) =>
        right.frequency - left.frequency ||
        `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`),
    )
    .slice(0, 8)
    .map((connection): PmoPiExecutiveConnection => ({
      from: connection.from,
      to: connection.to,
      projectCount: connection.projectIds.size,
      frequency: connection.frequency,
      status: "stable",
    }));

  const executiveVariantGroups = new Map<string, {
    path: PmoPiExecutiveStageKey[];
    projectIds: Set<string>;
    durations: number[];
    rework: number;
  }>();
  for (const variant of input.technicalFlow.variants.variants) {
    const stagePath = collapseStages(
      variant.signature.map(classifyExecutiveStage),
    );
    const key = stagePath.join(":");
    const group = executiveVariantGroups.get(key) ?? {
      path: stagePath,
      projectIds: new Set<string>(),
      durations: [],
      rework: 0,
    };
    variant.caseIds.forEach((projectId) => group.projectIds.add(projectId));
    if (variant.avgDurationMs != null) group.durations.push(variant.avgDurationMs);
    group.rework = Math.max(group.rework, variant.reworkRate);
    executiveVariantGroups.set(key, group);
  }

  const variantCandidates = [...executiveVariantGroups.entries()]
    .map(([id, group]) => {
      const projectIds = [...group.projectIds].sort();
      return {
        id,
        stagePath: group.path,
        projectIds,
        projectCount: projectIds.length,
        sharePct:
          input.projects.length > 0
            ? Math.round((projectIds.length / input.projects.length) * 10_000) /
              100
            : 0,
        averageCycleTimeMs:
          group.durations.length > 0
            ? Math.round(
                group.durations.reduce((sum, duration) => sum + duration, 0) /
                  group.durations.length,
              )
            : null,
        reworkRate: group.rework,
        financialImpact: projectIds.reduce(
          (sum, projectId) =>
            sum + projectFinancialImpact(financeMap.get(projectId)),
          0,
        ),
        activeRiskCount: projectIds.reduce(
          (sum, projectId) => sum + (riskMap.get(projectId)?.openCount ?? 0),
          0,
        ),
      };
    })
    .sort(
      (left, right) =>
        right.projectCount - left.projectCount || left.id.localeCompare(right.id),
    );

  const selectedVariants: PmoPiExecutiveVariant[] = [];
  const dominant = variantCandidates[0];
  if (dominant) selectedVariants.push({ ...dominant, kind: "dominant" });
  const secondary = variantCandidates[1];
  if (secondary) selectedVariants.push({ ...secondary, kind: "secondary" });
  const critical = [...variantCandidates]
    .filter((variant) => !selectedVariants.some((item) => item.id === variant.id))
    .sort(
      (left, right) =>
        right.financialImpact - left.financialImpact ||
        right.activeRiskCount - left.activeRiskCount ||
        right.reworkRate - left.reworkRate,
    )[0];
  if (critical) selectedVariants.push({ ...critical, kind: "critical" });

  const bottleneckByStage = new Map<PmoPiExecutiveStageKey, {
    score: number;
    waits: number[];
    technicalActivities: string[];
  }>();
  for (const node of input.technicalFlow.nodes) {
    const stage = classifyExecutiveStage(node.activity);
    const current = bottleneckByStage.get(stage) ?? {
      score: 0,
      waits: [],
      technicalActivities: [],
    };
    current.score = Math.max(current.score, node.bottleneckScore);
    if (node.avgIncomingWaitingMs != null) {
      current.waits.push(node.avgIncomingWaitingMs);
    }
    current.technicalActivities.push(node.activity);
    bottleneckByStage.set(stage, current);
  }
  const bottlenecks = [...bottleneckByStage.entries()]
    .filter(([, data]) => data.score >= 0.45)
    .map(([stage, data]): PmoPiExecutiveBottleneck => {
      const stageModel = stages.find((item) => item.key === stage);
      return {
        stage,
        affectedProjectIds: stageModel?.projectIds ?? [],
        affectedProjectCount: stageModel?.projectCount ?? 0,
        averageWaitMs:
          data.waits.length > 0
            ? Math.round(
                data.waits.reduce((sum, wait) => sum + wait, 0) /
                  data.waits.length,
              )
            : null,
        financialImpact: Math.max(
          0,
          -(stageModel?.forecastVariance ?? 0),
        ),
        score: data.score,
        technicalActivities: [...new Set(data.technicalActivities)].sort(),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.affectedProjectCount - left.affectedProjectCount,
    )
    .slice(0, 3);

  const reworkGroups = new Map<string, PmoPiExecutiveReworkLoop>();
  for (const edge of input.technicalFlow.edges.filter((item) => item.isRework)) {
    const from = classifyExecutiveStage(edge.from);
    const to = classifyExecutiveStage(edge.to);
    const key = `${from}:${to}`;
    const current = reworkGroups.get(key) ?? {
      from,
      to,
      frequency: 0,
      affectedProjectCount: 0,
      technicalTransitions: [],
    };
    current.frequency += edge.frequency;
    current.affectedProjectCount = Math.max(
      current.affectedProjectCount,
      edge.caseCount,
    );
    current.technicalTransitions.push(`${edge.from} → ${edge.to}`);
    reworkGroups.set(key, current);
  }
  const reworkLoops = [...reworkGroups.values()]
    .sort(
      (left, right) =>
        right.frequency - left.frequency ||
        `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`),
    )
    .slice(0, 3);

  const projects = input.projects.map((project): PmoPiExecutiveProject => {
    const projectCase = caseByProject.get(project.id);
    const events = projectCase ? minableEvents(projectCase) : [];
    const finance = financeMap.get(project.id);
    const risks = riskMap.get(project.id);
    const capacity = capacityMap.get(project.id);
    const first = events.length > 0 ? Date.parse(events[0].occurredAt) : NaN;
    const last = events.length > 0
      ? Date.parse(events[events.length - 1].occurredAt)
      : NaN;
    const cycleTimeMs =
      Number.isFinite(first) && Number.isFinite(last) ? last - first : null;
    const delayProbabilityPct =
      finance?.spi == null
        ? null
        : Math.max(0, Math.min(100, Math.round((1 - finance.spi) * 100)));
    return {
      id: project.id,
      title: project.title,
      status: project.status,
      projectType: project.projectType,
      startDate: project.startDate,
      targetEndDate: project.targetEndDate,
      projectManager: project.projectManager,
      sponsor: project.sponsor,
      currentStage: currentStageByProject.get(project.id) ?? "initiate",
      healthScore: projectHealth({
        status: project.status,
        finance,
        criticalRisks: risks?.criticalCount ?? 0,
        overallocatedResources: capacity?.overallocatedResourceCount ?? 0,
      }),
      processEventCount: events.length,
      cycleTimeMs,
      forecastFinish: project.targetEndDate,
      delayProbabilityPct,
      originalBudget: finance?.originalBudget ?? null,
      currentBaseline: finance?.baseline ?? null,
      approvedBudget: finance?.authorizedFunding ?? null,
      committedCost: finance?.currentCommitment ?? null,
      actualCost: finance?.actualCost ?? null,
      accruedCost: finance?.openAccrual ?? null,
      etc:
        finance?.latestEac != null
          ? Math.max(0, finance.latestEac - finance.actualCost)
          : null,
      eac: finance?.latestEac ?? null,
      vac: finance?.vac ?? null,
      cpi: finance?.cpi ?? null,
      spi: finance?.spi ?? null,
      contingency: finance?.remainingReserve ?? null,
      criticalRisks: risks?.criticalCount ?? 0,
      activeRisks: risks?.openCount ?? 0,
      overallocatedResources: capacity?.overallocatedResourceCount ?? 0,
      dependencyCount: dependencyMap.get(project.id) ?? 0,
      latestSignificantEvents: events
        .slice(-5)
        .reverse()
        .map((event) => ({
          stage: classifyExecutiveStage(event.eventType),
          occurredAt: event.occurredAt,
        })),
    };
  });

  const portfolioHealthScore =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, project) => sum + project.healthScore, 0) /
            projects.length,
        )
      : null;

  return {
    stages,
    connections,
    variants: selectedVariants,
    bottlenecks,
    reworkLoops,
    projects: projects.sort(
      (left, right) =>
        left.healthScore - right.healthScore ||
        left.title.localeCompare(right.title),
    ),
    portfolioHealthScore,
    generatedAt: input.generatedAt,
    dataQualityScore: input.technicalFlow.quality.dataQualityScore,
    limitations: [
      "portfolio_and_program_taxonomy_not_configured_in_current_project_schema",
      "stage_sla_targets_not_configured",
      "period_over_period_trend_requires_historical_snapshots",
      "financials_are_assigned_to_each_projects_current_stage_without_double_counting",
      "temporal_order_is_not_causality",
    ],
  };
}
