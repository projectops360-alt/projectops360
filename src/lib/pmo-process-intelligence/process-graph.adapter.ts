import {
  EXECUTIVE_STAGE_ORDER,
  executiveStageLabel,
  type PmoPiExecutiveConnection,
  type PmoPiExecutiveProject,
  type PmoPiExecutiveStageKey,
} from "./executive-projection";
import type {
  ProcessGraphActivity,
  ProcessGraphBuildInput,
  ProcessGraphConnection,
  ProcessGraphEdgeKind,
  ProcessGraphEntity,
  ProcessGraphMilestone,
  ProcessGraphProjection,
} from "./process-graph.types";
import {
  projectEntityMetrics,
  stageDefinition,
  stageEntityMetrics,
} from "./process-graph.types";

const stageNodeId = (stage: PmoPiExecutiveStageKey) => `stage:${stage}`;
const projectNodeId = (projectId: string) => `project:${projectId}`;
const milestoneNodeId = (milestoneId: string) => `milestone:${milestoneId}`;
const activityNodeId = (activityId: string) => `activity:${activityId}`;

function layerEdgeKind(input: ProcessGraphBuildInput): ProcessGraphEdgeKind {
  switch (input.layer) {
    case "finance":
      return "budget-flow";
    case "risk":
      return "risk-propagation";
    case "resources":
      return "resource-flow";
    case "dependencies":
      return "dependency";
    case "benefits":
      return "deliverable-flow";
    default:
      return "execution-flow";
  }
}

function projectEntity(
  project: PmoPiExecutiveProject,
  input: ProcessGraphBuildInput,
): ProcessGraphEntity {
  return {
    id: projectNodeId(project.id),
    kind: "project",
    label: project.title,
    definition:
      input.locale === "es"
        ? "Proyecto autorizado dentro del alcance actual de Process Intelligence."
        : "An authorized project inside the current Process Intelligence scope.",
    parentId: stageNodeId(project.currentStage),
    projectId: project.id,
    stageKey: project.currentStage,
    status: project.status,
    metrics: projectEntityMetrics(project),
    includedEntityIds: [project.id],
    evidence: [
      "projects",
      "project_event_log",
      "financial_project_cockpit",
      "risk and capacity read models",
    ],
    href: `${input.base}/projects/${project.id}`,
  };
}

function milestoneEntity(
  milestone: ProcessGraphMilestone,
  project: PmoPiExecutiveProject,
  input: ProcessGraphBuildInput,
): ProcessGraphEntity {
  return {
    id: milestoneNodeId(milestone.id),
    kind: "milestone",
    label: milestone.title,
    definition:
      milestone.description ??
      (input.locale === "es"
        ? "Hito canónico del roadmap del proyecto."
        : "Canonical milestone from the project roadmap."),
    parentId: projectNodeId(project.id),
    projectId: project.id,
    stageKey: project.currentStage,
    status: milestone.status,
    metrics: {
      progressPercent: milestone.progressPercent,
      dataQualityScore: input.executive.dataQualityScore,
    },
    includedEntityIds: [milestone.id],
    evidence: ["milestones", `order_index=${milestone.orderIndex}`],
    href: `${input.base}/projects/${project.id}/roadmap`,
  };
}

function activityEntity(
  activity: ProcessGraphActivity,
  project: PmoPiExecutiveProject,
  input: ProcessGraphBuildInput,
): ProcessGraphEntity {
  return {
    id: activityNodeId(activity.id),
    kind: "activity",
    label: activity.title,
    definition:
      activity.description ??
      (input.locale === "es"
        ? "Actividad de ejecución del roadmap."
        : "Roadmap execution activity."),
    parentId: activity.milestoneId
      ? milestoneNodeId(activity.milestoneId)
      : projectNodeId(project.id),
    projectId: project.id,
    stageKey: project.currentStage,
    status: activity.isBlocked ? "blocked" : activity.status,
    metrics: {
      progressPercent: activity.progressPercent,
      estimateHours: activity.estimateHours,
      actualHours: activity.actualHours,
      dataQualityScore: input.executive.dataQualityScore,
    },
    includedEntityIds: [activity.id],
    evidence: [
      "roadmap_tasks",
      activity.isBlocked ? "recorded blocker" : "recorded status",
      activity.isCritical ? "critical path flag" : "non-critical activity",
    ],
    href: `${input.base}/projects/${project.id}/workboard?task=${activity.id}`,
  };
}

