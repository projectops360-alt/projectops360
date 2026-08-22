"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  buildMilestoneDeletedEvent,
  captureProcessMiningEvents,
} from "@/lib/events/process-mining-capture";
import type { AuditAction } from "@/types/database";

const inputSchema = z.object({
  milestoneId: z.string().uuid("invalid_milestone_id"),
  projectId: z.string().uuid("invalid_project_id"),
});

export type SafeDeleteMilestoneResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "validation_error" | "not_found" | "has_associated_tasks" | "unexpected"; associatedTaskCount?: number };

/**
 * Delete a milestone only when it has ZERO active tasks.
 *
 * This action deliberately does not cascade. The active-task count is checked
 * server-side immediately before the soft delete, scoped to org + project +
 * milestone, so a stale UI cannot accidentally remove work.
 */
export async function safeDeleteMilestoneAction(input: {
  milestoneId: string;
  projectId: string;
}): Promise<SafeDeleteMilestoneResult> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, error: "not_authenticated" };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_error" };

  const { milestoneId, projectId } = parsed.data;
  const supabase = createAdminClient();

  const { data: milestone, error: milestoneError } = await supabase
    .from("milestones")
    .select("id, title, status")
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (milestoneError) {
    console.error("Failed to load milestone before safe delete:", milestoneError);
    return { ok: false, error: "unexpected" };
  }
  if (!milestone) return { ok: false, error: "not_found" };

  // Server-authoritative safety gate. Only ACTIVE tasks count; already archived
  // tasks do not prevent cleanup of an otherwise empty milestone.
  const { count, error: countError } = await supabase
    .from("roadmap_tasks")
    .select("id", { count: "exact", head: true })
    .eq("milestone_id", milestoneId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (countError) {
    console.error("Failed to count milestone tasks before safe delete:", countError);
    return { ok: false, error: "unexpected" };
  }

  const associatedTaskCount = count ?? 0;
  if (associatedTaskCount > 0) {
    return { ok: false, error: "has_associated_tasks", associatedTaskCount };
  }

  const deletedAt = new Date().toISOString();
  const { data: deleted, error: deleteError } = await supabase
    .from("milestones")
    .update({ deleted_at: deletedAt })
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    console.error("Failed to safely delete milestone:", deleteError);
    return { ok: false, error: "unexpected" };
  }

  await logAudit({
    org,
    projectId,
    action: "delete" as AuditAction,
    entityType: "milestones",
    entityId: milestoneId,
    metadata: {
      soft_delete: true,
      safe_delete: true,
      associated_task_count: 0,
      cascaded_to_tasks: false,
    },
  });

  await captureProcessMiningEvents([
    buildMilestoneDeletedEvent({
      milestone: {
        milestoneId: milestone.id,
        organizationId: org.organizationId,
        projectId,
        title: milestone.title,
        status: milestone.status,
      },
      source: {
        actorType: "human",
        actorId: org.userId,
        sourceModule: "roadmap",
        captureMethod: "direct",
      },
    }),
  ]);

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");
  return { ok: true };
}
