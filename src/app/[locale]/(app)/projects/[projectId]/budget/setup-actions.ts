"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { authorizeFinancialAction } from "@/lib/financial/authorization";
import { getFinancialFeatureStateFromProcess } from "@/lib/financial/flags";
import { resolveFinancialCapabilities } from "@/lib/financial/capabilities";
import { executeFinancialTransition } from "@/lib/financial/workflow.server";
import {
  calculateFinancialSetupLine,
  FINANCIAL_SETUP_COST_TYPES,
  FINANCIAL_SETUP_PERIOD_BASES,
  FINANCIAL_SETUP_RATE_UNITS,
} from "@/lib/financial/setup-model";
import { createAdminClient } from "@/lib/supabase/admin";

const lineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  costType: z.enum(FINANCIAL_SETUP_COST_TYPES),
  resourceName: z.string().trim().max(160).nullable(),
  controlAccountRef: z.string().trim().max(120).nullable(),
  cbsCode: z.string().trim().max(120).nullable(),
  wbsRef: z.string().trim().max(120).nullable(),
  quantity: z.number().finite().min(0).max(1_000_000_000),
  quantityUnit: z.string().trim().min(1).max(40),
  rate: z.number().finite().min(0).max(1_000_000_000),
  rateUnit: z.enum(FINANCIAL_SETUP_RATE_UNITS),
  periodBasis: z.enum(FINANCIAL_SETUP_PERIOD_BASES),
  periodCount: z.number().finite().min(1).max(1200),
  hoursPerPeriod: z.number().finite().min(0).max(10_000).nullable(),
});

const setupSchema = z.object({
  projectId: z.string().uuid(),
  locale: z.string().min(2).max(5),
  title: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(500),
  scopeStatement: z.string().trim().min(1).max(2000),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  baseDate: z.string().date(),
  asOfDate: z.string().date(),
  estimateClass: z.enum(["1", "2", "3", "4", "5"]),
  lines: z.array(lineSchema).min(1).max(100),
});

type OrgContext = Awaited<ReturnType<typeof getOrgContext>>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unexpected";
}

async function getFinancialAccess(projectId: string): Promise<
  | { ok: true; org: OrgContext; capabilities: ReturnType<typeof resolveFinancialCapabilities> }
  | { ok: false; error: string }
> {
  const featureState = getFinancialFeatureStateFromProcess(projectId);
  if (!featureState.writers) return { ok: false, error: "financial_writers_disabled" };

  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, error: "not_authenticated" };
  }

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "financial_project_scope_conflict" };

  const { data: member } = await supabase
    .from("project_team_members")
    .select("permission_level, project_role, governance_role, can_approve_changes, can_view_budget")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("user_id", org.userId)
    .eq("status", "active")
    .maybeSingle();
  const roleLabel = [member?.project_role, member?.governance_role].filter(Boolean).join(" / ");
  const capabilities = resolveFinancialCapabilities({
    organizationRole: org.role,
    projectPermissionLevel: member?.permission_level ?? null,
    projectRole: roleLabel,
    permissionFlags: {
      can_approve_changes: member?.can_approve_changes === true,
      can_view_budget: member?.can_view_budget === true,
    },
  });
  return { ok: true, org, capabilities };
}

function canPrepare(
  access: Extract<Awaited<ReturnType<typeof getFinancialAccess>>, { ok: true }>,
  projectId: string,
) {
  return authorizeFinancialAction(
    {
      actorType: "human",
      userId: access.org.userId,
      organizationId: access.org.organizationId,
      projectIds: [projectId],
      capabilities: access.capabilities,
    },
    {
      organizationId: access.org.organizationId,
      projectId,
      capability: "financial.prepare",
      occurredAt: new Date().toISOString(),
    },
  );
}

function canApprove(
  access: Extract<Awaited<ReturnType<typeof getFinancialAccess>>, { ok: true }>,
  projectId: string,
) {
  return authorizeFinancialAction(
    {
      actorType: "human",
      userId: access.org.userId,
      organizationId: access.org.organizationId,
      projectIds: [projectId],
      capabilities: access.capabilities,
    },
    {
      organizationId: access.org.organizationId,
      projectId,
      capability: "financial.approve",
      occurredAt: new Date().toISOString(),
    },
  );
}

