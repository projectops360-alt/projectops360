// ============================================================================
// ProjectOps360° — Tests for milestone computed status and progress
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  getComputedMilestoneStatus,
  computeMilestoneProgress,
  computeRoadmapProgress,
  findCurrentMilestone,
  findNextMilestone,
} from '@/lib/roadmap/progress';
import type { Milestone, RoadmapTask } from '@/types/database';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: overrides.id ?? 'm1',
    organization_id: 'org1',
    project_id: 'proj1',
    title: overrides.title ?? 'Test Milestone',
    description: null,
    status: overrides.status ?? 'planned',
    start_date: null,
    target_date: null,
    completed_date: null,
    progress_percent: overrides.progress_percent ?? 0,
    order_index: overrides.order_index ?? 0,
    icon_key: null,
    color_key: null,
    created_by: null,
    deleted_at: null,
    status_override_enabled: overrides.status_override_enabled ?? false,
    status_override_value: overrides.status_override_value ?? null,
  } as Milestone;
}

function makeTask(overrides: Partial<RoadmapTask> = {}): RoadmapTask {
  return {
    id: overrides.id ?? 't1',
    organization_id: 'org1',
    project_id: 'proj1',
    milestone_id: overrides.milestone_id ?? 'm1',
    title: overrides.title ?? 'Test Task',
    description: null,
    status: overrides.status ?? 'not_started',
    priority: overrides.priority ?? 'p2',
    sprint_name: null,
    estimate_hours: null,
    actual_hours: null,
    dependency_notes: null,
    acceptance_criteria: null,
    order_index: overrides.order_index ?? 0,
    external_key: null,
    execution_notes: null,
    completed_at: null,
    prompt_body: null,
    prompt_context: null,
    prompt_version: 0,
    last_prompt_sent_at: null,
    ai_tool_target: null,
    implementation_notes: null,
    test_notes: null,
    start_date: null,
    end_date: null,
    duration_days: null,
    progress: overrides.progress ?? 0,
    is_blocked: overrides.is_blocked ?? false,
    blocker_reason: null,
    is_critical: false,
    slack_days: null,
    earliest_start: null,
    earliest_finish: null,
    latest_start: null,
    latest_finish: null,
    created_by: null,
    deleted_at: null,
  } as RoadmapTask;
}

// ── getComputedMilestoneStatus ──────────────────────────────────────────────────

describe('getComputedMilestoneStatus', () => {
  it('returns stored status when milestone has 0 tasks', () => {
    const milestone = makeMilestone({ status: 'in_progress' });
    const result = getComputedMilestoneStatus(milestone, []);
    expect(result).toBe('in_progress');
  });

  it('returns "planned" when 0 of 5 tasks are done', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ status: 'not_started' }),
      makeTask({ status: 'not_started' }),
      makeTask({ status: 'prompt_ready' }),
      makeTask({ status: 'not_started' }),
      makeTask({ status: 'not_started' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('planned');
  });

  it('returns "in_progress" when 2 of 5 tasks are done', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'in_progress' }),
      makeTask({ status: 'not_started' }),
      makeTask({ status: 'not_started' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('in_progress');
  });

  it('returns "completed" when 5 of 5 tasks are done', () => {
    const milestone = makeMilestone({ status: 'planned' });
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('completed');
  });

  it('returns "in_progress" when 4 of 5 tasks are done (stored status was "completed")', () => {
    const milestone = makeMilestone({ status: 'completed' });
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'in_progress' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('in_progress');
  });

  it('returns "completed" when 5 of 5 tasks are done (stored status was "planned")', () => {
    const milestone = makeMilestone({ status: 'planned' });
    const tasks = Array(5).fill(null).map((_, i) => makeTask({ id: `t${i}`, status: 'done' }));
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('completed');
  });

  it('returns "at_risk" when some tasks are blocked', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'in_progress' }),
      makeTask({ status: 'blocked' }),
      makeTask({ status: 'not_started' }),
      makeTask({ status: 'not_started' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('at_risk');
  });

  it('returns "blocked" when all tasks are blocked', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ id: 't1', status: 'blocked' }),
      makeTask({ id: 't2', status: 'blocked' }),
      makeTask({ id: 't3', status: 'blocked' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('blocked');
  });

  it('returns "deferred" when all tasks are deferred', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ id: 't1', status: 'deferred' }),
      makeTask({ id: 't2', status: 'deferred' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('deferred');
  });

  it('returns override value when status_override_enabled is true', () => {
    const milestone = makeMilestone({ status_override_enabled: true, status_override_value: 'blocked' });
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('blocked');
  });

  it('falls back to computed when override enabled but value is null', () => {
    const milestone = makeMilestone({ status_override_enabled: true, status_override_value: null });
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('completed');
  });

  it('returns "in_progress" when tasks are in various active states', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ id: 't1', status: 'done' }),
      makeTask({ id: 't2', status: 'in_progress' }),
      makeTask({ id: 't3', status: 'implemented' }),
      makeTask({ id: 't4', status: 'not_started' }),
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('in_progress');
  });

  it('ignores tasks with different milestone_id', () => {
    const milestone = makeMilestone({ id: 'm1' });
    const tasks = [
      makeTask({ id: 't1', milestone_id: 'm1', status: 'done' }),
      makeTask({ id: 't2', milestone_id: 'm2', status: 'not_started' }), // different milestone
    ];
    expect(getComputedMilestoneStatus(milestone, tasks)).toBe('completed');
  });

  it('ignores deleted tasks', () => {
    const milestone = makeMilestone({ id: 'm1' });
    const activeTask = makeTask({ id: 't1', milestone_id: 'm1', status: 'done' });
    const deletedTask = makeTask({ id: 't2', milestone_id: 'm1', status: 'not_started' });
    // Simulate a deleted task by adding deleted_at
    (deletedTask as RoadmapTask & { deleted_at: string }).deleted_at = '2026-01-01';
    const tasks = [activeTask, deletedTask];
    // The function filters out deleted tasks, so only 1 active task (done) = completed
    expect(getComputedMilestoneStatus(milestone, tasks as RoadmapTask[])).toBe('completed');
  });
});

