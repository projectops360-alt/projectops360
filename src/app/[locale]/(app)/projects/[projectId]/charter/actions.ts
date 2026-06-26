"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectManager, requireProjectContributor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getCharterByProject, snapshotCharterVersion, syncCharterToMemory,
} from "@/lib/charter/service";
import { CHARTER_FIELDS, CHARTER_LOCKED_STATUSES, type CharterFieldKey } from "@/lib/charter/fields";
import type { Locale } from "@/types/database";

const VALID_KEYS = new Set<string>(CHARTER_FIELDS.map((f) => f.key));

/** Charter & governance are PM/PMO concerns: require manager tier. */
async function managerOrg(projectId: string) {
  const gate = await requireProjectManager(projectId);
  return gate.ok ? gate.org : null;
}

/** Read-only charter AI: require at least an active project member. */
async function contributorOrg(projectId: string) {
  const gate = await requireProjectContributor(projectId);
  return gate.ok ? gate.org : null;
}

/** Save edited charter section fields. Editing an approved charter opens a new
 *  working revision (status → revision_required, version bump). */
export async function updateCharterAction(input: {
  projectId: string;
  fields: Partial<Record<CharterFieldKey, string>>;
}): Promise<{ error?: string; status?: string; version?: number }> {
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };

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

/** Draft / Revision → Pending Approval.
 *  Readiness gate: required text fields complete AND governance defined
 *  (≥1 role, ≥1 approval-matrix rule, ≥1 sign-off requested). */
export async function submitCharterAction(input: { projectId: string }): Promise<{ error?: string; missing?: string[] }> {
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };

  const { computeCharterCompletion } = await import("@/lib/charter/fields");
  const completion = computeCharterCompletion(charter as Partial<Record<CharterFieldKey, string>>);
  const [{ count: roleCount }, { count: apprCount }, { count: signCount }] = await Promise.all([
    supabase.from("project_charter_roles").select("id", { count: "exact", head: true }).eq("charter_id", charter.id).is("deleted_at", null),
    supabase.from("project_approval_matrix").select("id", { count: "exact", head: true }).eq("charter_id", charter.id).is("deleted_at", null),
    supabase.from("project_signoffs").select("id", { count: "exact", head: true }).eq("charter_id", charter.id),
  ]);
  const missing: string[] = [];
  if (completion.pct < 100) missing.push("fields");
  if ((roleCount ?? 0) === 0) missing.push("roles");
  if ((apprCount ?? 0) === 0) missing.push("approvals");
  if ((signCount ?? 0) === 0) missing.push("signoffs");
  if (missing.length > 0) return { error: "not_ready", missing };

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
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };

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
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };

  await supabase.from("project_charters")
    .update({ status: "revision_required", approval_notes: input.notes?.trim() || null })
    .eq("id", charter.id).eq("organization_id", org.organizationId);

  await logAudit({ org, projectId: input.projectId, action: "update", entityType: "project_charters", entityId: charter.id, metadata: { status: "revision_required" } });
  return {};
}

// ── Child entities (roles / governance rules / approval matrix / sign-off) ──

async function charterCtx(projectId: string) {
  const org = await managerOrg(projectId);
  if (!org) return null;
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  if (!charter) return null;
  return { org, supabase, charter };
}

/** Upsert a charter role. */
export async function saveCharterRoleAction(input: {
  projectId: string; id?: string;
  role_name: string; person_name?: string; external_contact_name?: string;
  responsibility?: string; authority_level?: string; decision_rights?: string; escalation_level?: number;
}): Promise<{ error?: string }> {
  const ctx = await charterCtx(input.projectId);
  if (!ctx) return { error: "no_charter" };
  const row = {
    organization_id: ctx.org.organizationId, project_id: input.projectId, charter_id: ctx.charter.id,
    role_name: input.role_name.trim(), person_name: input.person_name?.trim() || null,
    external_contact_name: input.external_contact_name?.trim() || null,
    responsibility: input.responsibility?.trim() || null, authority_level: input.authority_level?.trim() || null,
    decision_rights: input.decision_rights?.trim() || null, escalation_level: input.escalation_level ?? null,
  };
  const q = input.id
    ? ctx.supabase.from("project_charter_roles").update(row).eq("id", input.id).eq("organization_id", ctx.org.organizationId)
    : ctx.supabase.from("project_charter_roles").insert(row);
  const { error } = await q;
  return error ? { error: "unexpected" } : {};
}