function stageEntity(
  stageKey: PmoPiExecutiveStageKey,
  input: ProcessGraphBuildInput,
): ProcessGraphEntity {
  const stage = input.executive.stages.find((item) => item.key === stageKey)!;
  const definition = stageDefinition(stageKey);
  return {
    id: stageNodeId(stageKey),
    kind: "stage",
    label: definition.label[input.locale],
    definition: definition.definition[input.locale],
    parentId: null,
    projectId: null,
    stageKey,
    status: stage.status,
    metrics: stageEntityMetrics(stage, input.executive.dataQualityScore),
    includedEntityIds: [...stage.projectIds],
    evidence: [
      "project_event_log stage projection",
      ...definition.includes[input.locale],
    ],
    href: null,
  };
}

function stageConnection(
  connection: PmoPiExecutiveConnection,
  input: ProcessGraphBuildInput,
): ProcessGraphConnection {
  return {
    id: `stage-edge:${connection.from}:${connection.to}:${input.layer}`,
    source: stageNodeId(connection.from),
    target: stageNodeId(connection.to),
    sourceLabel: executiveStageLabel(connection.from, input.locale),
    targetLabel: executiveStageLabel(connection.to, input.locale),
    kind: layerEdgeKind(input),
    label:
      input.locale === "es"
        ? `${connection.projectCount} proyectos · ${connection.frequency} transiciones`
        : `${connection.projectCount} projects · ${connection.frequency} transitions`,
    projectIds: input.executive.stages.find(
      (stage) => stage.key === connection.to,
    )?.projectIds ?? [],
    caseCount: connection.projectCount,
    transitionCount: connection.frequency,
    frequency: connection.frequency,
    averageTransitionMs: null,
    averageWaitMs: null,
    reworkCount: 0,
    budgetImpact: null,
    lastObservedAt: input.executive.generatedAt,
    dataQualityScore: input.executive.dataQualityScore,
    evidence: [
      "project_event_log",
      "aggregated stage transition",
      "temporal order is not causality",
    ],
  };
}

function referenceStageConnection(
  from: PmoPiExecutiveStageKey,
  to: PmoPiExecutiveStageKey,
  input: ProcessGraphBuildInput,
): ProcessGraphConnection {
  return {
    id: `stage-reference:${from}:${to}:${input.layer}`,
    source: stageNodeId(from),
    target: stageNodeId(to),
    sourceLabel: executiveStageLabel(from, input.locale),
    targetLabel: executiveStageLabel(to, input.locale),
    kind: layerEdgeKind(input),
    label:
      input.locale === "es"
        ? "Secuencia de referencia · sin transiciones observadas"
        : "Reference sequence · no observed transitions",
    projectIds: [],
    caseCount: 0,
    transitionCount: 0,
    frequency: 0,
    averageTransitionMs: null,
    averageWaitMs: null,
    reworkCount: 0,
    budgetImpact: null,
    lastObservedAt: null,
    dataQualityScore: input.executive.dataQualityScore,
    evidence: [
      "canonical five-stage PMO process",
      "reference sequence only",
      "no observed transition is claimed",
    ],
  };
}

function containmentConnection(
  source: ProcessGraphEntity,
  target: ProcessGraphEntity,
  input: ProcessGraphBuildInput,
): ProcessGraphConnection {
  return {
    id: `contains:${source.id}:${target.id}:${input.layer}`,
    source: source.id,
    target: target.id,
    sourceLabel: source.label,
    targetLabel: target.label,
    kind:
      target.kind === "activity" && input.layer === "dependencies"
        ? "dependency"
        : layerEdgeKind(input),
    label:
      input.locale === "es"
        ? `${target.kind} incluido`
        : `included ${target.kind}`,
    projectIds: target.projectId ? [target.projectId] : [],
    caseCount: 1,
    transitionCount: 1,
    frequency: 1,
    averageTransitionMs: null,
    averageWaitMs: null,
    reworkCount: 0,
    budgetImpact: null,
    lastObservedAt: input.executive.generatedAt,
    dataQualityScore: input.executive.dataQualityScore,
    evidence: [
      `${target.kind} canonical parent reference`,
      "containment is not causality",
    ],
  };
}

function projectMilestones(
  projectId: string,
  input: ProcessGraphBuildInput,
): ProcessGraphMilestone[] {
  return input.hierarchy.milestones
    .filter((milestone) => milestone.projectId === projectId)
    .sort(
      (left, right) =>
        left.orderIndex - right.orderIndex ||
        left.title.localeCompare(right.title),
    );
}

function milestoneActivities(
  milestoneId: string,
  input: ProcessGraphBuildInput,
): ProcessGraphActivity[] {
  return input.hierarchy.activities
    .filter((activity) => activity.milestoneId === milestoneId)
    .sort(
      (left, right) =>
        left.orderIndex - right.orderIndex ||
        left.title.localeCompare(right.title),
    );
}

