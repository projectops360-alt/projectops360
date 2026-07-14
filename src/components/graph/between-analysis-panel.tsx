"use client";

// ============================================================================
// ProjectOps360° — Living Graph "What happened between?" analysis panel
// ============================================================================
// Read-only side panel that renders a `BetweenAnalysisResult` (CAP-045 §C.2).
// PURE presentation: it derives NOTHING from the data — every fact is read
// straight from the result the pure motor produced (no LLM, no Isabella, no
// invented causality). Temporal order is labelled "temporal order — not
// causal"; explicit causal links are labelled "explicit".
// ============================================================================

import { memo } from "react";
import { useTranslations } from "next-intl";
import { X, ArrowLeftRight, Clock, AlertTriangle, GitBranch } from "lucide-react";
import type { BetweenAnalysisResult, BetweenChronologyEntry } from "@/lib/graph/between-analysis";

interface BetweenAnalysisPanelProps {
  result: BetweenAnalysisResult;
  onClose: () => void;
  onSwap?: () => void;
  onClear?: () => void;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms === 0) return "0 ms";
  const sec = ms / 1000;
  if (Math.abs(sec) < 60) return `${sec.toFixed(1)} s`;
  const min = sec / 60;
  if (Math.abs(min) < 60) return `${min.toFixed(1)} min`;
  const hr = min / 60;
  if (Math.abs(hr) < 24) return `${hr.toFixed(1)} h`;
  const day = hr / 24;
  return `${day.toFixed(1)} d`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ChronologyRow({ entry }: { entry: BetweenChronologyEntry }) {
  return (
    <li className="rounded-md border border-border bg-card/60 px-2 py-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">#{entry.sequenceNumber} · {entry.eventType}</span>
        {entry.importance ? <Chip>{entry.importance}</Chip> : null}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        <Clock className="mr-1 inline h-3 w-3 align-text-bottom" aria-hidden />
        {entry.occurredAt ? new Date(entry.occurredAt).toISOString() : "—"}
        {entry.lateRecorded ? <span className="ml-1 text-amber-500">· late record</span> : null}
      </div>
      {(entry.fromState || entry.toState) && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          <span>{entry.fromState ?? "∅"}</span>
          <ArrowLeftRight className="mx-1 inline h-3 w-3 align-text-bottom" aria-hidden />
          <span>{entry.toState ?? "∅"}</span>
        </div>
      )}
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {entry.actorId ? `actor: ${entry.actorId}` : "actor: —"}
        {entry.sourceModule ? ` · src: ${entry.sourceModule}` : ""}
      </div>
      {entry.objectRefs.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {entry.objectRefs.map((r, i) => (
            <Chip key={`${r.object_type}-${r.object_id}-${i}`}>{r.object_type}:{r.object_id}</Chip>
          ))}
        </div>
      )}
    </li>
  );
}

