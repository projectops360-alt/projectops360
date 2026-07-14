// ============================================================================
// ProjectOps360° — Task-lifecycle process explorer projection (read-only)
// ============================================================================

import type { RoadmapTask } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import { isCompletedStatus, isTerminalStatus } from "@/lib/execution/task-activity";
import { taskIdForCanonicalEvent } from "@/lib/graph/task-case-analysis";
import { analyzeVariants } from "@/lib/process-mining/variants";
import type {
  ExecutionVariant,
  VariantAnalysis,
  VariantCaseOutcome,
  VariantEventRef,
} from "@/lib/process-mining/variants";

export interface TaskProcessCase {
  taskId: string;
  label: string;
  status: string;
  events: LivingGraphCanonicalEvent[];
}

export interface TaskProcessModel {
  cases: TaskProcessCase[];
  variants: VariantAnalysis;
  eventsWithoutTask: number;
  eventsWithoutBusinessTime: number;
}

export interface ProcessActivityAggregate {
  id: string;
  eventType: string;
  eventCount: number;
  caseCount: number;
  caseCoveragePct: number;
  startCaseCount: number;
  endCaseCount: number;
  averageOrdinal: number;
}

export interface ProcessTransitionAggregate {
  id: string;
  sourceActivityId: string;
  targetActivityId: string;
  sourceEventType: string;
  targetEventType: string;
  occurrenceCount: number;
  caseCount: number;
  medianDurationMs: number | null;
}

export interface TaskProcessAggregate {
  activities: ProcessActivityAggregate[];
  transitions: ProcessTransitionAggregate[];
  visibleCaseCount: number;
  visibleEventCount: number;
}

export type TaskProcessDiscoveryStatus =
  | "ready"
  | "no_events"
  | "single_activity"
  | "no_direct_follow";

export interface TaskProcessDiscoveryAssessment {
  status: TaskProcessDiscoveryStatus;
  isDiscoverable: boolean;
  distinctActivityCount: number;
  directFollowCount: number;
}

function activityId(eventType: string): string {
  return `process-activity:${encodeURIComponent(eventType)}`;
}

function transitionId(source: string, target: string): string {
  return `process-transition:${encodeURIComponent(source)}:${encodeURIComponent(target)}`;
}

function outcomeForTask(task: RoadmapTask): VariantCaseOutcome {
  if (isCompletedStatus(task.status)) return "success";
  if (isTerminalStatus(task.status)) return "failure";
  return "open";
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function minableEvent(event: LivingGraphCanonicalEvent): boolean {
  return (
    event.lifecycleClass === "BUSINESS_EVENT" &&
    !event.isCompensatingEvent &&
    event.occurredAt != null &&
    Number.isFinite(Date.parse(event.occurredAt))
  );
}

export function buildTaskProcessModel(input: {
  tasks: readonly RoadmapTask[];
  events: readonly LivingGraphCanonicalEvent[];
}): TaskProcessModel {
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const knownTaskIds = new Set(taskById.keys());
  const eventsByTask = new Map<string, LivingGraphCanonicalEvent[]>();
  let eventsWithoutTask = 0;
  let eventsWithoutBusinessTime = 0;

  for (const event of input.events) {
    const taskId = taskIdForCanonicalEvent(event, knownTaskIds);
    if (!taskId) {
      eventsWithoutTask += 1;
      continue;
    }
    if (event.occurredAt == null || !Number.isFinite(Date.parse(event.occurredAt))) {
      eventsWithoutBusinessTime += 1;
    }
    const list = eventsByTask.get(taskId) ?? [];
    list.push(event);
    eventsByTask.set(taskId, list);
  }

  const cases: TaskProcessCase[] = input.tasks.map((task) => ({
    taskId: task.id,
    label: task.external_key ? `${task.external_key} · ${task.title}` : task.title,
    status: task.status,
    events: [...(eventsByTask.get(task.id) ?? [])]
      .filter(minableEvent)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber),
  }));

  const variants = analyzeVariants(
    "task_lifecycle",
    cases.map((taskCase) => {
      const task = taskById.get(taskCase.taskId)!;
      const events: VariantEventRef[] = taskCase.events.map((event) => ({
        eventId: event.eventId,
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        occurredAt: event.occurredAt!,
        lifecycleClass: event.lifecycleClass ?? "BUSINESS_EVENT",
        isCompensatingEvent: event.isCompensatingEvent,
      }));
      return {
        caseId: taskCase.taskId,
        caseLabel: taskCase.label,
        events,
        outcome: outcomeForTask(task),
      };
    }),
  );

  return { cases, variants, eventsWithoutTask, eventsWithoutBusinessTime };
}

function takeByCoverage<T>(
  rows: readonly T[],
  weight: (row: T) => number,
  coveragePct: number,
): T[] {
  if (rows.length === 0) return [];
  const bounded = Math.min(100, Math.max(1, coveragePct));
  const total = rows.reduce((sum, row) => sum + Math.max(0, weight(row)), 0);
  if (total === 0 || bounded === 100) return [...rows];
  const target = total * (bounded / 100);
  const selected: T[] = [];
  let cumulative = 0;
  for (const row of rows) {
    selected.push(row);
    cumulative += Math.max(0, weight(row));
    if (cumulative >= target) break;
  }
  return selected;
}

