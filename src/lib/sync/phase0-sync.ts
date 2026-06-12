"use server";

/**
 * Phase 0 Sync Module — Importable sync + drift detection for Phase 0 tasks
 *
 * This module ensures that Phase 0 tasks from `src/data/phase0-tasks.ts`
 * are always in sync with the `roadmap_tasks` table in Supabase.
 *
 * Usage:
 *   import { checkPhase0SyncStatus, syncPhase0Tasks } from "@/lib/sync/phase0-sync";
 */

import { phase0Tasks } from "@/data/phase0-tasks";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskStatus as DbTaskStatus } from "@/types/database";

// ── Constants ──────────────────────────────────────────────────────────────────

const PHASE0_KEY_PATTERN = "0.%";
const EXPECTED_PHASE0_COUNT = phase0Tasks.length; // 18

// ── Status Mapping (Phase 0 → DB) ────────────────────────────────────────────

const STATUS_MAP: Record<string, DbTaskStatus> = {
  pending: "not_started",
  in_progress: "in_progress",
  done: "done",
  blocked: "blocked",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Phase0SyncStatus {
  expected: number;
  actual: number;
  synced: boolean;
  missing: string[];     // external_keys found in data but not in DB
  extra: string[];       // external_keys found in DB but not in data (unlikely)
}

export interface Phase0SyncResult {
  upserted: number;
  errors: string[];
}

// ── Check Sync Status ─────────────────────────────────────────────────────────

/**
 * Check how many Phase 0 tasks exist in the DB vs. the expected count.
 * Returns a status object indicating whether sync is needed.
 */
export async function checkPhase0SyncStatus(
  projectId: string
): Promise<Phase0SyncStatus> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("external_key")
    .eq("project_id", projectId)
    .like("external_key", PHASE0_KEY_PATTERN)
    .is("deleted_at", null);

  if (error) {
    console.error("[phase0-sync] Error checking sync status:", error.message);
    return {
      expected: EXPECTED_PHASE0_COUNT,
      actual: 0,
      synced: false,
      missing: phase0Tasks.map((t) => t.id),
      extra: [],
    };
  }

  const dbKeys = new Set((data ?? []).map((r) => r.external_key));
  const dataKeys = new Set(phase0Tasks.map((t) => t.id));

  const missing = phase0Tasks
    .filter((t) => !dbKeys.has(t.id))
    .map((t) => t.id);

  const extra = (data ?? [])
    .filter((r) => !dataKeys.has(r.external_key))
    .map((r) => r.external_key);

  return {
    expected: EXPECTED_PHASE0_COUNT,
    actual: dbKeys.size,
    synced: dbKeys.size === EXPECTED_PHASE0_COUNT && missing.length === 0,
    missing,
    extra,
  };
}

// ── Sync Tasks ────────────────────────────────────────────────────────────────

/**
 * Sync all Phase 0 tasks from the static data file to the `roadmap_tasks` table.
 * Uses upsert by `external_key` for idempotency — safe to call multiple times.
 *
 * Requires orgId and projectId to scope the insert.
 */
export async function syncPhase0Tasks(
  orgId: string,
  projectId: string
): Promise<Phase0SyncResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let upserted = 0;

  // Step 1: Ensure the Phase 0 milestone exists
  const { data: existingMilestone } = await supabase
    .from("milestones")
    .select("id")
    .eq("organization_id", orgId)
    .eq("project_id", projectId)
    .eq("title", "Phase 0 — Foundation & Setup")
    .is("deleted_at", null)
    .maybeSingle();

  let milestoneId: string | null = existingMilestone?.id ?? null;

  if (!milestoneId) {
    const { data: newMilestone, error: mErr } = await supabase
      .from("milestones")
      .insert({
        organization_id: orgId,
        project_id: projectId,
        title: "Phase 0 — Foundation & Setup",
        description:
          "Project foundation: planning, dev environment, i18n, Supabase, security, AI baseline, and core UI.",
        status: "in_progress",
        order_index: 0,
      })
      .select("id")
      .single();

    if (mErr) {
      errors.push(`Milestone insert failed: ${mErr.message}`);
    } else {
      milestoneId = newMilestone.id;
    }
  }

  // Step 2: Upsert each task
  for (let i = 0; i < phase0Tasks.length; i++) {
    const task = phase0Tasks[i];
    const dbStatus = STATUS_MAP[task.defaultStatus] ?? "not_started";
    const isDone = task.defaultStatus === "done";

    // Build description with deliverable and verification info
    let description = task.goal;
    description += `\n\nDeliverable: ${task.deliverable}`;
    description += `\nVerification: ${task.needsVerification ? "required" : "not required"}`;

    // Check if task already exists
    const { data: existing } = await supabase
      .from("roadmap_tasks")
      .select("id")
      .eq("project_id", projectId)
      .eq("external_key", task.id)
      .is("deleted_at", null)
      .maybeSingle();

    const row = {
      organization_id: orgId,
      project_id: projectId,
      milestone_id: milestoneId,
      external_key: task.id,
      title: task.title,
      description,
      status: dbStatus,
      priority: task.priority.toLowerCase(),
      sprint_name: task.sprint,
      estimate_hours: task.estimateHours,
      dependency_notes: task.dependencies.join(", "),
      acceptance_criteria: task.acceptanceCriteria.join("\n"),
      prompt_body: task.prompt,
      prompt_context: task.category,
      order_index: i + 1,
      progress: isDone ? 100 : 0,
      completed_at: isDone ? new Date().toISOString() : null,
    };

    if (existing) {
      const { error: uErr } = await supabase
        .from("roadmap_tasks")
        .update(row)
        .eq("id", existing.id);

      if (uErr) {
        errors.push(`Task ${task.id} update failed: ${uErr.message}`);
      } else {
        upserted++;
      }
    } else {
      const { error: iErr } = await supabase
        .from("roadmap_tasks")
        .insert(row);

      if (iErr) {
        errors.push(`Task ${task.id} insert failed: ${iErr.message}`);
      } else {
        upserted++;
      }
    }
  }

  // Step 3: Upsert dependencies (finish_to_start)
  // Only create deps for tasks that now exist
  const { data: allPhase0Tasks } = await supabase
    .from("roadmap_tasks")
    .select("id, external_key")
    .eq("project_id", projectId)
    .like("external_key", PHASE0_KEY_PATTERN)
    .is("deleted_at", null);

  const taskByKey = new Map(
    (allPhase0Tasks ?? []).map((t) => [t.external_key, t.id])
  );

  for (const task of phase0Tasks) {
    const successorId = taskByKey.get(task.id);
    if (!successorId) continue;

    for (const depId of task.dependencies) {
      const predecessorId = taskByKey.get(depId);
      if (!predecessorId) continue;

      // Check if dependency already exists
      const { data: existingDep } = await supabase
        .from("task_dependencies")
        .select("id")
        .eq("predecessor_id", predecessorId)
        .eq("successor_id", successorId)
        .eq("dependency_type", "finish_to_start")
        .maybeSingle();

      if (!existingDep) {
        const { error: dErr } = await supabase
          .from("task_dependencies")
          .insert({
            organization_id: orgId,
            project_id: projectId,
            predecessor_id: predecessorId,
            successor_id: successorId,
            dependency_type: "finish_to_start",
          });

        if (dErr) {
          errors.push(`Dep ${depId}→${task.id} failed: ${dErr.message}`);
        }
      }
    }
  }

  return { upserted, errors };
}