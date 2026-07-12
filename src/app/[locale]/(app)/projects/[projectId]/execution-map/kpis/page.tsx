// ============================================================================
// ProjectOps360° — KPI Engine page (CAP-046 F3, server component)
// ============================================================================
// Renders the built-in KPI catalog evaluated against the project's canonical
// data. Every value comes from the SAME definition Isabella and reports use
// (single-definition rule, PD-019 — no metric drift). Read-only; honest
// "not computable" states instead of fake zeros. Custom/NL KPIs run through
// Isabella's evaluate_kpi tool over the same engine.
// ============================================================================

import { setRequestLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowLeft, Gauge, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/types/database";
import { loadKpiDataset } from "@/lib/kpi/load-dataset";
import { KPI_CATALOG, evaluateCatalogKpi } from "@/lib/kpi";

export default async function KpiEnginePage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const es = locale === "es";

  const t = await getTranslations("kpiEngine");
  const load = await loadKpiDataset(projectId, locale as Locale);

  if (load.status === "unauthorized") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-20 text-center">
        <ShieldAlert className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{t("empty.unauthorized.title")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("empty.unauthorized.description")}</p>
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 py-20 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-destructive" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{t("empty.error.title")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("empty.error.description")}</p>
      </div>
    );
  }

  const evaluations = KPI_CATALOG.map((definition) => ({
    definition,
    result: evaluateCatalogKpi(definition, load.dataset),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="hidden truncate text-xs text-muted-foreground md:block">{t("subtitle")}</p>
        </div>
        <Link
          href={`/projects/${projectId}/execution-map`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {t("backToExecutionMap")}
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("scopeNote", { tasks: load.taskCount, milestones: load.milestoneCount })}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {evaluations.map(({ definition, result }) => (
          <div key={definition.slug} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <h2 className="truncate text-sm font-semibold text-foreground">
                {es ? definition.nameEs : definition.nameEn}
              </h2>
            </div>
            {result.status === "ok" ? (
              <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                {result.formatted}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{definition.unit}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("notComputable")}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {es ? definition.descriptionEs : definition.descriptionEn}
            </p>
            <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground" title={definition.expression}>
              {definition.expression}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">{t("isabellaHint")}</p>
    </div>
  );
}