// ── computeMilestoneProgress ─────────────────────────────────────────────────────

describe('computeMilestoneProgress', () => {
  it('returns stored progress_percent when milestone has no tasks', () => {
    const milestone = makeMilestone({ progress_percent: 50 });
    const result = computeMilestoneProgress(milestone, []);
    expect(result.progressPercent).toBe(50);
    expect(result.totalTasks).toBe(0);
    expect(result.doneTasks).toBe(0);
  });

  it('computes 0% progress when 0 of 5 tasks are done', () => {
    const milestone = makeMilestone();
    const tasks = Array(5).fill(null).map((_, i) => makeTask({ id: `t${i}`, status: 'not_started' }));
    const result = computeMilestoneProgress(milestone, tasks);
    expect(result.progressPercent).toBe(0);
    expect(result.totalTasks).toBe(5);
    expect(result.doneTasks).toBe(0);
  });

  it('computes 40% progress when 2 of 5 tasks are done', () => {
    const milestone = makeMilestone();
    const tasks = [
      makeTask({ id: 't1', status: 'done' }),
      makeTask({ id: 't2', status: 'done' }),
      makeTask({ id: 't3', status: 'in_progress' }),
      makeTask({ id: 't4', status: 'not_started' }),
      makeTask({ id: 't5', status: 'not_started' }),
    ];
    const result = computeMilestoneProgress(milestone, tasks);
    expect(result.progressPercent).toBe(40);
    expect(result.totalTasks).toBe(5);
    expect(result.doneTasks).toBe(2);
  });

  it('computes 100% progress when 5 of 5 tasks are done', () => {
    const milestone = makeMilestone();
    const tasks = Array(5).fill(null).map((_, i) => makeTask({ id: `t${i}`, status: 'done' }));
    const result = computeMilestoneProgress(milestone, tasks);
    expect(result.progressPercent).toBe(100);
    expect(result.computedStatus).toBe('completed');
  });

  it('includes computedStatus in the result', () => {
    const milestone = makeMilestone();
    const tasks = [makeTask({ status: 'done' }), makeTask({ status: 'in_progress' })];
    const result = computeMilestoneProgress(milestone, tasks);
    expect(result.computedStatus).toBe('in_progress');
  });
});

// ── computeRoadmapProgress ──────────────────────────────────────────────────────

describe('computeRoadmapProgress', () => {
  it('includes computedMilestoneStatuses in the result', () => {
    const m1 = makeMilestone({ id: 'm1', status: 'planned' });
    const m2 = makeMilestone({ id: 'm2', status: 'completed' });
    const tasks = [
      makeTask({ id: 't1', milestone_id: 'm1', status: 'done' }),
      makeTask({ id: 't2', milestone_id: 'm1', status: 'done' }),
      makeTask({ id: 't3', milestone_id: 'm2', status: 'done' }),
      makeTask({ id: 't4', milestone_id: 'm2', status: 'in_progress' }),
    ];
    const result = computeRoadmapProgress([m1, m2], tasks);
    expect(result.computedMilestoneStatuses['m1']).toBe('completed');
    expect(result.computedMilestoneStatuses['m2']).toBe('in_progress');
  });

  it('M1 bug case: 5/5 tasks done with stored "planned" should compute as "completed"', () => {
    const m1 = makeMilestone({ id: 'm1', status: 'planned' });
    const tasks = Array(5).fill(null).map((_, i) => makeTask({ id: `t${i}`, milestone_id: 'm1', status: 'done' }));
    const result = computeRoadmapProgress([m1], tasks);
    expect(result.computedMilestoneStatuses['m1']).toBe('completed');
  });

  it('M2 bug case: 4/5 tasks done with stored "completed" should compute as "in_progress"', () => {
    const m2 = makeMilestone({ id: 'm2', status: 'completed' });
    const tasks = [
      ...Array(4).fill(null).map((_, i) => makeTask({ id: `t${i}`, milestone_id: 'm2', status: 'done' })),
      makeTask({ id: 't4', milestone_id: 'm2', status: 'in_progress' }),
    ];
    const result = computeRoadmapProgress([m2], tasks);
    expect(result.computedMilestoneStatuses['m2']).toBe('in_progress');
  });
});