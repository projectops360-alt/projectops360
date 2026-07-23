import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { getFinancialFeatureStateFromProcess } from "@/lib/financial/flags";
import { getFinancialCockpitSummary } from "@/lib/financial/read-model.server";
import { getFinancialSetupDraft } from "@/lib/financial/setup-read-model.server";
import { BudgetReportClient, type BudgetCategory, type BudgetLine } from "./budget-client";
import { FinancialCockpit } from "./financial-cockpit";
import { FinancialSetup, type FinancialSetupResource } from "./financial-setup";

export default async function ProjectBudgetPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  const { data: materials } = await supabase
    .from("material_requirements")
    .select("id, name, description, quantity, unit_of_measure, estimated_unit_cost, estimated_total_cost, metadata, needs_review, origin")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  // Group by category (from metadata) → subtotals
  const byCategory = new Map<string, BudgetLine[]>();
  let grandTotal = 0;
  let lineCount = 0;
  let unquantified = 0;
  let uncosted = 0;
  const currency = "USD";

  for (const m of materials ?? []) {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const category = String(meta.category ?? "Otros / Other");
    const qty = m.quantity != null ? Number(m.quantity) : null;
    const unitCost = m.estimated_unit_cost != null ? Number(m.estimated_unit_cost) : null;
    const total = m.estimated_total_cost != null ? Number(m.estimated_total_cost) : null;

    lineCount++;
    if (qty == null) unquantified++;
    if (unitCost == null) uncosted++;
    if (total != null) grandTotal += total;

    const line: BudgetLine = {
      id: m.id,
      name: m.name ?? "—",
      spec: m.description ?? null,
      quantity: qty,
      unit: m.unit_of_measure ?? null,
      unitCost,
      total,
      costSource: typeof meta.cost_source === "string" ? meta.cost_source : null,
      needsReview: !!m.needs_review,
    };
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(line);
  }

  const categories: BudgetCategory[] = [...byCategory.entries()]
    .map(([name, lines]) => ({
      name,
      lines,
      subtotal: lines.reduce((s, l) => s + (l.total ?? 0), 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal || a.name.localeCompare(b.name));

  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
  const financialFeatures = getFinancialFeatureStateFromProcess(projectId);
  const financialSummary = financialFeatures.ui
    ? await getFinancialCockpitSummary(org.organizationId, projectId)
    : null;
  const financialSetupDraft = financialFeatures.writers
    ? await getFinancialSetupDraft(org.organizationId, projectId)
    : null;
  const { data: projectResources } = financialFeatures.writers
    ? await supabase
      .from("resources")
      .select("id, name, resource_type, cost_rate, cost_unit")
      .eq("organization_id", org.organizationId)
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true })
    : { data: [] };
  const financialSetupResources: FinancialSetupResource[] = (projectResources ?? []).map((resource) => ({
    id: resource.id,
    name: resource.name,
    resourceType: resource.resource_type,
    costRate: resource.cost_rate == null ? null : Number(resource.cost_rate),
    costUnit: resource.cost_unit,
  }));

  return (
    <>
      {financialFeatures.writers ? (
        <FinancialSetup
          locale={locale}
          projectId={projectId}
          role={org.role}
          resources={financialSetupResources}
          draft={financialSetupDraft}
        />
      ) : null}
      {financialSummary ? (
        <FinancialCockpit
          locale={locale}
          projectId={projectId}
          role={org.role}
          summary={financialSummary}
        />
      ) : null}
      {categories.length > 0 || !financialFeatures.writers ? (
        <BudgetReportClient
          locale={locale}
          projectId={projectId}
          projectName={projectName}
          categories={categories}
          grandTotal={Math.round(grandTotal * 100) / 100}
          currency={currency}
          stats={{ lineCount, unquantified, uncosted }}
        />
      ) : null}
    </>
  );
}