function resourceTypeForCostType(costType: string): string {
  if (costType === "labor") return "person";
  if (costType === "subcontractor") return "subcontractor";
  if (costType === "software") return "software_license";
  if (costType === "cloud") return "cloud_service";
  if (costType === "material") return "material";
  if (costType === "equipment") return "equipment";
  return "role";
}

function nullableText(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

async function getDraftPackage(projectId: string, organizationId: string) {
  const supabase = createAdminClient();
  const { data: estimates, error } = await supabase
    .from("financial_estimate_versions")
    .select("id, series_id, version_no, status, prepared_by, title, purpose, base_date, as_of_date, currency, classification_value, metadata")
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const estimate = (estimates ?? []).find((item) => (
    (item.metadata as Record<string, unknown> | null)?.capture_source === "pmo_financial_setup"
  ));
  if (!estimate) return null;

  const [{ data: boe, error: boeError }, { data: baselines, error: baselineError }] = await Promise.all([
    supabase
      .from("financial_boe_versions")
      .select("id, status, scope_statement, assumptions, methods, prepared_by")
      .eq("estimate_version_id", estimate.id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("financial_baseline_versions")
      .select("id, baseline_type, status, currency, total_amount, effective_from, version_no, supersedes_id, metadata")
      .eq("source_estimate_version_id", estimate.id)
      .eq("organization_id", organizationId)
      .order("baseline_type", { ascending: true }),
  ]);
  if (boeError) throw new Error(boeError.message);
  if (baselineError) throw new Error(baselineError.message);
  const baselineIds = (baselines ?? []).map((baseline) => baseline.id);
  const { data: lines, error: linesError } = baselineIds.length > 0
    ? await supabase
      .from("financial_baseline_lines")
      .select("id, baseline_version_id, name, control_account_ref, cbs_code, wbs_ref, amount, currency, time_phased_amounts, metadata")
      .in("baseline_version_id", baselineIds)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (linesError) throw new Error(linesError.message);

  return { estimate, boe, baselines: baselines ?? [], lines: lines ?? [] };
}

export async function saveFinancialSetupAction(input: unknown): Promise<{ error?: string; estimateId?: string }> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "validation_error" };
  const data = parsed.data;
  const access = await getFinancialAccess(data.projectId);
  if (!access.ok) return { error: access.error };
  const authorization = canPrepare(access, data.projectId);
  if (!authorization.allowed) return { error: authorization.reason };

  const supabase = createAdminClient();
  const calculatedLines = data.lines.map((line) => calculateFinancialSetupLine({
    ...line,
    resourceName: nullableText(line.resourceName),
    controlAccountRef: nullableText(line.controlAccountRef),
    cbsCode: nullableText(line.cbsCode),
    wbsRef: nullableText(line.wbsRef),
  }));
  const total = calculatedLines.reduce((sum, line) => sum + line.amount, 0);
  if (total <= 0) return { error: "financial_total_required" };

  try {
    const existing = await getDraftPackage(data.projectId, access.org.organizationId);
    const estimateId = existing?.estimate.id ?? randomUUID();
    const estimateSeriesId = existing?.estimate.series_id ?? randomUUID();
    const boeId = existing?.boe?.id ?? randomUUID();
    const existingBaselines = new Map((existing?.baselines ?? []).map((baseline) => [baseline.baseline_type, baseline]));
    const latestByType = new Map<string, string>();
    const { data: activeBaselines } = await supabase
      .from("financial_baseline_versions")
      .select("id, baseline_type")
      .eq("project_id", data.projectId)
      .eq("organization_id", access.org.organizationId)
      .eq("status", "active");
    for (const baseline of activeBaselines ?? []) latestByType.set(baseline.baseline_type, baseline.id);
    const baselineTypes = existing
      ? (["original_budget", "current_baseline"] as const).filter((type) => existingBaselines.has(type))
      : latestByType.has("original_budget")
        ? (["current_baseline"] as const)
        : (["original_budget", "current_baseline"] as const);
    const baselineIds = new Map<string, string>(baselineTypes.map((type) => [
      type,
      existingBaselines.get(type)?.id ?? randomUUID(),
    ]));

    const { data: estimateVersions } = await supabase
      .from("financial_estimate_versions")
      .select("version_no")
      .eq("project_id", data.projectId)
      .eq("organization_id", access.org.organizationId)
      .order("version_no", { ascending: false })
      .limit(1);
    const estimateVersionNo = existing?.estimate.version_no ?? ((estimateVersions?.[0]?.version_no ?? 0) + 1);
    const estimateMetadata = {
      ...((existing?.estimate.metadata as Record<string, unknown> | null) ?? {}),
      capture_source: "pmo_financial_setup",
      prepared_by: access.org.userId,
      scope_statement: data.scopeStatement,
      line_count: calculatedLines.length,
      calculation_contract: "rate_basis_and_planned_quantity_v1",
    };
    const estimatePayload = {
      organization_id: access.org.organizationId,
      project_id: data.projectId,
      series_id: estimateSeriesId,
      version_no: estimateVersionNo,
      title: data.title,
      purpose: data.purpose,
      status: "draft",
      base_date: data.baseDate,
      as_of_date: data.asOfDate,
      currency: data.currency,
      total_amount: total,
      classification_scheme: "AACE_18R_97",
      classification_value: data.estimateClass,
      classification_basis: { source: "AACE_18R_97", capture: "user_entered", method: "bottom_up" },
      quality_status: "available",
      source_refs: [{ source: "pmo_financial_setup", project_id: data.projectId }],
      metadata: estimateMetadata,
      prepared_by: access.org.userId,
    };
    const { error: estimateError } = existing
      ? await supabase.from("financial_estimate_versions").update(estimatePayload).eq("id", estimateId).eq("organization_id", access.org.organizationId)
      : await supabase.from("financial_estimate_versions").insert({ id: estimateId, ...estimatePayload });
    if (estimateError) throw new Error(estimateError.message);

    const boePayload = {
      organization_id: access.org.organizationId,
      project_id: data.projectId,
      estimate_version_id: estimateId,
      version_no: estimateVersionNo,
      status: existing?.boe?.status === "submitted" ? "submitted" : "draft",
      scope_statement: data.scopeStatement,
      inclusions: calculatedLines.map((line) => line.name),
      exclusions: [],
      assumptions: ["Rates and quantities are entered by the project team.", "Actuals remain separate from the estimate."],
      methods: ["bottom_up", "rate_times_quantity"],
      evidence_refs: [{ source: "pmo_financial_setup", estimate_id: estimateId }],
      risk_basis: { status: "to_be_reviewed" },
      contingency_basis: { status: "not_entered" },
      currency_basis: { currency: data.currency, as_of_date: data.asOfDate },
      completeness: { line_count: calculatedLines.length, total_amount: total },
      prepared_by: existing?.boe?.prepared_by ?? access.org.userId,
    };
    const { error: boeError } = existing?.boe
      ? await supabase.from("financial_boe_versions").update(boePayload).eq("id", boeId).eq("organization_id", access.org.organizationId)
      : await supabase.from("financial_boe_versions").insert({ id: boeId, ...boePayload });
    if (boeError) throw new Error(boeError.message);

    const { data: baselineVersions } = await supabase
      .from("financial_baseline_versions")
      .select("baseline_type, version_no")
      .eq("project_id", data.projectId)
      .eq("organization_id", access.org.organizationId)
      .order("version_no", { ascending: false });
    const baselineVersionFor = (baselineType: string) => existingBaselines.get(baselineType)?.version_no ?? (
      (baselineVersions ?? []).filter((baseline) => baseline.baseline_type === baselineType)[0]?.version_no ?? 0
    ) + 1;

    for (const baselineType of baselineTypes) {
      const baselineId = baselineIds.get(baselineType)!;
      const baselinePayload = {
        organization_id: access.org.organizationId,
        project_id: data.projectId,
        version_no: baselineVersionFor(baselineType),
        baseline_type: baselineType,
        status: existingBaselines.get(baselineType)?.status ?? "draft",
        currency: data.currency,
        total_amount: total,
        effective_from: data.baseDate,
        source_estimate_version_id: estimateId,
        supersedes_id: existingBaselines.get(baselineType)?.supersedes_id ?? latestByType.get(baselineType) ?? null,
        metadata: {
          capture_source: "pmo_financial_setup",
          scope_statement: data.scopeStatement,
          prepared_by: access.org.userId,
          approval_status: "pending",
        },
        prepared_by: access.org.userId,
      };
      const { error: baselineError } = existingBaselines.has(baselineType)
        ? await supabase.from("financial_baseline_versions").update(baselinePayload).eq("id", baselineId).eq("organization_id", access.org.organizationId)
        : await supabase.from("financial_baseline_versions").insert({ id: baselineId, ...baselinePayload });
      if (baselineError) throw new Error(baselineError.message);

      await supabase.from("financial_baseline_lines").delete().eq("baseline_version_id", baselineId).eq("organization_id", access.org.organizationId);
      const baselineLines = calculatedLines.map((line) => ({
        organization_id: access.org.organizationId,
        project_id: data.projectId,
        baseline_version_id: baselineId,
        control_account_ref: line.controlAccountRef,
        cbs_code: line.cbsCode,
        wbs_ref: line.wbsRef,
        name: line.name,
        amount: line.amount,
        currency: data.currency,
        time_phased_amounts: line.timePhasedAmounts,
        source_refs: [{ source: "pmo_financial_setup", estimate_id: estimateId }],
        metadata: {
          cost_type: line.costType,
          resource_name: line.resourceName,
          quantity: line.quantity,
          quantity_unit: line.quantityUnit,
          rate: line.rate,
          rate_unit: line.rateUnit,
          period_basis: line.periodBasis,
          period_count: line.periodCount,
          hours_per_period: line.hoursPerPeriod,
          planned_hours: line.plannedHours,
          amount_per_period: line.amountPerPeriod,
          capture_source: "pmo_financial_setup",
        },
      }));
      const { error: linesError } = await supabase.from("financial_baseline_lines").insert(baselineLines);
      if (linesError) throw new Error(linesError.message);
    }

    const { data: projectResources } = await supabase
      .from("resources")
      .select("id, name, resource_type")
      .eq("organization_id", access.org.organizationId)
      .or(`project_id.eq.${data.projectId},project_id.is.null`)
      .is("deleted_at", null);
    const resourcesByName = new Map((projectResources ?? []).map((resource) => [resource.name.trim().toLowerCase(), resource]));
    for (const line of calculatedLines) {
      if (!line.resourceName) continue;
      const key = line.resourceName.trim().toLowerCase();
      const resource = resourcesByName.get(key);
      const resourcePayload = {
        cost_rate: line.rate,
        cost_unit: line.rateUnit,
        metadata: { origin: "financial_setup", last_financial_estimate_id: estimateId, rate_basis: line.rateUnit },
      };
      if (resource) {
        const { error: resourceError } = await supabase.from("resources").update(resourcePayload).eq("id", resource.id).eq("organization_id", access.org.organizationId);
        if (resourceError) throw new Error(resourceError.message);
      } else {
        const { data: createdResource, error: resourceError } = await supabase.from("resources").insert({
          organization_id: access.org.organizationId,
          project_id: data.projectId,
          resource_type: resourceTypeForCostType(line.costType),
          name: line.resourceName,
          status: "active",
          cost_rate: line.rate,
          cost_unit: line.rateUnit,
          metadata: { origin: "financial_setup", last_financial_estimate_id: estimateId, rate_basis: line.rateUnit },
        }).select("id, name, resource_type").single();
        if (resourceError) throw new Error(resourceError.message);
        if (createdResource) resourcesByName.set(key, createdResource);
      }
    }

    await logAudit({
      org: access.org,
      projectId: data.projectId,
      action: existing ? "update" : "create",
      entityType: "financial_setup",
      entityId: estimateId,
      metadata: { total, currency: data.currency, line_count: calculatedLines.length, status: "draft" },
    });
    revalidatePath(`/${data.locale}/projects/${data.projectId}/budget`, "page");
    return { estimateId };
  } catch (error) {
    console.error("Financial setup save failed:", error);
    return { error: errorMessage(error) };
  }
}

