// ============================================================================
// ProjectOps360° — Root Cause Miner view (CAP-046 F2, server-rendered)
// ============================================================================
// Pure presentation of the statistical Root Cause Miner output. Evidence-only
// by contract: influence scores, rates, samples and examples — the UI renders
// NO recommendation anywhere (PD-019).
// ============================================================================

import { getTranslations } from "next-intl/server";
import { Activity, FlaskConical, OctagonAlert, Repeat2 } from "lucide-react";
import type {
  RootCauseFinding,
  RootCauseMinerResult,
  RootCauseProblemType,
} from "@/lib/process-mining/root-cause";

const PROBLEM_ICONS: Record<RootCauseProblemType, typeof Activity> = {
  delay: Activity,
  blockage: OctagonAlert,
  rework: Repeat2,
};

function ScoreBar({ score }: { score: number }) {
  const width = Math.max(2, Math.min(100, score));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${width}%` }} />
      </div>
      <span className="tabular-nums text-foreground">{score}</span>
    </div>
  );
}

function ConfidenceBadge({ confidence, label }: { confidence: string; label: string }) {
  const styles =
    confidence === "high"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : confidence === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles}`}>{label}</span>
  );
}

export async function RootCauseView({
  result,
  locale,
}: {
  result: RootCauseMinerResult;
  locale: string;
}) {
  const t = await getTranslations("processMining.rootCauses");
  const es = locale === "es";

  return (
    <div className="space-y-4">
      {/* Problem prevalence strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {result.problems.map((stats) => {
          const Icon = PROBLEM_ICONS[stats.problemType];
          return (
            <div key={stats.problemType} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-brand-600" aria-hidden />
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t(`problems.${stats.problemType}`)}
                </p>
              </div>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {stats.problemCount}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {stats.totalTasks} ({Math.round(stats.baselineRate * 100)}%)
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Method + honesty disclosure */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">{t("methodNote")}</p>
      </div>

      {/* Findings */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t("findings.title")}</h2>
        </div>
        {result.findings.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("findings.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t("findings.influence")}</th>
                  <th className="px-3 py-2 font-medium">{t("findings.evidence")}</th>
                  <th className="px-3 py-2 font-medium">{t("findings.sample")}</th>
                  <th className="px-3 py-2 font-medium">{t("findings.confidence")}</th>
                </tr>
              </thead>
              <tbody>
                {result.findings.map((finding: RootCauseFinding) => (
                  <tr
                    key={`${finding.problemType}-${finding.dimension}-${finding.dimensionValue}`}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <ScoreBar score={finding.influenceScore} />
                    </td>
                    <td className="max-w-xl px-3 py-2.5 text-foreground">
                      {es ? finding.explanationEs : finding.explanationEn}
                      {finding.evidence.exampleRefs.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {t("findings.examples")}:{" "}
                          {finding.evidence.exampleRefs.map((example) => example.title).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">
                      n={finding.evidence.groupSize} · φ={finding.evidence.phi}
                    </td>
                    <td className="px-3 py-2.5">
                      <ConfidenceBadge
                        confidence={finding.confidence}
                        label={t(`confidence.${finding.confidence}`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result.limitations.length > 0 && (
        <ul className="space-y-1">
          {result.limitations.map((limitation) => (
            <li key={limitation} className="text-[11px] text-muted-foreground">
              • {limitation}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
