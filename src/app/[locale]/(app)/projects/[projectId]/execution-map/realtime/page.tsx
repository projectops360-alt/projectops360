import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Radio } from "lucide-react";
import { loadRealtimeGraphSnapshot } from "@/lib/living-graph-realtime-ui/load-snapshot";
import { RealtimeLivingGraph } from "@/components/living-graph-realtime/realtime-living-graph";

// High-Fidelity Realtime Living Graph (Phase 4, Task 5). A PURE CONSUMER of the
// Task 4 hierarchy-safe delta/sync contract — the initial snapshot is loaded as
// an approved delta (from the canonical owners, never process_nodes/raw events)
// and the client narrows it NotebookLM-style. No canonical mutation.
export const dynamic = "force-dynamic";

export default async function RealtimeLivingGraphPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("realtimeGraph");

  const snapshot = await loadRealtimeGraphSnapshot(projectId);
  if (!snapshot) notFound(); // RBAC — project not in the caller's org (fail closed)

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[600px] flex-col">
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="h-4 w-4 text-primary" aria-hidden />
          <h1 className="truncate text-sm font-semibold text-foreground">{t("pageTitle")}</h1>
          <p className="hidden truncate text-xs text-muted-foreground md:block">{t("subtitle")}</p>
        </div>
        <Link
          href={`/projects/${projectId}/execution-map/living-graph`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {t("backToLivingGraph")}
        </Link>
      </div>
      <div className="min-h-0 flex-1 rounded-lg border border-border bg-background">
        <RealtimeLivingGraph
          projectId={projectId}
          locale={locale}
          initialDelta={snapshot.delta}
          ownerNames={snapshot.ownerNames}
          milestones={snapshot.milestones}
          initialSignature={snapshot.signature}
        />
      </div>
    </div>
  );
}
