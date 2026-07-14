import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateEventIntegrity } from "@/lib/events/event-integrity";

function loadEnvTest(): void {
  const path = resolve(process.cwd(), ".env.test");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

const RUN = process.env.PROCESS_MINING_CAPTURE_VERIFY === "1";

describe.runIf(RUN)("P2-T3 mining-ready event integrity (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let capture: typeof import("@/lib/events/process-mining-capture");
  const ids = { organization: "", project: "", actor: "", milestone: randomUUID(), task: randomUUID(), predecessor: randomUUID(), dependency: randomUUID() };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`P2-T3 integrity test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");
    const admin = await import("@/lib/supabase/admin");
    supabase = admin.createAdminClient();
    capture = await import("@/lib/events/process-mining-capture");

    const { data: existing } = await supabase
      .from("projects")
      .select("organization_id, created_by")
      .is("deleted_at", null)
      .limit(1)
      .single();
    ids.organization = existing.organization_id;
    ids.actor = existing.created_by ?? "00000000-0000-0000-0000-000000000001";
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        organization_id: ids.organization,
        slug: `p2t3-integrity-${Date.now()}`,
        title_i18n: { en: "P2-T3 integrity", es: "P2-T3 integridad" },
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;
    const { error: milestoneError } = await supabase.from("milestones").insert({
      id: ids.milestone,
      organization_id: ids.organization,
      project_id: ids.project,
      title: "Design",
      status: "planned",
    });
    if (milestoneError) throw new Error(`milestone insert failed: ${milestoneError.message}`);
    const { error: taskError } = await supabase.from("roadmap_tasks").insert([
      {
        id: ids.predecessor,
        organization_id: ids.organization,
        project_id: ids.project,
        milestone_id: ids.milestone,
        title: "Prepare capture",
        status: "done",
      },
      {
        id: ids.task,
        organization_id: ids.organization,
        project_id: ids.project,
        milestone_id: ids.milestone,
        title: "Validate capture",
        status: "in_progress",
      },
    ]);
    if (taskError) throw new Error(`task insert failed: ${taskError.message}`);
    const { error: dependencyError } = await supabase.from("task_dependencies").insert({
      id: ids.dependency,
      organization_id: ids.organization,
      project_id: ids.project,
      predecessor_id: ids.predecessor,
      successor_id: ids.task,
      dependency_type: "finish_to_start",
      lag_days: 0,
    });
    if (dependencyError) throw new Error(`dependency insert failed: ${dependencyError.message}`);
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS = ids.project;
  }, 120_000);

  afterAll(async () => {
    delete process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS;
    if (ids.project) {
      await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", ids.project);
    }
  }, 60_000);

  it("appends task, milestone and dependency cases with an intact chain and refs", async () => {
    const source = {
      actorType: "human" as const,
      actorId: ids.actor,
      sourceModule: "p2-t3-integrity-test",
      captureMethod: "direct" as const,
      occurredAt: "2026-07-14T08:00:00.000Z",
    };
    const milestone = { milestoneId: ids.milestone, organizationId: ids.organization, projectId: ids.project, title: "Design", status: "planned" };
    const task = { taskId: ids.task, organizationId: ids.organization, projectId: ids.project, title: "Validate capture", status: "not_started", milestoneId: ids.milestone };
    const events = [
      ...capture.buildMilestoneCreatedEvents({ milestone, source }),
      capture.buildMilestoneStatusTransitionEvent({ milestone, fromStatus: "planned", toStatus: "in_progress", source: { ...source, occurredAt: "2026-07-14T08:01:00.000Z" } })!,
      ...capture.buildTaskCreatedEvents({ task, source: { ...source, occurredAt: "2026-07-14T08:02:00.000Z" } }),
      capture.buildTaskStatusTransitionEvent({ task, fromStatus: "not_started", toStatus: "in_progress", source: { ...source, occurredAt: "2026-07-14T08:03:00.000Z" } })!,
      capture.buildTaskDependencyEvent({
        dependency: {
          dependencyId: ids.dependency,
          organizationId: ids.organization,
          projectId: ids.project,
          predecessorId: ids.predecessor,
          successorId: ids.task,
          dependencyType: "finish_to_start",
        },
        change: "added",
        source: { ...source, occurredAt: "2026-07-14T08:04:00.000Z" },
      }),
      capture.buildTaskStatusTransitionEvent({ task, fromStatus: "in_progress", toStatus: "done", source: { ...source, occurredAt: "2026-07-14T08:05:00.000Z" } })!,
    ];

    const result = await capture.captureProcessMiningEvents(events);
    expect(result).toMatchObject({ enabled: true, complete: true });

    const { data: rows, error } = await supabase
      .from("project_event_log")
      .select("event_id, organization_id, project_id, case_id, event_type, event_category, subject_type, subject_id, actor_type, occurred_at, recorded_at, sequence_number, source_module, provenance, event_hash, previous_event_hash, dedup_key")
      .eq("project_id", ids.project)
      .order("sequence_number", { ascending: true });
    expect(error).toBeNull();
    const eventIds = (rows ?? []).map((row: any) => row.event_id);
    const { data: refs } = await supabase
      .from("project_event_objects")
      .select("event_id, object_type, object_id, role")
      .in("event_id", eventIds);
    const refsByEvent = new Map<string, Array<{ objectType: string; objectId: string; role: string }>>();
    for (const ref of refs ?? []) {
      const list = refsByEvent.get(ref.event_id) ?? [];
      list.push({ objectType: ref.object_type, objectId: ref.object_id, role: ref.role });
      refsByEvent.set(ref.event_id, list);
    }
    const report = validateEventIntegrity((rows ?? []).map((row: any) => ({
      eventId: row.event_id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      caseId: row.case_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      actorType: row.actor_type,
      occurredAt: row.occurred_at,
      recordedAt: row.recorded_at,
      sequenceNumber: Number(row.sequence_number),
      sourceModule: row.source_module,
      provenance: row.provenance,
      eventHash: row.event_hash,
      previousEventHash: row.previous_event_hash,
      dedupKey: row.dedup_key,
      objectRefs: refsByEvent.get(row.event_id) ?? [],
    })));

    expect(report.valid, JSON.stringify(report.issues)).toBe(true);
    expect(new Set((rows ?? []).map((row: any) => row.case_id))).toEqual(new Set([ids.milestone, ids.task]));
    expect((rows ?? []).map((row: any) => row.event_type)).toEqual(expect.arrayContaining([
      "MilestoneCreated",
      "MilestoneStarted",
      "TaskCreated",
      "TaskStarted",
      "TaskDependencyAdded",
      "TaskCompleted",
    ]));
  }, 180_000);
});
