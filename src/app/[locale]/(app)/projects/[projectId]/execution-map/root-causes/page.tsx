// ============================================================================
// ProjectOps360° — Statistical Root Cause Miner page (CAP-046 F2, server)
// ============================================================================
// UI consumer for the Root Cause Miner. Loads the analysis through the
// read-only adapter and renders it server-side. Evidence-only: no
// recommendations anywhere (PD-019). Deny-by-default on unauthorized access.
// ============================================================================

import { setRequestLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/types/database";
import { loadRootCauseAnalysis } from "@/lib/process-mining/root-cause/load-analysis";
import { RootCauseView } from "@/components/process-mining/root-cause-view";

export default async function RootCausesPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("processMining.rootCauses");
  const result = await loadRootCauseAnalysis(projectId, locale as Locale);

  if (result.status === "unauthorized") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-20 text-center">
        <ShieldAlert className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{t("empty.unauthorized.title")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("empty.unauthorized.description")}</p>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 py-20 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-destructive" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{t("empty.error.title")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("empty.error.description")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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

      <RootCauseView result={result.result} locale={locale} />
    </div>
  );
}