/** Upsert a governance rule. */
export async function saveGovernanceRuleAction(input: {
  projectId: string; id?: string;
  rule_type: string; rule_name: string; description?: string; trigger_condition?: string;
  required_approval_role?: string; escalation_role?: string; is_active?: boolean;
}): Promise<{ error?: string }> {
  const ctx = await charterCtx(input.projectId);
  if (!ctx) return { error: "no_charter" };
  const row = {
    organization_id: ctx.org.organizationId, project_id: input.projectId, charter_id: ctx.charter.id,
    rule_type: input.rule_type.trim(), rule_name: input.rule_name.trim(), description: input.description?.trim() || null,
    trigger_condition: input.trigger_condition?.trim() || null, required_approval_role: input.required_approval_role?.trim() || null,
    escalation_role: input.escalation_role?.trim() || null, is_active: input.is_active ?? true,
  };
  const q = input.id
    ? ctx.supabase.from("project_governance_rules").update(row).eq("id", input.id).eq("organization_id", ctx.org.organizationId)
    : ctx.supabase.from("project_governance_rules").insert(row);
  const { error } = await q;
  return error ? { error: "unexpected" } : {};
}

/** Upsert an approval-matrix rule. */
export async function saveApprovalRuleAction(input: {
  projectId: string; id?: string;
  approval_area: string; approval_required_from?: string; threshold_type?: string; threshold_value?: string;
  escalation_path?: string; required_response_time?: string; is_active?: boolean;
}): Promise<{ error?: string }> {
  const ctx = await charterCtx(input.projectId);
  if (!ctx) return { error: "no_charter" };
  const row = {
    organization_id: ctx.org.organizationId, project_id: input.projectId, charter_id: ctx.charter.id,
    approval_area: input.approval_area.trim(), approval_required_from: input.approval_required_from?.trim() || null,
    threshold_type: input.threshold_type?.trim() || null, threshold_value: input.threshold_value?.trim() || null,
    escalation_path: input.escalation_path?.trim() || null, required_response_time: input.required_response_time?.trim() || null,
    is_active: input.is_active ?? true,
  };
  const q = input.id
    ? ctx.supabase.from("project_approval_matrix").update(row).eq("id", input.id).eq("organization_id", ctx.org.organizationId)
    : ctx.supabase.from("project_approval_matrix").insert(row);
  const { error } = await q;
  return error ? { error: "unexpected" } : {};
}

/** Add or update a sign-off. Setting status to approved/rejected stamps signed_at. */
export async function saveSignoffAction(input: {
  projectId: string; id?: string; signer_role: string; status?: "pending" | "approved" | "rejected"; comments?: string;
}): Promise<{ error?: string }> {
  const ctx = await charterCtx(input.projectId);
  if (!ctx) return { error: "no_charter" };
  const status = input.status ?? "pending";
  const row = {
    organization_id: ctx.org.organizationId, project_id: input.projectId, charter_id: ctx.charter.id,
    signer_user_id: ctx.org.userId, signer_role: input.signer_role.trim(), status,
    comments: input.comments?.trim() || null,
    signed_at: status === "pending" ? null : new Date().toISOString(),
  };
  const q = input.id
    ? ctx.supabase.from("project_signoffs").update(row).eq("id", input.id).eq("organization_id", ctx.org.organizationId)
    : ctx.supabase.from("project_signoffs").insert(row);
  const { error } = await q;
  return error ? { error: "unexpected" } : {};
}

/** Soft-delete a charter child row (roles / governance rules / approval matrix). */
export async function deleteCharterChildAction(input: {
  projectId: string; table: "project_charter_roles" | "project_governance_rules" | "project_approval_matrix"; id: string;
}): Promise<{ error?: string }> {
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };
  const supabase = createAdminClient();
  const { error } = await supabase.from(input.table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.id).eq("organization_id", org.organizationId);
  return error ? { error: "unexpected" } : {};
}

// ── AI actions (Phase 4) ────────────────────────────────────────────────────

export async function generateCharterDraftAction(input: { projectId: string; locale: string }): Promise<{ error?: string; count?: number }> {
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, input.projectId);
  if (!charter) return { error: "no_charter" };
  if (CHARTER_LOCKED_STATUSES.includes(charter.status as never)) return { error: "locked" };

  const { generateCharterDraft } = await import("@/lib/charter/ai");
  const { fields, count } = await generateCharterDraft(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  if (count === 0) return { error: "ai_failed" };

  // Fill only currently-empty fields (never overwrite the user's content).
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (VALID_KEYS.has(k) && (!charter[k] || !String(charter[k]).trim())) patch[k] = v;
  }
  if (Object.keys(patch).length > 0) {
    await supabase.from("project_charters").update(patch).eq("id", charter.id).eq("organization_id", org.organizationId);
  }
  return { count: Object.keys(patch).length };
}