export const BetweenAnalysisPanel = memo(function BetweenAnalysisPanel({
  result,
  onClose,
  onSwap,
  onClear,
}: BetweenAnalysisPanelProps) {
  const t = useTranslations("livingGraph.between");

  return (
    <aside
      role="complementary"
      aria-label={t("panelTitle")}
      className="flex h-full w-full flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3 text-foreground shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <GitBranch className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
            {t("panelTitle")}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={`${result.startEndpoint.label} → ${result.endEndpoint.label}`}>
            <span className="text-foreground">{result.startEndpoint.label}</span>
            <ArrowLeftRight className="mx-1 inline h-3 w-3 align-text-bottom" aria-hidden />
            <span className="text-foreground">{result.endEndpoint.label}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSwap && (
            <button
              type="button"
              onClick={onSwap}
              aria-label={t("swap")}
              title={t("swap")}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label={t("clear")}
              title={t("clear")}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("clear")}
            title={t("clear")}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">{t("elapsedBusiness")}</p>
          <p className="font-semibold">{formatMs(result.elapsedBusinessMs)}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">{t("recordedElapsed")}</p>
          <p className="font-semibold">{formatMs(result.recordedElapsedMs)}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">{t("eventCount")}</p>
          <p className="font-semibold">{result.eventCount}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">{t("transitionCount")}</p>
          <p className="font-semibold">{result.transitionCount}</p>
        </div>
        <div className="col-span-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">{t("largestWaitingGap")}</p>
          <p className="font-semibold">{formatMs(result.largestWaitingGap)}</p>
        </div>
      </div>

      {/* Operational path */}
      <Section title={t("operationalPath")}>
        {result.operationalPath.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("noPath")}</p>
        ) : (
          <p className="truncate text-[11px] text-foreground" title={result.operationalPath.map((p) => p.label).join(" → ")}>
            {result.operationalPath.map((p) => p.label).join(" → ")}
          </p>
        )}
      </Section>

      {/* Deterministic buckets */}
      <Section title={t("statusChanges")}>
        {result.statusChanges.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-0.5 text-[11px]">
            {result.statusChanges.map((s) => (
              <li key={s.eventId} className="text-muted-foreground">
                <span className="text-foreground">{s.fromState ?? "∅"}</span>
                <ArrowLeftRight className="mx-1 inline h-3 w-3 align-text-bottom" aria-hidden />
                <span className="text-foreground">{s.toState ?? "∅"}</span>
                <span className="ml-1 text-[10px]">(#{s.sequenceNumber})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">{t("blockers")}</p>
          <p className="font-semibold">{result.blockers.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">{t("risks")}</p>
          <p className="font-semibold">{result.risks.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">{t("decisions")}</p>
          <p className="font-semibold">{result.decisions.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">{t("approvals")}</p>
          <p className="font-semibold">{result.approvals.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">{t("reworkSignals")}</p>
          <p className="font-semibold">{result.reworkSignals.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">{t("eventCount")}</p>
          <p className="font-semibold">{result.eventCount}</p>
        </div>
      </div>

      <Section title={t("actors")}>
        {result.actors.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-1">{result.actors.map((a) => <Chip key={a}>{a}</Chip>)}</div>
        )}
      </Section>

      <Section title={t("sourceModules")}>
        {result.sourceModules.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-1">{result.sourceModules.map((m) => <Chip key={m}>{m}</Chip>)}</div>
        )}
      </Section>

      <Section title={t("evidenceRefs")}>
        {result.evidenceRefs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {result.evidenceRefs.map((r, i) => <Chip key={`${r.objectType}-${r.objectId}-${i}`}>{r.objectType}:{r.objectId}</Chip>)}
          </div>
        )}
      </Section>

      <Section title={t("dataQualityFlags")}>
        {result.dataQualityFlags.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-1">{result.dataQualityFlags.map((f) => <Chip key={f}>{f}</Chip>)}</div>
        )}
      </Section>

      <Section title={t("explicitCausal")}>
        {result.explicitCausalRelationships.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">0 — {t("temporalRelationships")} ≠ {t("explicitCausal")}</p>
        ) : (
          <ul className="space-y-0.5 text-[11px]">
            {result.explicitCausalRelationships.map((r) => (
              <li key={r.relationshipId} className="text-foreground">
                <Chip>explicit</Chip> <span className="ml-1">{r.sourceEventId.slice(0, 8)} → {r.targetEventId.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("temporalRelationships")}>
        {result.temporalRelationships.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {result.temporalRelationships.length} (temporal order — not causal)
          </p>
        )}
      </Section>

      {/* Limitations (honesty) */}
      {result.limitations.length > 0 && (
        <Section title={t("limitations")}>
          <ul className="space-y-0.5 text-[11px] text-amber-600 dark:text-amber-400">
            {result.limitations.map((l) => (
              <li key={l} className="flex items-start gap-1">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Summary facts (deterministic) */}
      <Section title={t("summaryFacts")}>
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {result.summaryFacts.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </Section>

      {/* Ordered chronology */}
      <Section title={t("canonicalEvents")}>
        {result.chronology.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("noEvents")}</p>
        ) : (
          <ol className="space-y-1">
            {result.chronology.map((e) => <ChronologyRow key={e.eventId} entry={e} />)}
          </ol>
        )}
      </Section>
    </aside>
  );
});