export async function submitFinancialSetupAction(input: {
  projectId: string;
  estimateId: string;
  locale: string;
}): Promise<{ error?: string }> {
  const access = await getFinancialAccess(input.projectId);
  if (!access.ok) return { error: access.error };
  const authorization = canPrepare(access, input.projectId);
  if (!authorization.allowed) return { error: authorization.reason };

  const supabase = createAdminClient();
  const { data: estimate } = await supabase
    .from("financial_estimate_versions")
    .select("id, version_no, status, total_amount, currency, prepared_by")
    .eq("id", input.estimateId)
    .eq("project_id", input.projectId)
    .eq("organization_id", access.org.organizationId)
    .maybeSingle();
  if (!estimate) return { error: "financial_record_not_found" };
  if (estimate.status !== "draft") return { error: "financial_already_submitted" };

  const transition = await executeFinancialTransition({
    projectId: input.projectId,
    recordId: input.estimateId,
    domain: "estimate",
    expectedStatus: "draft",
    targetStatus: "submitted",
    operationKey: `financial-setup:${input.estimateId}:submit-estimate`,
    payload: { version: estimate.version_no, amount: estimate.total_amount, currency: estimate.currency },
    evidenceRefs: [`financial_estimate:${input.estimateId}`, `financial_setup:${input.estimateId}`],
  });
  if (!transition.ok) return { error: transition.error ?? "financial_transition_failed" };

  const { error: boeError } = await supabase
    .from("financial_boe_versions")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("estimate_version_id", input.estimateId)
    .eq("organization_id", access.org.organizationId)
    .eq("status", "draft");
  if (boeError) return { error: boeError.message };
  await logAudit({ org: access.org, projectId: input.projectId, action: "update", entityType: "financial_setup", entityId: input.estimateId, metadata: { status: "submitted" } });
  revalidatePath(`/${input.locale}/projects/${input.projectId}/budget`, "page");
  return {};
}

