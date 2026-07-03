"use client";

// ============================================================================
// ProjectOps360° — Milestone Process Flow · Transition Detail Panel (Task 8)
// ============================================================================
// Detail sections for one selected transition: segments, metrics, findings,
// health, Isabella evidence-packet preview and evidence drill-down. Pure
// display of the engine view-model:
//   • metrics/durations come formatted from Task 4 output (never recalculated);
//   • health comes from Task 7 (never reclassified);
//   • findings come from Tasks 5/6 (never re-detected);
//   • bottlenecks are always CANDIDATES; "possible" stays possible;
//   • a fallback dependency cause is rendered as ambiguous, never as fact;
//   • predictions are visually distinct from facts;
//   • recommendations are action CATEGORIES only — no generated prose;
//   • allowed/disallowed Isabella claims stay inspectable (AI trust surface).
// ============================================================================

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  Bot,
  FileSearch,
  GitBranch,
  HeartPulse,
  Info,
  Layers,
  ListChecks,
  Repeat2,
  Timer,
} from "lucide-react";
import type {
  MilestoneFlowTransitionVM,
  MilestoneFlowEvidenceRefVM,
} from "@/lib/milestone-flow-ui/selectors";
import { healthBadgeClass, segmentBarClass, severityClass, confidenceClass } from "./style-maps";

