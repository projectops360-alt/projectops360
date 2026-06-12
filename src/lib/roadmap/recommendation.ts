// ============================================================================
// ProjectOps360° — Recommended Next Step Logic
// ============================================================================
// Pure function that computes the single most important next action
// from the current task state. No AI calls — deterministic rules.
// ============================================================================

import type { Milestone, RoadmapTask, TaskStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecommendationAction =
  | "resolve_blocker"    // A P1 task is blocked — resolve it
  | "run_prompt"         // A task has prompt_ready — copy/run the prompt
  | "implement_output"   // A task is sent_to_ai — implement the AI output
  | "test_implementation" // A task is implemented — test it
  | "mark_completed"      // A task is tested — mark it done
  | "start_next"          // A P1 task is not_started — start it
  | "on_track";           // Nothing urgent — roadmap is on track

export interface NextStepRecommendation {
  action: RecommendationAction;
  taskId: string;
  taskTitle: string;
  milestoneId: string | null;
  reason: string;      // Human-readable explanation
  priority: "p1" | "p2" | "p3";
  status: TaskStatus;
}

// ── Recommendation Engine ──────────────────────────────────────────────────────

/**
 * Determine the single most important next step.
 *
 * Priority order:
 * 1. P1 blocked task → resolve blocker
 * 2. prompt_ready task → run the prompt
 * 3. sent_to_ai task → implement AI output
 * 4. implemented task → test it
 * 5. tested task → mark completed
 * 6. not_started P1 task → start it
 * 7. on track — nothing urgent
 */
export function computeNextStep(
  tasks: RoadmapTask[],
  _milestones: Milestone[],
): NextStepRecommendation | null {
  if (tasks.length === 0) return null;

  // Only consider non-deleted tasks (already filtered at query level, but be safe)
  const active = tasks.filter((t) => t.status !== "done" && t.status !== "deferred");

  // 1. Blocked P1 tasks — highest urgency
  const blockedP1 = active
    .filter((t) => t.status === "blocked" && t.priority === "p1")
    .sort((a, b) => a.order_index - b.order_index);
  if (blockedP1.length > 0) {
    const t = blockedP1[0];
    return {
      action: "resolve_blocker",
      taskId: t.id,
      taskTitle: t.title,
      milestoneId: t.milestone_id,
      reason: "Blocked P1 task — resolving blockers restores execution flow.",
      priority: t.priority,
      status: t.status,
    };
  }

  // 2. prompt_ready — AI prompt is ready to run
  const promptReady = active
    .filter((t) => t.status === "prompt_ready")
    .sort(priorityAndOrder);
  if (promptReady.length > 0) {
    const t = promptReady[0];
    return {
      action: "run_prompt",
      taskId: t.id,
      taskTitle: t.title,
      milestoneId: t.milestone_id,
      reason: "Prompt ready — copy and run in your AI tool to start execution.",
      priority: t.priority,
      status: t.status,
    };
  }

  // 3. sent_to_ai — implement the output
  const sentToAi = active
    .filter((t) => t.status === "sent_to_ai")
    .sort(priorityAndOrder);
  if (sentToAi.length > 0) {
    const t = sentToAi[0];
    return {
      action: "implement_output",
      taskId: t.id,
      taskTitle: t.title,
      milestoneId: t.milestone_id,
      reason: "Prompt sent to AI — implement the generated output.",
      priority: t.priority,
      status: t.status,
    };
  }

  // 4. implemented — test it
  const implemented = active
    .filter((t) => t.status === "implemented")
    .sort(priorityAndOrder);
  if (implemented.length > 0) {
    const t = implemented[0];
    return {
      action: "test_implementation",
      taskId: t.id,
      taskTitle: t.title,
      milestoneId: t.milestone_id,
      reason: "Implementation complete — verify it works before closing.",
      priority: t.priority,
      status: t.status,
    };
  }

  // 5. tested — mark completed
  const tested = active
    .filter((t) => t.status === "tested")
    .sort(priorityAndOrder);
  if (tested.length > 0) {
    const t = tested[0];
    return {
      action: "mark_completed",
      taskId: t.id,
      taskTitle: t.title,
      milestoneId: t.milestone_id,
      reason: "Tested and verified — mark as done to update progress.",
      priority: t.priority,
      status: t.status,
    };
  }

  // 6. not_started P1 — start the next important task
  const nextStart = active
    .filter((t) => t.status === "not_started")
    .sort(priorityAndOrder);
  if (nextStart.length > 0) {
    const t = nextStart[0];
    return {
      action: "start_next",
      taskId: t.id,
      taskTitle: t.title,
      milestoneId: t.milestone_id,
      reason: "Next priority task ready to begin.",
      priority: t.priority,
      status: t.status,
    };
  }

  // 7. On track
  return {
    action: "on_track",
    taskId: "",
    taskTitle: "",
    milestoneId: null,
    reason: "All tasks are progressing. No blockers or pending actions.",
    priority: "p2",
    status: "done",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2 };

/** Sort by priority (p1 first), then by order_index. */
function priorityAndOrder(a: RoadmapTask, b: RoadmapTask): number {
  const priDiff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  if (priDiff !== 0) return priDiff;
  return a.order_index - b.order_index;
}