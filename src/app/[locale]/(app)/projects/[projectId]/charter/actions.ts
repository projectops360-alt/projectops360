"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getCharterByProject, snapshotCharterVersion, syncCharterToMemory,
} from "@/lib/charter/service";
import { CHARTER_FIELDS, CHARTER_LOCKED_STATUSES, type CharterFieldKey } from "@/lib/charter/fields";
import type { Locale } from "@/types/database";

const VALID_KEYS = new Set<string>(CHARTER_FIELDS.map((f) => f.key));

async function authed() {
  try {
    return await getOrgContext();
  } catch {
    return null;
  }
}

/** Save edited charter section fields. Editing an approved charter opens a new
 *  working revision (status → revision_required, version bump). */
export async function updateCharterAction(input: {
  projectId: string;
  fields: Partial<Record<CharterFieldKey, string>>;
}): Promise<{ error?: string; status?: string; version?: number }> {
  const org = await authed();
  if (!org) return { error: "not_authenticated" };

  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };

  // Whitelist field keys.
  const patch: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(input.fields)) {
    if (VALID_KEYS.has(k)) patch[k] = (v ?? "").trim() || null;
  }
  if (Object.keys(patch).length === 0) return { status: charter.status, version: charter.version };

  // Editing an approved/active charter starts a new revision.
  let status = charter.status;
  let version = charter.version;
  const extra: Record<string, string | number> = {};
  if (CHARTER_LOCKED_STATUSES.includes(charter.status as never)) {
    status = "revision_required";
    version = charter.version + 1;
    extra.status = status;
    extra.version = version;
  }

  const { error } = await supabase
    .from("project_charters")
    .update({ ...patch, ...extra })
    .eq("id", charter.id).eq("organization_id", org.organizationId);
  if (error) return { error: "unexpected" };

  return { status, version };
}

const transition = z.object({ projectId: z.string().uuid(), notes: z.string().max(2000).optional() });

/** Draft / Revision → Pending Approval. */
export async function submitCharterAction(input: { projectId: string }): Promise<{ error?: string }> {
  const org = await authed();
  if (!org) return { error: "not_authenticated" };
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };

  await supabase.from("project_charters")
    .update({ status: "pending_approval" })
    .eq("id", charter.id).eq("organization_id", org.organizationId);

  await logAudit({ org, projectId: input.projectId, action: "update", entityType: "project_charters", entityId: charter.id, metadata: { status: "pending_approval" } });
  return {};
}

/** Approve the charter: lock it, snapshot a version, push to Project Memory. */
export async function approveCharterAction(input: { projectId: string; notes?: string; locale: string }): Promise<{ error?: string }> {
  const parsed = transition.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };
  const org = await authed();
  if (!org) return { error: "not_authenticated" };

  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };

  await supabase.from("project_charters")
    .update({
      status: "approved",
      approved_by: org.userId,
      approved_at: new Date().toISOString(),
      approval_notes: input.notes?.trim() || null,
    })
    .eq("id", charter.id).eq("organization_id", org.organizationId);

  // Snapshot the approved state into version history.
  await snapshotCharterVersion(
    supabase,
    { ...charter, status: "approved", approved_by: org.userId, approved_at: new Date().toISOString() },
    "Charter approved",
    org.userId,
  );

  // Push approved sections into Project Memory (best-effort, fire-and-forget).
  void syncCharterToMemory(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale).catch(() => {});

  await logAudit({ org, projectId: input.projectId, action: "update", entityType: "project_charters", entityId: charter.id, metadata: { status: "approved" } });
  return {};
}

/** Reject → Revision Required, with reviewer notes. */
export async function rejectCharterAction(input: { projectId: string; notes?: string }): Promise<{ error?: string }> {
  const org = await authed();
  if (!org) return { error: "not_authenticated" };
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };

  await supabase.from("project_charters")
    .update({ status: "revision_required", approval_notes: input.notes?.trim() || null })
    .eq("id", charter.id).eq("organization_id", org.organizationId);

  await logAudit({ org, projectId: input.projectId, action: "update", entityType: "project_charters", entityId: charter.id, metadata: { status: "revision_required" } });
  return {};
}