export function TransitionDetailPanel({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");

  return (
    <div className="space-y-3" data-testid="mpf-detail-panel">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span>{tr.sourceMilestoneName ?? t("corridor.start")}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>{tr.targetMilestoneName}</span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3">
          <div>
            <dt className="inline">{t("corridor.started")}: </dt>
            <dd className="inline tabular-nums">{tr.startedAt?.slice(0, 10) ?? t("metrics.unknownValue")}</dd>
          </div>
          <div>
            <dt className="inline">{t("corridor.completed")}: </dt>
            <dd className="inline tabular-nums">{tr.completedAt?.slice(0, 10) ?? t("metrics.unknownValue")}</dd>
          </div>
          <div>
            <dt className="inline">{t("corridor.lastEvent")}: </dt>
            <dd className="inline tabular-nums">{tr.lastEventAt?.slice(0, 10) ?? t("metrics.unknownValue")}</dd>
          </div>
        </dl>
      </div>

      <HealthSection transition={tr} />
      <SegmentsSection transition={tr} />
      <MetricsSection transition={tr} />
      <FindingsSection transition={tr} />
      <IsabellaSection transition={tr} />
      <EvidenceSection transition={tr} />
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
  testId,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3" data-testid={testId}>
      <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function EvidenceRefLine({ refVM, showKind = false }: { refVM: MilestoneFlowEvidenceRefVM; showKind?: boolean }) {
  const t = useTranslations("milestoneFlow");
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
      {showKind && (
        <Chip className="border-border bg-muted/40 text-muted-foreground">{t(`evidence.kinds.${refVM.kind}`)}</Chip>
      )}
      <Chip className={confidenceClass(refVM.confidence)}>{t(`confidence.${refVM.confidence}`)}</Chip>
      {refVM.eventId && (
        <span>
          {t("evidence.event")}: <code className="rounded bg-muted px-1 py-px">{refVM.eventId}</code>
        </span>
      )}
      {refVM.metricRef && (
        <span>
          {t("evidence.metric")}: <code className="rounded bg-muted px-1 py-px">{refVM.metricRef}</code>
        </span>
      )}
      {refVM.note && <span className="italic">{refVM.note}</span>}
      {!refVM.eventId && !refVM.metricRef && !refVM.note && (
        <span className="italic">{t("evidence.unavailableDetail")}</span>
      )}
    </li>
  );
}

// ── Health (Task 7 — displayed, never reclassified) ───────────────────────────

function HealthSection({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  const h = tr.health;

  return (
    <SectionCard icon={HeartPulse} title={t("health.title")} testId="mpf-health">
      {!h ? (
        <p className="text-xs text-muted-foreground">{t("empty.noProjection.description")}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className={healthBadgeClass(h.status)}>{t(`health.statuses.${h.status}`)}</Chip>
            <Chip className={confidenceClass(h.confidence)}>
              {t("health.confidence")}: {t(`confidence.${h.confidence}`)}
            </Chip>
            <Chip className="border-border bg-muted/40 text-muted-foreground">
              {t("health.recommendedAction")}: {t(`health.actionCategories.${h.recommendedActionCategory}`)}
            </Chip>
          </div>
          {h.primaryReasonCode && (
            <p className="text-xs text-foreground">
              <span className="font-medium">{t("health.primaryReason")}:</span>{" "}
              {t(`health.reasonCodes.${h.primaryReasonCode}`)}
              {h.secondaryReasonCodes.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}· {t("health.otherReasons")}: {h.secondaryReasonCodes.map((c) => t(`health.reasonCodes.${c}`)).join(", ")}
                </span>
              )}
            </p>
          )}
          {h.uncertaintyNotes.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2" data-testid="mpf-health-uncertainty">
              <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Info className="h-3 w-3" aria-hidden />
                {t("health.uncertaintyTitle")}
              </p>
              <ul className="list-inside list-disc text-[11px] text-muted-foreground">
                {h.uncertaintyNotes.map((n) => (
                  <li key={n}>{t(`health.uncertaintyNotes.${n}`)}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t("health.evidenceCount", { count: h.evidenceCount })} · {t("health.warningCount", { count: h.warningCount })}
          </p>
          {h.reasons.length > 0 && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer select-none font-medium">{t("health.machineDetail")}</summary>
              <ul className="mt-1 space-y-0.5">
                {h.reasons.map((r, i) => (
                  <li key={`${r.code}-${i}`}>
                    <code className="rounded bg-muted px-1 py-px">{r.code}</code> {r.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Segments (Task 3 — engine types, engine durations) ────────────────────────

function SegmentsSection({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  return (
    <SectionCard icon={Layers} title={t("segmentsPanel.title")} testId="mpf-segments">
      {tr.segments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty.insufficientEvidence.description")}</p>
      ) : (
        <ul className="space-y-1.5">
          {tr.segments.map((s) => (
            <li key={s.segmentId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segmentBarClass(s.type)}`} aria-hidden />
              <span className="font-medium text-foreground">{t(`segmentsPanel.types.${s.type}`)}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.startedAt?.slice(0, 10) ?? "…"} → {s.endedAt?.slice(0, 10) ?? "…"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                <Timer className="mr-0.5 inline h-3 w-3" aria-hidden />
                {s.durationLabel ?? t("metrics.unknownValue")}
              </span>
              {s.isOpenEnded && (
                <Chip className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">{t("segmentsPanel.openEnded")}</Chip>
              )}
              <Chip className={confidenceClass(s.confidence)}>{t(`confidence.${s.confidence}`)}</Chip>
              <span className="text-[11px] text-muted-foreground">
                {t("segmentsPanel.evidenceCount", { count: s.evidenceCount })}
              </span>
              {s.hasWarnings && <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Metrics (Task 4 — displayed, never recalculated; nulls stay honest) ───────

function MetricsSection({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  const m = tr.metrics;
  return (
    <SectionCard icon={ListChecks} title={t("metrics.title")} testId="mpf-metrics">
      {!m ? (
        <p className="text-xs text-muted-foreground">{t("metrics.unavailable")}</p>
      ) : (
        <div className="space-y-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {[...m.durations, ...m.timeBuckets].map((metric) => (
              <div key={metric.key} className="flex items-baseline justify-between gap-2 border-b border-border/50 py-0.5">
                <dt className="text-muted-foreground">{t(`metrics.${metric.key}`)}</dt>
                <dd className="tabular-nums font-medium text-foreground" data-testid={`mpf-metric-${metric.key}`}>
                  {metric.label ?? t("metrics.unknownValue")}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-2 border-b border-border/50 py-0.5">
              <dt className="text-muted-foreground">{t("metrics.totalKnownSegmentTime")}</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {m.totalKnownSegmentTimeLabel ?? t("metrics.unknownValue")}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-b border-border/50 py-0.5">
              <dt className="text-muted-foreground">{t("metrics.flowEfficiency")}</dt>
              <dd className="tabular-nums font-medium text-foreground" data-testid="mpf-metric-flowEfficiency">
                {m.flowEfficiencyLabel ?? t("metrics.unknownValue")}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">
            {t("metrics.segmentCounts", {
              total: m.segmentCount,
              open: m.openSegmentCount,
              unknown: m.unknownSegmentCount,
            })}{" "}
            · {t("metrics.completeness")}: {t(`metrics.completenessValues.${m.completeness}`)} ·{" "}
            {t("health.confidence")}: {t(`confidence.${m.confidence}`)}
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ── Findings (Tasks 5/6 — displayed, never re-detected) ───────────────────────

function FindingsSection({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  const total =
    tr.delayFindings.length + tr.reworkFindings.length + tr.bottleneckFindings.length +
    tr.propagationsOut.length + tr.propagationsIn.length;

  return (
    <SectionCard icon={GitBranch} title={t("findingsPanel.title")} testId="mpf-findings">
      {total === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="mpf-no-findings">
          {t("empty.noFindings")}
        </p>
      ) : (
        <div className="space-y-3">
          {tr.delayFindings.length > 0 && (
            <div>
              <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("findingsPanel.delayTitle")}
              </h4>
              <ul className="space-y-1.5">
                {tr.delayFindings.map((f) => (
                  <li key={f.findingId} className="flex flex-wrap items-center gap-1.5 text-xs" data-testid={`mpf-finding-${f.findingId}`}>
                    <span className="font-medium text-foreground">{t(`findingsPanel.types.${f.findingType}`)}</span>
                    <Chip className={severityClass(f.severity)}>{t(`findingsPanel.severities.${f.severity}`)}</Chip>
                    <Chip className="border-border bg-muted/40 text-muted-foreground">{t(`findingsPanel.statuses.${f.status}`)}</Chip>
                    <Chip className={confidenceClass(f.confidence)}>{t(`confidence.${f.confidence}`)}</Chip>
                    <span className="tabular-nums text-muted-foreground">{f.durationLabel ?? t("metrics.unknownValue")}</span>
                    <span className="text-[11px] text-muted-foreground">{t("segmentsPanel.evidenceCount", { count: f.evidenceCount })}</span>
                    {f.warningCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tr.reworkFindings.length > 0 && (
            <div>
              <h4 className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Repeat2 className="h-3 w-3" aria-hidden />
                {t("findingsPanel.types.rework")}
              </h4>
              <ul className="space-y-1.5">
                {tr.reworkFindings.map((f) => (
                  <li key={f.findingId} className="flex flex-wrap items-center gap-1.5 text-xs" data-testid={`mpf-finding-${f.findingId}`}>
                    <span className="font-medium text-foreground">{t(`findingsPanel.reworkTypes.${f.reworkType}`)}</span>
                    <Chip className={severityClass(f.severity)}>{t(`findingsPanel.severities.${f.severity}`)}</Chip>
                    <Chip className="border-border bg-muted/40 text-muted-foreground">{t(`findingsPanel.statuses.${f.status}`)}</Chip>
                    <Chip className={confidenceClass(f.confidence)}>{t(`confidence.${f.confidence}`)}</Chip>
                    <span className="tabular-nums text-muted-foreground">{f.durationLabel ?? t("metrics.unknownValue")}</span>
                    <span className="text-[11px] text-muted-foreground">{t("segmentsPanel.evidenceCount", { count: f.evidenceCount })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tr.bottleneckFindings.length > 0 && (
            <div>
              <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("findingsPanel.bottleneckTitle")}
              </h4>
              <ul className="space-y-1.5">
                {tr.bottleneckFindings.map((f) => (
                  <li key={f.findingId} className="space-y-1 text-xs" data-testid={`mpf-bottleneck-${f.findingId}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Bottlenecks are ALWAYS candidates — never confirmed constraints. */}
                      <Chip className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        {t("findingsPanel.candidate")}
                      </Chip>
                      <span className="font-medium text-foreground">{t(`findingsPanel.bottleneckTypes.${f.bottleneckType}`)}</span>
                      {f.isPossible && (
                        <Chip className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {t("findingsPanel.possible")}
                        </Chip>
                      )}
                      {f.isStructuralCandidate && (
                        <Chip className="border-border bg-muted/40 text-muted-foreground">{t("findingsPanel.structuralCandidate")}</Chip>
                      )}
                      <Chip className={severityClass(f.severity)}>{t(`findingsPanel.severities.${f.severity}`)}</Chip>
                      <Chip className={confidenceClass(f.confidence)}>{t(`confidence.${f.confidence}`)}</Chip>
                      <span className="tabular-nums text-muted-foreground">{f.durationLabel ?? t("metrics.unknownValue")}</span>
                      <span className="tabular-nums text-muted-foreground">{t("findingsPanel.occurrences", { count: f.occurrenceCount })}</span>
                    </div>
                    {f.isAmbiguousDependencyFallback && (
                      <p className="inline-flex items-start gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400" data-testid="mpf-ambiguous-dependency">
                        <Info className="mt-px h-3 w-3 shrink-0" aria-hidden />
                        {t("findingsPanel.ambiguousDependency")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(tr.propagationsOut.length > 0 || tr.propagationsIn.length > 0) && (
            <div>
              <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("findingsPanel.propagationTitle")}
              </h4>
              <ul className="space-y-1.5">
                {[
                  ...tr.propagationsOut.map((f) => ({ f, dir: "origin" as const })),
                  ...tr.propagationsIn.map((f) => ({ f, dir: "affected" as const })),
                ].map(({ f, dir }) => (
                  <li key={`${f.findingId}-${dir}`} className="flex flex-wrap items-center gap-1.5 text-xs" data-testid={`mpf-propagation-${f.findingId}`}>
                    <span className="font-medium text-foreground">{t(`findingsPanel.propagationTypes.${f.propagationType}`)}</span>
                    {f.isPossible && (
                      <Chip className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {t("findingsPanel.possible")}
                      </Chip>
                    )}
                    <Chip className="border-border bg-muted/40 text-muted-foreground">
                      {dir === "origin" ? t("findingsPanel.origin") : t("findingsPanel.affected")}
                    </Chip>
                    <Chip className={severityClass(f.severity)}>{t(`findingsPanel.severities.${f.severity}`)}</Chip>
                    <Chip className={confidenceClass(f.confidence)}>{t(`confidence.${f.confidence}`)}</Chip>
                    {f.delayImpactLabel && (
                      <span className="tabular-nums text-muted-foreground">
                        {t("findingsPanel.delayImpact")}: {f.delayImpactLabel}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Isabella evidence packet preview (structured — never prose, never LLM) ────

function IsabellaSection({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  const p = tr.isabella;

  return (
    <SectionCard icon={Bot} title={t("isabella.title")} testId="mpf-isabella">
      {!p ? (
        <p className="text-xs text-muted-foreground">{t("empty.noPacket")}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{t("isabella.subtitle")}</p>

          <PacketList title={t("isabella.fact")} refs={p.facts} testId="mpf-isabella-facts" toneClass="border-emerald-500/30" />
          <PacketList title={t("isabella.inference")} refs={p.inferences} testId="mpf-isabella-inferences" toneClass="border-sky-500/30" />
          {/* Predictions: separate section + explicit badge — never mixed with facts. */}
          {p.predictions.length > 0 && (
            <div className="rounded-md border border-dashed border-violet-500/40 bg-violet-500/5 p-2" data-testid="mpf-isabella-predictions">
              <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                {t("isabella.prediction")}
                <Chip className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  {t("isabella.predictionBadge")}
                </Chip>
              </p>
              <ul className="space-y-0.5">
                {p.predictions.map((r, i) => <EvidenceRefLine key={i} refVM={r} />)}
              </ul>
            </div>
          )}
          {/* Recommendations: category only — the UI never generates advice prose. */}
          <div className="text-xs" data-testid="mpf-isabella-recommendation">
            <span className="font-medium text-foreground">{t("isabella.recommendation")}: </span>
            <Chip className="border-border bg-muted/40 text-muted-foreground">
              {t(`health.actionCategories.${p.recommendedActionCategory}`)}
            </Chip>
            <span className="ml-1 text-[11px] text-muted-foreground">{t("isabella.actionCategoryOnly")}</span>
          </div>
          <PacketList title={t("isabella.uncertainty")} refs={p.uncertainties} testId="mpf-isabella-uncertainties" toneClass="border-amber-500/30" />

          <details className="rounded-md border border-border bg-muted/20 p-2 text-[11px]" data-testid="mpf-isabella-claims">
            <summary className="cursor-pointer select-none font-medium text-foreground">
              {t("isabella.claimsTitle")}
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  {t("isabella.allowedClaims")}
                </p>
                {p.allowedClaims.length === 0 ? (
                  <p className="text-muted-foreground">{t("isabella.noClaims")}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {p.allowedClaims.map((c) => (
                      <li key={c}><code className="rounded bg-muted px-1 py-px">{c}</code></li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                  <Ban className="h-3 w-3" aria-hidden />
                  {t("isabella.disallowedClaims")}
                </p>
                {p.disallowedClaims.length === 0 ? (
                  <p className="text-muted-foreground">{t("isabella.noClaims")}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {p.disallowedClaims.map((c) => (
                      <li key={c}><code className="rounded bg-muted px-1 py-px">{c}</code></li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-muted-foreground">{t("isabella.whyDisallowed")}</p>
              </div>
            </div>
          </details>
        </div>
      )}
    </SectionCard>
  );
}

function PacketList({
  title,
  refs,
  testId,
  toneClass,
}: {
  title: string;
  refs: MilestoneFlowEvidenceRefVM[];
  testId: string;
  toneClass: string;
}) {
  const t = useTranslations("milestoneFlow");
  return (
    <div className={`rounded-md border ${toneClass} bg-background/40 p-2`} data-testid={testId}>
      <p className="mb-1 text-[11px] font-semibold text-foreground">{title}</p>
      {refs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t("isabella.emptySection")}</p>
      ) : (
        <ul className="space-y-0.5">
          {refs.map((r, i) => <EvidenceRefLine key={i} refVM={r} />)}
        </ul>
      )}
    </div>
  );
}

// ── Evidence drill-down ───────────────────────────────────────────────────────

function EvidenceSection({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  return (
    <SectionCard icon={FileSearch} title={t("evidence.title")} testId="mpf-evidence">
      {tr.evidence.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("evidence.empty")}</p>
      ) : (
        <details>
          <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
            {t("evidence.showRefs", { count: tr.evidence.length })}
          </summary>
          <ul className="mt-2 space-y-1">
            {tr.evidence.map((r, i) => (
              <EvidenceRefLine key={i} refVM={r} showKind />
            ))}
          </ul>
          <p className="mt-2 text-[11px] italic text-muted-foreground">{t("evidence.unavailableDetail")}</p>
        </details>
      )}
    </SectionCard>
  );
}
