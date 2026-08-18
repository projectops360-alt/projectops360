/**
 * Friction semantics for the event types observed in Aurora production on
 * 2026-08-17 plus registered work events whose semantics are already explicit
 * in MPF. Unlisted events remain unknown until their semantics are audited.
 */
export const FRICTION_EVENT_TAXONOMY = {
  TaskCreated: { observedStart: false, lifecycle: "creation", effort: "none" },
  TaskAssigned: { observedStart: false, lifecycle: "context", effort: "none" },
  TaskDependencyAdded: { observedStart: false, lifecycle: "context", effort: "none" },
  TaskStarted: { observedStart: true, lifecycle: "forward", effort: "none" },
  TaskResumed: { observedStart: true, lifecycle: "forward", effort: "none" },
  TaskImplemented: { observedStart: true, lifecycle: "forward", effort: "none" },
  TaskTested: { observedStart: true, lifecycle: "forward", effort: "none" },
  TaskCompleted: { observedStart: false, lifecycle: "completion", effort: "none" },
  TaskReopened: { observedStart: false, lifecycle: "rework", effort: "none" },
  TaskStatusChanged: { observedStart: "active_state_only", lifecycle: "transition", effort: "none" },
  TaskMoved: { observedStart: false, lifecycle: "context", effort: "none" },
  TimeLogged: { observedStart: "current_entry_required", lifecycle: "work", effort: "contribution" },
  TimeEntryUpdated: { observedStart: false, lifecycle: "audit_restatement", effort: "restatement" },
  SubtaskCreated: { observedStart: false, lifecycle: "context", effort: "none" },
  SubtaskStarted: { observedStart: true, lifecycle: "work", effort: "none" },
  SubtaskCompleted: { observedStart: true, lifecycle: "work", effort: "none" },
  SubtaskProgressChanged: { observedStart: true, lifecycle: "work", effort: "none" },
  ParentTaskProgressRecalculated: { observedStart: false, lifecycle: "derived", effort: "none" },
  MilestoneCreated: { observedStart: false, lifecycle: "milestone", effort: "none" },
  MilestoneStarted: { observedStart: false, lifecycle: "milestone", effort: "none" },
  MilestoneAchieved: { observedStart: false, lifecycle: "milestone", effort: "none" },
} as const;

export type FrictionTaxonomyEventType = keyof typeof FRICTION_EVENT_TAXONOMY;

export function frictionEventSemantics(eventType: string) {
  return FRICTION_EVENT_TAXONOMY[eventType as FrictionTaxonomyEventType] ?? null;
}
