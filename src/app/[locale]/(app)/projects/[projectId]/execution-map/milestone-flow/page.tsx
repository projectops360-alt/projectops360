// ============================================================================
// ProjectOps360° — Milestone Process Flow page (server component, Task 8)
// ============================================================================
// The Living Graph UI CONSUMER for the Milestone Process Flow Engine. Loads the
// engine projection through the read-only adapter, builds the pure display
// view-model server-side, and renders the client view. All intelligence comes
// from the MPF Engine (Tasks 1–7); this route derives nothing, mutates nothing,
// and emits no Project Event Graph events. Unauthorized access renders a safe
// denial state with NO data (deny-by-default, no permissive fallback).
// ============================================================================

import { setRequestLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/types/database";
import { loadMilestoneFlowProjection } from "@/lib/milestone-flow-ui/load-projection";
import { buildMilestoneFlowViewModel } from "@/lib/milestone-flow-ui/selectors";
import { MilestoneFlowView } from "@/components/milestone-flow/milestone-flow-view";

export default async function MilestoneFlowPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("milestoneFlow");
  const result = await loadMilestoneFlowProjection(projectId, locale as Locale);

  if (result.status === "unauthorized") {
    // Safe denial: no project data, no evidence, no scope details leak here.
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

  // Pure display projection — formatting only, no engine logic.
  const vm = buildMilestoneFlowViewModel(result.projection, result.milestoneNamesById);

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

      <MilestoneFlowView
        vm={vm}
        milestoneCount={result.milestoneCount}
        eventCount={result.eventCount}
      />
    </div>
  );
}
