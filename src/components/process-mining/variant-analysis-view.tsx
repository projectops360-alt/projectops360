// ============================================================================
// ProjectOps360° — Execution Variant Analysis view (CAP-046 F1, server-rendered)
// ============================================================================
// Pure presentation of the Variant Analysis engine output. Read-only: renders
// what the engine computed and discloses data quality honestly (no reference
// without outcomes, truncation notice). No analytics logic lives here.
// ============================================================================

import { getTranslations } from "next-intl/server";
import { CheckCircle2, GitFork, Route, ShieldQuestion, Trophy } from "lucide-react";
import type {
  VariantAnalysis,
  VariantAssignment,
} from "@/lib/process-mining/variants";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function formatDuration(ms: number | null, locale: string): string {
  if (ms === null) return "—";
  if (ms >= DAY_MS) {
    const days = Math.round((ms / DAY_MS) * 10) / 10;
    return locale === "es" ? `${days} días` : `${days} days`;
  }
  const hours = Math.round((ms / HOUR_MS) * 10) / 10;
  return `${hours} h`;
}

/** TaskCompleted → "Task Completed" — language-neutral identifier spacing. */
function humanizeActivity(activity: string): string {
  return activity.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function SignatureChips({ signature, max = 8 }: { signature: string[]; max?: number }) {
  const shown = signature.slice(0, max);
  const rest = signature.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((activity, i) => (
        <span
          key={`${activity}-${i}`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {humanizeActivity(activity)}
        </span>
      ))}
      {rest > 0 && <span className="text-[10px] text-muted-foreground">+{rest}</span>}
    </span>
  );
}

export async function VariantAnalysisView({
  analysis,
  focusAssignment,
  projectTitle,
  truncated,
  locale,
}: {
  analysis: VariantAnalysis;
  focusAssignment: VariantAssignment | null;
  projectTitle: string;
  truncated: boolean;
  locale: string;
}) {
  const t = await getTranslations("processMining.variants");
  const focusVariant = focusAssignment
    ? analysis.variants.find((v) => v.variantId === focusAssignment.variantId)
    : null;
  const reference = analysis.variants.find((v) => v.isReference) ?? null;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("summary.cases")}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{analysis.analyzedCases}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("summary.variants")}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{analysis.variants.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("summary.eventsUsed")}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{analysis.quality.businessEventsUsed}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("summary.decidedCases")}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{analysis.quality.casesWithKnownOutcome}</p>
        </div>
      </div>

      {truncated && (
        <p className="rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {t("truncatedNotice")}
        </p>
      )}

      {/* Focus project card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-brand-600" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">
            {t("focus.title", { project: projectTitle })}
          </h2>
        </div>
        {focusAssignment && focusVariant ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                {t("focus.variantShare", {
                  count: focusVariant.caseCount,
                  pct: focusVariant.frequencyPct,
                })}
              </span>
              {focusAssignment.fitnessVsReference !== null && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  {t("focus.fitness", {
                    pct: Math.round(focusAssignment.fitnessVsReference * 100),
                  })}
                </span>
              )}
            </div>
            <SignatureChips signature={focusVariant.signature} max={14} />
            {focusAssignment.skippedActivities.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("focus.skipped")}: </span>
                {focusAssignment.skippedActivities.map(humanizeActivity).join(" · ")}
              </p>
            )}
            {focusAssignment.insertedActivities.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("focus.inserted")}: </span>
                {focusAssignment.insertedActivities.map(humanizeActivity).join(" · ")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t("focus.noEvents")}</p>
        )}
      </div>

      {/* Reference availability — honest empty state, never invented */}
      {!reference && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">{t("noReference")}</p>
        </div>
      )}

      {/* Variant catalog */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <GitFork className="h-4 w-4 text-brand-600" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{t("catalog.title")}</h2>
        </div>
        {analysis.variants.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("catalog.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t("catalog.sequence")}</th>
                  <th className="px-3 py-2 font-medium">{t("catalog.projects")}</th>
                  <th className="px-3 py-2 font-medium">{t("catalog.frequency")}</th>
                  <th className="px-3 py-2 font-medium">{t("catalog.medianDuration")}</th>
                  <th className="px-3 py-2 font-medium">{t("catalog.rework")}</th>
                  <th className="px-3 py-2 font-medium">{t("catalog.success")}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.variants.map((variant) => (
                  <tr key={variant.variantId} className="border-b border-border/60 last:border-0">
                    <td className="max-w-md px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {variant.isReference && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            {t("catalog.reference")}
                          </span>
                        )}
                        <SignatureChips signature={variant.signature} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{variant.caseCount}</td>
                    <td className="px-3 py-2.5 text-foreground">{variant.frequencyPct}%</td>
                    <td className="px-3 py-2.5 text-foreground">
                      {formatDuration(variant.medianDurationMs, locale)}
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{pct(variant.reworkRate)}</td>
                    <td className="px-3 py-2.5 text-foreground">
                      {variant.successRate === null
                        ? t("catalog.noOutcome")
                        : pct(variant.successRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
