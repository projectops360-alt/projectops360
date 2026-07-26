"use client";

// ============================================================================
// PMO Intelligence Center — Isabella Intelligence (CAP-048 Phase 2, M6)
// ============================================================================
// The six deterministic CAP-047 rules, rendered over Dashboard 3's scope.
//
// Three properties are load-bearing and each has a test:
//
//   EVIDENCE IS REAL. "View evidence" shows the `PmoPiEvidencePackage` the rule
//   produced — its formulas, the projections it read, its assumptions,
//   limitations, cutoff and data-quality score. Nothing is generated here, and
//   nothing is summarised into a friendlier sentence: a claim a PMO cannot
//   check is a claim they should not act on.
//
//   FEEDBACK REUSES THE EXISTING ACTION. Accept / reject / defer call
//   `recordPmoInsightFeedbackAction`, which forwards to
//   `recordInsightFeedbackAction` — Dashboard 2's action, writing to
//   `audit_logs` exactly as before. ADR-012 §2: commands are re-exported, never
//   reimplemented. A second feedback path would produce a second audit shape.
//
//   OPEN IN MAP USES `openInMapActivities`. Only bottleneck and rework rules
//   carry ids (parity matrix §2), so the button appears only for those. The
//   others say the insight has no canvas counterpart rather than offering a
//   button that lands nowhere.
// ============================================================================

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronUp, Clock, MapPin, PanelRightClose, Sparkles, X } from "lucide-react";
import type { PmoPiInsight } from "@/lib/pmo-process-intelligence/insights";
import { recordPmoInsightFeedbackAction } from "@/lib/pmo-intelligence/commands.server";

export interface PmoInsightsPanelProps {
  insights: readonly PmoPiInsight[];
  locale: "en" | "es";
  scopeLabel: string;
  /** Activities the insight names, handed to the shell to resolve and centre. */
  onOpenInMap: (insight: PmoPiInsight) => void;
  /** Called when an evidence package is opened, so the scope can record it. */
  onEvidenceOpen: (insightId: string | null) => void;
  onAskIsabella: (insight: PmoPiInsight) => void;
  /** Collapse the panel and give the space back to the canvas. */
  onClose: () => void;
}

const SEVERITY_CLASS: Record<PmoPiInsight["severity"], string> = {
  critical: "border-rose-200 bg-rose-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-sky-200 bg-sky-50",
};

