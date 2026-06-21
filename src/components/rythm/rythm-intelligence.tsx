"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Scale,
  ListChecks,
  AlertTriangle,
  Ban,
  Link2,
  Flag,
  Handshake,
  HelpCircle,
  Loader2,
  RefreshCw,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateMeetingIntelligenceAction,
  promoteActionItemToTaskAction,
  promoteDecisionAction,
  promoteRiskAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/intelligence-actions";
import type {
  RythmIntelligence,
  RythmTranscript,
  IntelItem,
} from "@/lib/rythm/types";

interface Props {
  projectId: string;
  meetingId: string;
  locale: string;
  transcript: RythmTranscript | null;
  intelligence: RythmIntelligence | null;
  onChanged: () => void;
}

// ── Confidence indicator ───────────────────────────────────────────────────────

function Confidence({ value }: { value: number | undefined | null }) {
  const t = useTranslations("rythm.intelligence");
  const v = typeof value === "number" ? value : 0.5;
  const pct = Math.round(v * 100);
  const color = v >= 0.75 ? "bg-brand-500" : v >= 0.5 ? "bg-amber-400" : "bg-red-400";
  const textColor = v >= 0.75 ? "text-brand-700" : v >= 0.5 ? "text-amber-700" : "text-red-600";
  return (
    <span className="inline-flex items-center gap-1.5" title={`${t("confidence")}: ${pct}%`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("text-[10px] font-medium tabular-nums", textColor)}>{pct}%</span>
    </span>
  );
}

// ── Promote button ─────────────────────────────────────────────────────────────

