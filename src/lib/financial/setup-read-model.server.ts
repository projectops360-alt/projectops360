import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { FinancialSetupLineInput } from "./setup-model";

export interface FinancialSetupDraftReadModel {
  estimate: {
    id: string;
    status: string;
    title: string;
    purpose: string;
    baseDate: string;
    asOfDate: string;
    currency: string;
    classificationValue: string | null;
  };
  boe: { status: string } | null;
  baselineStatuses: Record<string, string>;
  lines: FinancialSetupLineInput[];
}

export async function getFinancialSetupDraft(
  organizationId: string,
  projectId: string,
): Promise<FinancialSetupDraftReadModel | null> {
  const supabase = createAdminClient();
  const { data: estimates } = await supabase
    .from("financial_estimate_versions")
    .select("id, status, title, purpose, base_date, as_of_date, currency, classification_value, metadata")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .in("status", ["draft", "submitted", "approved", "active"])
    .order("created_at", { ascending: false })
    .limit(20);
  const estimate = (estimates ?? []).find((item) => (
    (item.metadata as Record<string, unknown> | null)?.capture_source === "pmo_financial_setup"
  ));
  if (!estimate) return null;

  const [{ data: boe }, { data: baselines }] = await Promise.all([
    supabase
      .from("financial_boe_versions")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("estimate_version_id", estimate.id)
      .maybeSingle(),
    supabase
      .from("financial_baseline_versions")
      .select("id, baseline_type, status")
      .eq("organization_id", organizationId)
      .eq("source_estimate_version_id", estimate.id),
  ]);
  const preferredBaseline = (baselines ?? []).find((baseline) => baseline.baseline_type === "current_baseline") ?? baselines?.[0];
  if (!preferredBaseline) {
    return {
      estimate: {
        id: estimate.id,
        status: estimate.status,
        title: estimate.title,
        purpose: estimate.purpose,
        baseDate: estimate.base_date,
        asOfDate: estimate.as_of_date,
        currency: estimate.currency,
        classificationValue: estimate.classification_value,
      },
      boe: boe ? { status: boe.status } : null,
      baselineStatuses: Object.fromEntries((baselines ?? []).map((baseline) => [baseline.baseline_type, baseline.status ?? "unknown"])),
      lines: [],
    };
  }

  const { data: rows } = await supabase
    .from("financial_baseline_lines")
    .select("name, control_account_ref, cbs_code, wbs_ref, metadata")
    .eq("organization_id", organizationId)
    .eq("baseline_version_id", preferredBaseline.id)
    .order("created_at", { ascending: true });
  const lines: FinancialSetupLineInput[] = (rows ?? []).map((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    return {
      name: row.name,
      costType: (metadata.cost_type as FinancialSetupLineInput["costType"]) ?? "other",
      resourceName: typeof metadata.resource_name === "string" ? metadata.resource_name : null,
      controlAccountRef: row.control_account_ref,
      cbsCode: row.cbs_code,
      wbsRef: row.wbs_ref,
      quantity: Number(metadata.quantity ?? 0),
      quantityUnit: typeof metadata.quantity_unit === "string" ? metadata.quantity_unit : "units",
      rate: Number(metadata.rate ?? 0),
      rateUnit: (metadata.rate_unit as FinancialSetupLineInput["rateUnit"]) ?? "unit",
      periodBasis: (metadata.period_basis as FinancialSetupLineInput["periodBasis"]) ?? "one_time",
      periodCount: Number(metadata.period_count ?? 1),
      hoursPerPeriod: metadata.hours_per_period == null ? null : Number(metadata.hours_per_period),
    };
  });

  return {
    estimate: {
      id: estimate.id,
      status: estimate.status,
      title: estimate.title,
      purpose: estimate.purpose,
      baseDate: estimate.base_date,
      asOfDate: estimate.as_of_date,
      currency: estimate.currency,
      classificationValue: estimate.classification_value,
    },
    boe: boe ? { status: boe.status } : null,
    baselineStatuses: Object.fromEntries((baselines ?? []).map((baseline) => [baseline.baseline_type, baseline.status ?? "unknown"])),
    lines,
  };
}