function addProjectMilestones(
  entities: ProcessGraphEntity[],
  connections: ProcessGraphConnection[],
  project: PmoPiExecutiveProject,
  input: ProcessGraphBuildInput,
): void {
  const parent = entities.find((entity) => entity.id === projectNodeId(project.id));
  if (!parent) return;
  const milestones = projectMilestones(project.id, input);
  for (const milestone of milestones) {
    const entity = milestoneEntity(milestone, project, input);
    entities.push(entity);
    connections.push(containmentConnection(parent, entity, input));
  }
}

function addMilestoneActivities(
  entities: ProcessGraphEntity[],
  connections: ProcessGraphConnection[],
  milestoneId: string,
  project: PmoPiExecutiveProject,
  input: ProcessGraphBuildInput,
): void {
  const parent = entities.find(
    (entity) => entity.id === milestoneNodeId(milestoneId),
  );
  if (!parent) return;
  const activities = milestoneActivities(milestoneId, input);
  for (const activity of activities) {
    entities.push(activityEntity(activity, project, input));
  }

  const activityIds = new Set(activities.map((activity) => activity.id));
  const dependencies = input.hierarchy.dependencies.filter(
    (dependency) =>
      activityIds.has(dependency.predecessorId) &&
      activityIds.has(dependency.successorId),
  );
  if (dependencies.length > 0) {
    for (const dependency of dependencies) {
      connections.push({
        id: `dependency:${dependency.id}`,
        source: activityNodeId(dependency.predecessorId),
        target: activityNodeId(dependency.successorId),
        sourceLabel:
          activities.find(
            (activity) => activity.id === dependency.predecessorId,
          )?.title ?? dependency.predecessorId,
        targetLabel:
          activities.find(
            (activity) => activity.id === dependency.successorId,
          )?.title ?? dependency.successorId,
        kind: "dependency",
        label: `${dependency.dependencyType.replaceAll("_", " ")} · ${dependency.lagDays}d`,
        projectIds: [dependency.projectId],
        caseCount: 1,
        transitionCount: 1,
        frequency: 1,
        averageTransitionMs: null,
        averageWaitMs: dependency.lagDays * 86_400_000,
        reworkCount: 0,
        budgetImpact: null,
        lastObservedAt: null,
        dataQualityScore: input.executive.dataQualityScore,
        evidence: ["task_dependencies", dependency.id],
      });
    }
  } else {
    for (const activity of activities) {
      const entity = entities.find(
        (candidate) => candidate.id === activityNodeId(activity.id),
      );
      if (entity) connections.push(containmentConnection(parent, entity, input));
    }
  }
}

export function buildProcessGraphProjection(
  input: ProcessGraphBuildInput,
): ProcessGraphProjection {
  const entities: ProcessGraphEntity[] = [];
  const connections: ProcessGraphConnection[] = [];
  const projectById = new Map(
    input.executive.projects.map((project) => [project.id, project]),
  );

  if (input.navigation.level === "organization") {
    for (const stageKey of EXECUTIVE_STAGE_ORDER) {
      entities.push(stageEntity(stageKey, input));
    }
    for (const connection of input.executive.connections) {
      connections.push(stageConnection(connection, input));
    }
    for (let index = 0; index < EXECUTIVE_STAGE_ORDER.length - 1; index += 1) {
      const from = EXECUTIVE_STAGE_ORDER[index];
      const to = EXECUTIVE_STAGE_ORDER[index + 1];
      const observed = input.executive.connections.some(
        (connection) => connection.from === from && connection.to === to,
      );
      if (!observed) {
        connections.push(referenceStageConnection(from, to, input));
      }
    }
    if (input.semanticZoom !== "far") {
      for (const stageKey of EXECUTIVE_STAGE_ORDER) {
        if (!input.expandedNodeIds.has(stageNodeId(stageKey))) continue;
        const stage = entities.find((entity) => entity.id === stageNodeId(stageKey))!;
        for (const project of input.executive.projects.filter(
          (candidate) => candidate.currentStage === stageKey,
        )) {
          const entity = projectEntity(project, input);
          entities.push(entity);
          connections.push(containmentConnection(stage, entity, input));
        }
      }
    }
  } else if (input.navigation.level === "stage" && input.navigation.stageKey) {
    const stage = stageEntity(input.navigation.stageKey, input);
    entities.push(stage);
    for (const project of input.executive.projects.filter(
      (candidate) => candidate.currentStage === input.navigation.stageKey,
    )) {
      const entity = projectEntity(project, input);
      entities.push(entity);
      connections.push(containmentConnection(stage, entity, input));
      if (
        input.semanticZoom === "deep" &&
        input.expandedNodeIds.has(entity.id)
      ) {
        addProjectMilestones(entities, connections, project, input);
      }
    }
  } else if (
    input.navigation.level === "project" &&
    input.navigation.projectId
  ) {
    const project = projectById.get(input.navigation.projectId);
    if (project) {
      entities.push(projectEntity(project, input));
      addProjectMilestones(entities, connections, project, input);
      if (input.semanticZoom === "deep") {
        for (const milestone of projectMilestones(project.id, input)) {
          if (input.expandedNodeIds.has(milestoneNodeId(milestone.id))) {
            addMilestoneActivities(
              entities,
              connections,
              milestone.id,
              project,
              input,
            );
          }
        }
      }
    }
  } else if (
    input.navigation.level === "milestone" &&
    input.navigation.projectId &&
    input.navigation.milestoneId
  ) {
    const project = projectById.get(input.navigation.projectId);
    const milestone = input.hierarchy.milestones.find(
      (item) =>
        item.id === input.navigation.milestoneId &&
        item.projectId === input.navigation.projectId,
    );
    if (project && milestone) {
      entities.push(milestoneEntity(milestone, project, input));
      addMilestoneActivities(
        entities,
        connections,
        milestone.id,
        project,
        input,
      );
    }
  }

  const activeBottleneck = input.executive.bottlenecks[0]?.stage
    ? stageNodeId(input.executive.bottlenecks[0].stage)
    : null;
  const activeVariant = input.executive.variants[0]?.id ?? null;

  return {
    entities,
    connections,
    navigation: input.navigation,
    activeBottleneck,
    activeVariant,
    dataQualityScore: input.executive.dataQualityScore,
    limitations: [
      ...input.executive.limitations,
      ...input.hierarchy.limitations,
    ],
  };
}