function PromoteButton({
  label,
  promotedLabel,
  promoted,
  onClick,
}: {
  label: string;
  promotedLabel: string;
  promoted: boolean;
  onClick: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (promoted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
        <Check className="h-3 w-3" />
        {promotedLabel}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onClick();
        setBusy(false);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-brand-500/50 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 dark:hover:bg-brand-900/20"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
      {label}
    </button>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────

function Card({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-brand-600" />
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
        {typeof count === "number" && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function GenericList({ items, empty }: { items: IntelItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-foreground">{it.title || it.description}</p>
            {it.owner && <p className="text-[11px] text-muted-foreground">{it.owner}</p>}
          </div>
          {typeof it.confidence === "number" && <Confidence value={it.confidence} />}
        </li>
      ))}
    </ul>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function RythmIntelligencePanel({
  projectId,
  meetingId,
  locale,
  transcript,
  intelligence,
  onChanged,
}: Props) {
  const t = useTranslations("rythm.intelligence");
  const tErr = useTranslations("rythm.errors");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  const transcriptReady = transcript?.status === "completed";

  function markPromoted(key: string) {
    setPromoted((prev) => new Set(prev).add(key));
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    const r = await generateMeetingIntelligenceAction({ projectId, meetingId, locale });
    setGenerating(false);
    if (r.error) {
      setError(tErr.has(r.error) ? tErr(r.error) : tErr("ai_failed"));
      return;
    }
    setPromoted(new Set());
    onChanged();
  }

  // ── Empty state (no intelligence yet) ──
  if (!intelligence) {
    return (
      <div className="rounded-xl border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h4>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            {transcriptReady ? t("generateHint") : t("needTranscript")}
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={!transcriptReady || generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("generate")}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Populated ──
  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-brand-600" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h4>
        <span className="ml-1 inline-flex items-center gap-1">
          <Confidence value={intelligence.confidenceScore} />
        </span>
        <span className="text-[10px] text-muted-foreground">
          {t("generatedAt")} {new Date(intelligence.generatedAt).toLocaleString(locale)}
        </span>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t("regenerate")}
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-red-600">{error}</p>}

      <div className="space-y-3 p-4">
        {/* Executive Summary */}
        {intelligence.executiveSummary && (
          <Card icon={Sparkles} title={t("executiveSummary")}>
            <p className="text-sm leading-relaxed text-foreground">{intelligence.executiveSummary}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Decisions */}
          <Card icon={Scale} title={t("decisions")} count={intelligence.decisions.length}>
            {intelligence.decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="space-y-3">
                {intelligence.decisions.map((d, i) => (
                  <li key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{d.title}</p>
                      <Confidence value={d.confidence} />
                    </div>
                    {d.description && <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{d.owner || "—"}</span>
                      <PromoteButton
                        label={t("promoteDecision")}
                        promotedLabel={t("promoted")}
                        promoted={promoted.has(`decision-${i}`)}
                        onClick={async () => {
                          const r = await promoteDecisionAction({
                            projectId,
                            meetingId,
                            locale,
                            title: d.title,
                            description: d.description,
                            owner: d.owner,
                          });
                          if (!r.error) markPromoted(`decision-${i}`);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Action Items */}
          <Card icon={ListChecks} title={t("actionItems")} count={intelligence.actionItems.length}>
            {intelligence.actionItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="space-y-3">
                {intelligence.actionItems.map((a, i) => (
                  <li key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{a.task}</p>
                      <Confidence value={a.confidence} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{a.owner || "—"}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-medium",
                          a.priority === "high"
                            ? "bg-red-100 text-red-700"
                            : a.priority === "low"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {t(`priority_${a.priority}`)}
                      </span>
                      {a.due_date && <span>{a.due_date}</span>}
                    </div>
                    <div className="mt-1.5 flex justify-end">
                      <PromoteButton
                        label={t("convertToTask")}
                        promotedLabel={t("promoted")}
                        promoted={promoted.has(`action-${i}`)}
                        onClick={async () => {
                          const r = await promoteActionItemToTaskAction({
                            projectId,
                            meetingId,
                            task: a.task,
                            owner: a.owner,
                            priority: a.priority,
                            dueDate: a.due_date,
                          });
                          if (!r.error) markPromoted(`action-${i}`);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Risks */}
          <Card icon={AlertTriangle} title={t("risks")} count={intelligence.risks.length}>
            {intelligence.risks.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="space-y-3">
                {intelligence.risks.map((r, i) => (
                  <li key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{r.description}</p>
                      <Confidence value={r.confidence} />
                    </div>
                    {r.impact && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("impact")}: {r.impact}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{r.owner || "—"}</span>
                      <PromoteButton
                        label={t("promoteRisk")}
                        promotedLabel={t("promoted")}
                        promoted={promoted.has(`risk-${i}`)}
                        onClick={async () => {
                          const res = await promoteRiskAction({
                            projectId,
                            meetingId,
                            description: r.description,
                            impact: r.impact,
                            owner: r.owner,
                            confidence: r.confidence,
                          });
                          if (!res.error) markPromoted(`risk-${i}`);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Commitments */}
          <Card icon={Handshake} title={t("commitments")} count={intelligence.commitments.length}>
            <GenericList items={intelligence.commitments} empty={t("none")} />
          </Card>

          {/* Blockers */}
          <Card icon={Ban} title={t("blockers")} count={intelligence.blockers.length}>
            <GenericList items={intelligence.blockers} empty={t("none")} />
          </Card>

          {/* Dependencies */}
          <Card icon={Link2} title={t("dependencies")} count={intelligence.dependencies.length}>
            <GenericList items={intelligence.dependencies} empty={t("none")} />
          </Card>

          {/* Milestones */}
          <Card icon={Flag} title={t("milestones")} count={intelligence.milestones.length}>
            <GenericList items={intelligence.milestones} empty={t("none")} />
          </Card>

          {/* Assumptions */}
          <Card icon={HelpCircle} title={t("assumptions")} count={intelligence.assumptions.length}>
            <GenericList items={intelligence.assumptions} empty={t("none")} />
          </Card>
        </div>
      </div>
    </div>
  );
}