export async function approveFinancialSetupAction(input: {
  projectId: string;
  estimateId: string;
  locale: string;
}): Promise<{ error?: string }> {
  const access = await getFinancialAccess(input.projectId);
  if (!access.ok) return { error: access.error };
  const authorization = canApprove(access, input.projectId);
  if (!authorization.allowed) return { error: authorization.reason };

  const supabase = createAdminClient();
  const { data: estimate } = await supabase
    .from("financial_estimate_versions")
    .select("id, version_no, status, total_amount, currency")
    .eq("id", input.estimateId)
    .eq("project_id", input.projectId)
    .eq("organization_id", access.org.organizationId)
    .maybeSingle();
  const { data: boe } = await supabase
    .from("financial_boe_versions")
    .select("id, status, prepared_by")
    .eq("estimate_version_id", input.estimateId)
    .eq("organization_id", access.org.organizationId)
    .maybeSingle();
  if (!estimate || !boe) return { error: "financial_record_not_found" };
  if (estimate.status !== "submitted" || boe.status !== "submitted") return { error: "financial_setup_not_ready_for_approval" };

  const boeTransition = await executeFinancialTransition({
    projectId: input.projectId,
    recordId: boe.id,
    domain: "boe",
    expectedStatus: "submitted",
    targetStatus: "approved",
    operationKey: `financial-setup:${input.estimateId}:approve-boe`,
    payload: { version: estimate.version_no, amount: estimate.total_amount, currency: estimate.currency },
    evidenceRefs: [`financial_boe:${boe.id}`, `financial_estimate:${input.estimateId}`],
  });
  if (!boeTransition.ok) return { error: boeTransition.error ?? "financial_transition_failed" };

  const { data: baselines } = await supabase
    .from("financial_baseline_versions")
    .select("id, baseline_type, status, prepared_by, metadata")
    .eq("source_estimate_version_id", input.estimateId)
    .eq("project_id", input.projectId)
    .eq("organization_id", access.org.organizationId)
    .in("baseline_type", ["original_budget", "current_baseline"]);
  if (!baselines || baselines.length < 1) return { error: "financial_baseline_missing" };

  for (const baseline of baselines) {
    if (baseline.status === "draft") {
      const { error } = await supabase
        .from("financial_baseline_versions")
        .update({
          status: "approved",
          metadata: {
            ...((baseline.metadata as Record<string, unknown> | null) ?? {}),
            approval_status: "approved",
            approved_by: access.org.userId,
            approved_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", baseline.id)
        .eq("organization_id", access.org.organizationId);
      if (error) return { error: error.message };
    }
    const activation = await executeFinancialTransition({
      projectId: input.projectId,
      recordId: baseline.id,
      domain: "baseline",
      expectedStatus: "approved",
      targetStatus: "active",
      operationKey: `financial-setup:${input.estimateId}:activate-${baseline.baseline_type}`,
      payload: { version: estimate.version_no, amount: estimate.total_amount, currency: estimate.currency },
      evidenceRefs: [`financial_baseline:${baseline.id}`, `financial_boe:${boe.id}`, `financial_estimate:${input.estimateId}`],
    });
    if (!activation.ok) return { error: activation.error ?? "financial_transition_failed" };
  }

  await logAudit({ org: access.org, projectId: input.projectId, action: "update", entityType: "financial_setup", entityId: input.estimateId, metadata: { status: "active", approved_by: access.org.userId } });
  revalidatePath(`/${input.locale}/projects/${input.projectId}/budget`, "page");
  return {};
}