export function aggregateTaskProcess(
  model: TaskProcessModel,
  options: {
    caseIds?: ReadonlySet<string> | null;
    activityCoveragePct: number;
    connectionCoveragePct: number;
  },
): TaskProcessAggregate {
  const cases = model.cases.filter(
    (taskCase) =>
      taskCase.events.length > 0 &&
      (!options.caseIds || options.caseIds.has(taskCase.taskId)),
  );
  const activityMap = new Map<
    string,
    {
      eventType: string;
      eventCount: number;
      caseIds: Set<string>;
      startCaseIds: Set<string>;
      endCaseIds: Set<string>;
      ordinalTotal: number;
    }
  >();
  const transitionMap = new Map<
    string,
    {
      sourceEventType: string;
      targetEventType: string;
      occurrenceCount: number;
      caseIds: Set<string>;
      durations: number[];
    }
  >();

  for (const taskCase of cases) {
    taskCase.events.forEach((event, index) => {
      const current = activityMap.get(event.eventType) ?? {
        eventType: event.eventType,
        eventCount: 0,
        caseIds: new Set<string>(),
        startCaseIds: new Set<string>(),
        endCaseIds: new Set<string>(),
        ordinalTotal: 0,
      };
      current.eventCount += 1;
      current.caseIds.add(taskCase.taskId);
      current.ordinalTotal += index;
      if (index === 0) current.startCaseIds.add(taskCase.taskId);
      if (index === taskCase.events.length - 1) current.endCaseIds.add(taskCase.taskId);
      activityMap.set(event.eventType, current);

      const next = taskCase.events[index + 1];
      if (!next) return;
      const key = `${event.eventType}\u0000${next.eventType}`;
      const transition = transitionMap.get(key) ?? {
        sourceEventType: event.eventType,
        targetEventType: next.eventType,
        occurrenceCount: 0,
        caseIds: new Set<string>(),
        durations: [],
      };
      transition.occurrenceCount += 1;
      transition.caseIds.add(taskCase.taskId);
      const from = event.occurredAt ? Date.parse(event.occurredAt) : Number.NaN;
      const to = next.occurredAt ? Date.parse(next.occurredAt) : Number.NaN;
      if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
        transition.durations.push(to - from);
      }
      transitionMap.set(key, transition);
    });
  }

  const allActivities: ProcessActivityAggregate[] = [...activityMap.values()]
    .map((activity) => ({
      id: activityId(activity.eventType),
      eventType: activity.eventType,
      eventCount: activity.eventCount,
      caseCount: activity.caseIds.size,
      caseCoveragePct:
        cases.length > 0 ? Math.round((activity.caseIds.size / cases.length) * 10_000) / 100 : 0,
      startCaseCount: activity.startCaseIds.size,
      endCaseCount: activity.endCaseIds.size,
      averageOrdinal: activity.eventCount > 0 ? activity.ordinalTotal / activity.eventCount : 0,
    }))
    .sort(
      (a, b) =>
        b.caseCount - a.caseCount ||
        b.eventCount - a.eventCount ||
        a.eventType.localeCompare(b.eventType),
    );
  const activities = takeByCoverage(
    allActivities,
    (activity) => activity.eventCount,
    options.activityCoveragePct,
  );
  const activityIds = new Set(activities.map((activity) => activity.id));

  const allTransitions: ProcessTransitionAggregate[] = [...transitionMap.values()]
    .map((transition) => ({
      id: transitionId(transition.sourceEventType, transition.targetEventType),
      sourceActivityId: activityId(transition.sourceEventType),
      targetActivityId: activityId(transition.targetEventType),
      sourceEventType: transition.sourceEventType,
      targetEventType: transition.targetEventType,
      occurrenceCount: transition.occurrenceCount,
      caseCount: transition.caseIds.size,
      medianDurationMs: median(transition.durations),
    }))
    .filter(
      (transition) =>
        activityIds.has(transition.sourceActivityId) &&
        activityIds.has(transition.targetActivityId),
    )
    .sort(
      (a, b) =>
        b.caseCount - a.caseCount ||
        b.occurrenceCount - a.occurrenceCount ||
        a.id.localeCompare(b.id),
    );
  const transitions = takeByCoverage(
    allTransitions,
    (transition) => transition.occurrenceCount,
    options.connectionCoveragePct,
  );

  return {
    activities,
    transitions,
    visibleCaseCount: cases.length,
    visibleEventCount: cases.reduce((sum, taskCase) => sum + taskCase.events.length, 0),
  };
}

export function assessTaskProcessDiscovery(
  aggregate: TaskProcessAggregate,
): TaskProcessDiscoveryAssessment {
  const distinctActivityCount = aggregate.activities.length;
  const directFollowCount = aggregate.transitions.filter(
    (transition) => transition.sourceActivityId !== transition.targetActivityId,
  ).length;

  if (aggregate.visibleEventCount === 0 || distinctActivityCount === 0) {
    return {
      status: "no_events",
      isDiscoverable: false,
      distinctActivityCount,
      directFollowCount,
    };
  }
  if (distinctActivityCount === 1) {
    return {
      status: "single_activity",
      isDiscoverable: false,
      distinctActivityCount,
      directFollowCount,
    };
  }
  if (directFollowCount === 0) {
    return {
      status: "no_direct_follow",
      isDiscoverable: false,
      distinctActivityCount,
      directFollowCount,
    };
  }
  return {
    status: "ready",
    isDiscoverable: true,
    distinctActivityCount,
    directFollowCount,
  };
}

export function variantForId(
  model: TaskProcessModel,
  variantId: string | null,
): ExecutionVariant | null {
  if (!variantId || variantId === "all") return null;
  return model.variants.variants.find((variant) => variant.variantId === variantId) ?? null;
}