export function PmoInsightsPanel({
  insights,
  locale,
  scopeLabel,
  onOpenInMap,
  onEvidenceOpen,
  onAskIsabella,
  onClose,
}: PmoInsightsPanelProps) {
  const t = useTranslations("pmoIntelligence");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});

  async function sendFeedback(
    insight: PmoPiInsight,
    decision: "accepted" | "rejected" | "deferred",
  ) {
    // Optimistic, then rolled back on failure. A button that appears to have
    // worked and silently did not is the worst outcome for an audited action.
    setDecisions((current) => ({ ...current, [insight.id]: decision }));
    setFailed((current) => {
      const next = { ...current };
      delete next[insight.id];
      return next;
    });

    const result = await recordPmoInsightFeedbackAction({
      insightId: insight.id,
      rule: insight.rule,
      decision,
      reason: reasons[insight.id],
      title: insight.title[locale],
      confidence: insight.confidence,
      severity: insight.severity,
      contextScope: scopeLabel,
      affectedProjectCount: insight.affectedProjectCount,
      knowledgeVersion: insight.knowledgeVersion,
      ruleSnapshotVersion: insight.ruleSnapshotVersion,
      // The evidence travels with the decision, so the audit row records what
      // the reviewer was actually looking at when they made it.
      evidence: {
        formulas: insight.evidence.formulas,
        projections: insight.evidence.projections,
        technicalEventTypes: insight.evidence.technicalEventTypes ?? [],
        affectedCaseCount: insight.evidence.affectedCaseCount ?? null,
        cutoffDate: insight.evidence.cutoffDate ?? null,
        dataQualityScore: insight.evidence.dataQualityScore,
      },
    });

    if (result.error) {
      setDecisions((current) => {
        const next = { ...current };
        delete next[insight.id];
        return next;
      });
      setFailed((current) => ({ ...current, [insight.id]: result.error as string }));
    }
  }

  const toggleEvidence = (insightId: string) => {
    const next = expanded === insightId ? null : insightId;
    setExpanded(next);
    onEvidenceOpen(next);
  };

  return (
    <section
      aria-label={t("insightsTitle")}
      className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white"
    >
      <header className="border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-500" aria-hidden />
            <span className="truncate">{t("insightsTitle")}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            title={t("panelHideIsabella")}
            aria-label={t("panelHideIsabella")}
            className="ml-auto shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {/* The count is spelled out. A bare number beside the title was read as
            an unexplained badge — it never said what it was counting. */}
        <p className="mt-0.5 text-[10px] font-semibold text-slate-600">
          {t("insightsFindingCount", { count: insights.length })}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {t("insightsScope", { scope: scopeLabel })}
        </p>
      </header>

      {insights.length === 0 ? (
        <p className="p-3 text-xs text-slate-500">{t("insightsEmpty")}</p>
      ) : (
        <ul className="space-y-2 p-3">
          {insights.map((insight) => {
            const open = expanded === insight.id;
            const decision = decisions[insight.id];
            const canOpenInMap =
              insight.openInMapActivities != null && insight.openInMapActivities.length > 0;

            return (
              <li
                key={insight.id}
                className={`rounded-lg border p-2 ${SEVERITY_CLASS[insight.severity]}`}
              >
                <p className="text-[11px] font-extrabold text-slate-900">
                  {insight.title[locale]}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-700">{insight.summary[locale]}</p>

                {/* Finding, scope, impact, confidence — the four things a PMO
                    needs before deciding whether to act. */}
                <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
                  <dt className="font-bold">{t("insightScope")}</dt>
                  <dd>{t("insightProjects", { count: insight.affectedProjectCount })}</dd>
                  <dt className="font-bold">{t("insightImpact")}</dt>
                  <dd>{insight.impact[locale]}</dd>
                  <dt className="font-bold">{t("insightConfidence")}</dt>
                  <dd>{Math.round(insight.confidence * 100)}%</dd>
                  <dt className="font-bold">{t("insightHorizon")}</dt>
                  <dd>{t(`insightHorizon_${insight.horizon}`)}</dd>
                </dl>

                <p className="mt-1 text-[10px] font-bold text-slate-900">
                  → {insight.recommendedAction[locale]}
                </p>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => toggleEvidence(insight.id)}
                    aria-expanded={open}
                    className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {open ? (
                      <ChevronUp className="h-2.5 w-2.5" aria-hidden />
                    ) : (
                      <ChevronDown className="h-2.5 w-2.5" aria-hidden />
                    )}
                    {t("insightEvidence")}
                  </button>

                  {canOpenInMap ? (
                    <button
                      type="button"
                      onClick={() => onOpenInMap(insight)}
                      className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <MapPin className="h-2.5 w-2.5" aria-hidden />
                      {t("insightOpenInMap")}
                    </button>
                  ) : (
                    // Stated, not hidden: a rule with no activity ids has no
                    // canvas counterpart, which is a property of the rule.
                    <span className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                      {t("insightNoMapTarget")}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onAskIsabella(insight)}
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t("insightAsk")}
                  </button>
                </div>

                {open ? <EvidenceBlock insight={insight} /> : null}

                {open && !decision ? (
                  <label className="mt-1 block">
                    <span className="text-[10px] font-bold text-slate-600">
                      {t("insightReason")}
                    </span>
                    <textarea
                      value={reasons[insight.id] ?? ""}
                      onChange={(event) =>
                        setReasons((current) => ({ ...current, [insight.id]: event.target.value }))
                      }
                      maxLength={1000}
                      className="mt-0.5 min-h-12 w-full rounded border border-slate-300 bg-white p-1 text-[10px] text-slate-800"
                    />
                  </label>
                ) : null}

                <div className="mt-1.5 flex items-center gap-1">
                  {decision ? (
                    <span className="text-[10px] font-semibold text-slate-600">
                      {t("insightFeedbackRecorded", { decision: t(`insightDecision_${decision}`) })}
                    </span>
                  ) : (
                    <>
                      <FeedbackButton
                        icon={<Check className="h-2.5 w-2.5" aria-hidden />}
                        label={t("insightAccept")}
                        onClick={() => void sendFeedback(insight, "accepted")}
                      />
                      <FeedbackButton
                        icon={<X className="h-2.5 w-2.5" aria-hidden />}
                        label={t("insightReject")}
                        onClick={() => void sendFeedback(insight, "rejected")}
                      />
                      <FeedbackButton
                        icon={<Clock className="h-2.5 w-2.5" aria-hidden />}
                        label={t("insightDefer")}
                        onClick={() => void sendFeedback(insight, "deferred")}
                      />
                    </>
                  )}
                </div>

                {failed[insight.id] ? (
                  <p role="alert" className="mt-1 text-[10px] font-semibold text-rose-700">
                    {t("insightFeedbackFailed", { reason: failed[insight.id] })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FeedbackButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * The evidence package, rendered as produced.
 *
 * Every field of `PmoPiEvidencePackage` that carries meaning is shown, including
 * the uncomfortable ones — limitations and data quality. An evidence view that
 * shows only the supporting half is not evidence.
 */
function EvidenceBlock({ insight }: { insight: PmoPiInsight }) {
  const t = useTranslations("pmoIntelligence");
  const evidence = insight.evidence;

  return (
    <dl className="mt-1.5 space-y-0.5 rounded border border-slate-200 bg-white/70 p-1.5 text-[10px] text-slate-700">
      <EvidenceRow label={t("evidenceFormulas")} value={evidence.formulas.join(" · ")} />
      <EvidenceRow label={t("evidenceProjections")} value={evidence.projections.join(", ")} />
      <EvidenceRow
        label={t("evidenceTechnicalEvents")}
        value={(evidence.technicalEventTypes ?? []).join(", ")}
        fallback={t("evidenceNotApplicable")}
      />
      <EvidenceRow
        label={t("evidenceCases")}
        value={String(evidence.affectedCaseCount ?? insight.affectedProjectCount)}
      />
      <EvidenceRow
        label={t("evidenceCutoff")}
        value={evidence.cutoffDate ?? ""}
        fallback={t("evidenceUnknown")}
      />
      <EvidenceRow
        label={t("evidenceTimestamps")}
        value={evidence.timestamps
          .map((stamp) => stamp.occurredAt ?? stamp.recordedAt ?? stamp.statusDate ?? "")
          .filter(Boolean)
          .join(", ")}
        fallback={t("evidenceUnknown")}
      />
      <EvidenceRow label={t("evidenceAssumptions")} value={evidence.assumptions.join(", ")} />
      <EvidenceRow label={t("evidenceLimitations")} value={evidence.limitations.join(", ")} />
      <EvidenceRow
        label={t("evidenceQuality")}
        value={`${Math.round(evidence.dataQualityScore * 100)}%`}
      />
      <EvidenceRow
        label={t("evidenceVersion")}
        value={`${insight.knowledgeVersion} · ${insight.ruleSnapshotVersion}`}
      />
    </dl>
  );
}

function EvidenceRow({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string;
  fallback?: string;
}) {
  if (!value && !fallback) return null;
  return (
    <div className="flex gap-1">
      <dt className="shrink-0 font-bold">{label}:</dt>
      <dd className="min-w-0 flex-1 break-words">{value || fallback}</dd>
    </div>
  );
}