/** Generate / expand a SINGLE charter field from the user's idea (no save). */
export async function generateFieldAction(input: { projectId: string; fieldKey: string; idea?: string; locale: string }): Promise<{ error?: string; text?: string }> {
  const org = await contributorOrg(input.projectId);
  if (!org) return { error: "forbidden" };
  if (!VALID_KEYS.has(input.fieldKey)) return { error: "bad_field" };
  const { generateCharterField } = await import("@/lib/charter/ai");
  const text = await generateCharterField(org, input.projectId, input.fieldKey as CharterFieldKey, input.idea ?? "", (input.locale === "es" ? "es" : "en") as Locale);
  return text ? { text } : { error: "ai_failed" };
}

export async function gapAnalysisAction(input: { projectId: string; locale: string }) {
  const org = await contributorOrg(input.projectId);
  if (!org) return { error: "forbidden", items: [] as { area: string; severity: string; recommendation: string }[] };
  const { runGapAnalysis } = await import("@/lib/charter/ai");
  const items = await runGapAnalysis(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  return { items };
}

export async function scopeCreepAction(input: { projectId: string; locale: string }) {
  const org = await contributorOrg(input.projectId);
  if (!org) return { error: "forbidden", flags: [] as { item: string; reason: string }[] };
  const { detectScopeCreep } = await import("@/lib/charter/ai");
  const flags = await detectScopeCreep(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  return { flags };
}

export async function stakeholderSummaryAction(input: { projectId: string; locale: string }) {
  const org = await contributorOrg(input.projectId);
  if (!org) return { error: "forbidden", summary: "" };
  const { generateStakeholderSummary } = await import("@/lib/charter/ai");
  const summary = await generateStakeholderSummary(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  return { summary };
}

/** Generate a best-practice governance model (roles + rules + approval matrix)
 *  tailored to the project's nature, and REPLACE the current child rows. */
export async function generateGovernanceAction(input: { projectId: string; locale: string }): Promise<{ error?: string; roles?: number; rules?: number; approvals?: number }> {
  const ctx = await charterCtx(input.projectId);
  if (!ctx) return { error: "no_charter" };
  const locale = (input.locale === "es" ? "es" : "en") as Locale;

  const { generateGovernance } = await import("@/lib/charter/ai");
  const gov = await generateGovernance(ctx.org, input.projectId, locale);
  if (gov.roles.length + gov.governanceRules.length + gov.approvalMatrix.length === 0) return { error: "ai_failed" };

  const orgId = ctx.org.organizationId, charterId = ctx.charter.id, now = new Date().toISOString();

  // Replace existing governance for a clean, coherent set.
  await Promise.all([
    ctx.supabase.from("project_charter_roles").update({ deleted_at: now }).eq("charter_id", charterId).eq("organization_id", orgId).is("deleted_at", null),
    ctx.supabase.from("project_governance_rules").update({ deleted_at: now }).eq("charter_id", charterId).eq("organization_id", orgId).is("deleted_at", null),
    ctx.supabase.from("project_approval_matrix").update({ deleted_at: now }).eq("charter_id", charterId).eq("organization_id", orgId).is("deleted_at", null),
  ]);

  const common = { organization_id: orgId, project_id: input.projectId, charter_id: charterId };
  const roleRows = gov.roles.map((r) => ({ ...common, role_name: r.role_name, responsibility: r.responsibility || null, authority_level: r.authority_level || null, decision_rights: r.decision_rights || null, escalation_level: r.escalation_level || null }));
  const ruleRows = gov.governanceRules.map((r) => ({ ...common, rule_type: r.rule_type, rule_name: r.rule_name, description: r.description || null, trigger_condition: r.trigger_condition || null, required_approval_role: r.required_approval_role || null, escalation_role: r.escalation_role || null, is_active: true }));
  const apprRows = gov.approvalMatrix.map((r) => ({ ...common, approval_area: r.approval_area, approval_required_from: r.approval_required_from || null, threshold_type: r.threshold_type || null, threshold_value: r.threshold_value || null, escalation_path: r.escalation_path || null, required_response_time: r.required_response_time || null, is_active: true }));

  await Promise.all([
    roleRows.length ? ctx.supabase.from("project_charter_roles").insert(roleRows) : Promise.resolve(),
    ruleRows.length ? ctx.supabase.from("project_governance_rules").insert(ruleRows) : Promise.resolve(),
    apprRows.length ? ctx.supabase.from("project_approval_matrix").insert(apprRows) : Promise.resolve(),
  ]);

  return { roles: roleRows.length, rules: ruleRows.length, approvals: apprRows.length };
}

export async function askCharterAction(input: { projectId: string; question: string; locale: string }) {
  const org = await contributorOrg(input.projectId);
  if (!org) return { error: "forbidden", answer: "" };
  if (!input.question?.trim()) return { answer: "" };
  const { askCharter } = await import("@/lib/charter/ai");
  const answer = await askCharter(org, input.projectId, input.question.trim(), (input.locale === "es" ? "es" : "en") as Locale);
  return { answer };
}
