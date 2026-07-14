import { describe, expect, it } from "vitest";
import type { Milestone, RoadmapTask } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import {
  buildTaskCaseSummaries,
  taskIdForCanonicalEvent,
  type TaskAttachmentRef,
} from "../task-case-analysis";

const PROJECT = "00000000-0000-4000-8000-000000000001";
const TASK = "00000000-0000-4000-8000-000000000002";

function task(overrides: Partial<RoadmapTask> = {}): RoadmapTask {
  return {
    id: TASK,
    organization_id: "org",
    project_id: PROJECT,
    milestone_id: "m1",
    title: "Create Prompt Library",
    description: null,
    status: "in_progress",
    priority: "p1",
    sprint_name: null,
    estimate_hours: null,
    actual_hours: null,
    dependency_notes: null,
    acceptance_criteria: null,
    order_index: 1,
    external_key: "T-038",
    execution_notes: null,
    completed_at: null,
    prompt_body: null,
    prompt_context: null,
    prompt_version: 1,
    last_prompt_sent_at: null,
    ai_tool_target: null,
    implementation_notes: null,
    test_notes: null,
    start_date: null,
    end_date: null,
    duration_days: null,
    progress: 50,
    is_blocked: false,
    blocker_reason: null,
    is_critical: false,
    slack_days: null,
    earliest_start: null,
    earliest_finish: null,
    latest_start: null,
    latest_finish: null,
    created_by: null,
    assigned_to: null,
    assigned_resource_id: null,
    assignment_type: null,
    required_skills: [],
    required_crew_size: null,
    estimated_labor_hours: null,
    location_zone: null,
    discipline: null,
    trade_key: null,
    cost_code: null,
    budget_item_id: null,
    source_drawing_id: null,
    source_insight_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function event(overrides: Partial<LivingGraphCanonicalEvent> = {}): LivingGraphCanonicalEvent {
  return {
    eventId: "e1",
    organizationId: "org",
    projectId: PROJECT,
    caseId: PROJECT,
    eventType: "TaskStatusChanged",
    eventCategory: "task",
    eventSchemaVersion: 1,
    eventImportance: "MEDIUM",
    lifecycleClass: "BUSINESS_EVENT",
    subjectType: "task",
    subjectId: TASK,
    actorType: "system",
    actorId: null,
    occurredAt: "2026-07-09T23:21:38.225Z",
    recordedAt: "2026-07-09T23:21:38.848Z",
    sequenceNumber: 131,
    sourceModule: "roadmap",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: TASK,
    fromState: null,
    toState: "prompt_ready",
    causedBy: [],
    isCompensatingEvent: false,
    compensatesEventId: null,
    eventHash: null,
    previousEventHash: null,
    provenance: null,
    confidence: null,
    payload: null,
    visibility: "normal",
    objectRefs: [],
    dataQualityFlags: [],
    captureMethod: "system",
    lateRecorded: false,
    ...overrides,
  };
}

const milestone = { id: "m1", title: "Phase 1A" } as Milestone;

describe("Living Graph task-case analysis", () => {
  it("resolves task identity from source, subject, or object refs", () => {
    const known = new Set([TASK]);
    expect(taskIdForCanonicalEvent(event(), known)).toBe(TASK);
    expect(
      taskIdForCanonicalEvent(
        event({ sourceEntityType: null, sourceEntityId: null }),
        known,
      ),
    ).toBe(TASK);
    expect(
      taskIdForCanonicalEvent(
        event({
          sourceEntityType: null,
          sourceEntityId: null,
          subjectType: null,
          subjectId: null,
          objectRefs: [{ object_type: "roadmap_tasks", object_id: TASK, role: "focal" }],
        }),
        known,
      ),
    ).toBe(TASK);
  });

  it("declares an in-progress case as incomplete instead of verified", () => {
    const [summary] = buildTaskCaseSummaries({
      tasks: [task()],
      milestones: [milestone],
      events: [event()],
    });
    expect(summary.verificationState).toBe("not_complete");
    expect(summary.warningCodes).toContain("incomplete");
    expect(summary.warningCodes).toContain("missing_acceptance_criteria");
    expect(summary.milestoneTitle).toBe("Phase 1A");
  });

  it("requires completion event, criteria, timestamp and evidence to verify completion", () => {
    const attachment: TaskAttachmentRef = {
      id: "a1",
      taskId: TASK,
      subtaskId: null,
      fileName: "prompt-library.md",
      mimeType: "text/markdown",
      createdAt: "2026-07-10T00:00:00.000Z",
    };
    const [summary] = buildTaskCaseSummaries({
      tasks: [
        task({
          status: "done",
          completed_at: "2026-07-10T00:00:00.000Z",
          acceptance_criteria: "Library exists and is documented.",
          progress: 100,
        }),
      ],
      milestones: [milestone],
      events: [event({ eventType: "TaskCompleted", toState: "done" })],
      attachments: [attachment],
    });
    expect(summary.verificationState).toBe("verified_complete");
    expect(summary.warningCodes).toEqual([]);
  });
});