export function processGraphNodeLabel(
  id: string,
  input: Pick<ProcessGraphBuildInput, "executive" | "hierarchy" | "locale">,
): string | null {
  if (id.startsWith("stage:")) {
    const stage = id.slice("stage:".length) as PmoPiExecutiveStageKey;
    return EXECUTIVE_STAGE_ORDER.includes(stage)
      ? executiveStageLabel(stage, input.locale)
      : null;
  }
  if (id.startsWith("project:")) {
    return (
      input.executive.projects.find(
        (project) => project.id === id.slice("project:".length),
      )?.title ?? null
    );
  }
  if (id.startsWith("milestone:")) {
    return (
      input.hierarchy.milestones.find(
        (milestone) => milestone.id === id.slice("milestone:".length),
      )?.title ?? null
    );
  }
  if (id.startsWith("activity:")) {
    return (
      input.hierarchy.activities.find(
        (activity) => activity.id === id.slice("activity:".length),
      )?.title ?? null
    );
  }
  return null;
}

export function resolveProcessGraphEntity(
  id: string,
  input: Pick<
    ProcessGraphBuildInput,
    "executive" | "hierarchy" | "locale" | "base"
  >,
): ProcessGraphEntity | null {
  if (id.startsWith("stage:")) {
    const stage = id.slice("stage:".length) as PmoPiExecutiveStageKey;
    if (!EXECUTIVE_STAGE_ORDER.includes(stage)) return null;
    return stageEntity(stage, {
      ...input,
      navigation: {
        level: "organization",
        stageKey: null,
        projectId: null,
        milestoneId: null,
      },
      semanticZoom: "far",
      expandedNodeIds: new Set(),
      layer: "process",
    });
  }
  if (id.startsWith("project:")) {
    const project = input.executive.projects.find(
      (candidate) => candidate.id === id.slice("project:".length),
    );
    return project ? projectEntity(project, input as ProcessGraphBuildInput) : null;
  }
  if (id.startsWith("milestone:")) {
    const milestone = input.hierarchy.milestones.find(
      (candidate) => candidate.id === id.slice("milestone:".length),
    );
    const project = milestone
      ? input.executive.projects.find(
          (candidate) => candidate.id === milestone.projectId,
        )
      : null;
    return milestone && project
      ? milestoneEntity(
          milestone,
          project,
          input as ProcessGraphBuildInput,
        )
      : null;
  }
  if (id.startsWith("activity:")) {
    const activity = input.hierarchy.activities.find(
      (candidate) => candidate.id === id.slice("activity:".length),
    );
    const project = activity
      ? input.executive.projects.find(
          (candidate) => candidate.id === activity.projectId,
        )
      : null;
    return activity && project
      ? activityEntity(
          activity,
          project,
          input as ProcessGraphBuildInput,
        )
      : null;
  }
  return null;
}
