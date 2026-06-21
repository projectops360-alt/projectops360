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
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Pencil,
  X,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateMeetingIntelligenceAction,
  applyIntelligenceToProjectAction,
  updateItemOwnerAction,
  deleteIntelligenceItemAction,
  deleteMeetingIntelligenceAction,
  promoteActionItemToTaskAction,
  promoteDecisionAction,
  promoteRiskAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/intelligence-actions";
import type {
  RythmIntelligence,
  RythmTranscript,
  RythmSpeakerOption,
  IntelItem,
  IntelEvidence,
  OwnerAttribution,
} from "@/lib/rythm/types";

interface Props {
  projectId: string;
  meetingId: string;
  locale: string;
  transcript: RythmTranscript | null;
  intelligence: RythmIntelligence | null;
  ownerOptions: RythmSpeakerOption[];
  onChanged: () => void;
}

const LOW_CONFIDENCE = 0.8;

function mmss(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Confidence ─────────────────────────────────────────────────────────────────

function Confidence({ value }: { value: number | undefined | null }) {
  const t = useTranslations("rythm.intelligence");
  const v = typeof value === "number" ? value : 0.5;
  const pct = Math.round(v * 100);
  const color = v >= 0.9 ? "bg-brand-500" : v >= LOW_CONFIDENCE ? "bg-amber-400" : "bg-red-400";
  const textColor = v >= 0.9 ? "text-brand-700" : v >= LOW_CONFIDENCE ? "text-amber-700" : "text-red-600";
  return (
    <span className="inline-flex items-center gap-1.5" title={`${t("confidence")}: ${pct}%`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("text-[10px] font-medium tabular-nums", textColor)}>{pct}%</span>
    </span>
  );
}

function Impact({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="rounded-full bg-brand-600/10 px-1.5 py-0.5 font-semibold tabular-nums text-brand-700 dark:text-brand-300">
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// ── Owner attribution badge ────────────────────────────────────────────────────

const ATTR_CLASS: Record<OwnerAttribution, string> = {
  speaker: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  explicit: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  project_member: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  attendee: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  unknown: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  manual: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function AttributionBadge({ attribution }: { attribution: OwnerAttribution | undefined }) {
  const t = useTranslations("rythm.intelligence");
  if (!attribution) return null;
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide", ATTR_CLASS[attribution])}>
      {t(`attr_${attribution}`)}
    </span>
  );
}

// ── Owner cell with inline review ──────────────────────────────────────────────

function OwnerCell({
  projectId,
  meetingId,
  category,
  index,
  owner,
  attribution,
  confidence,
  listId,
  onChanged,
}: {
  projectId: string;
  meetingId: string;
  category: string;
  index: number;
  owner: string | undefined;
  attribution: OwnerAttribution | undefined;
  confidence: number | undefined;
  listId: string;
  onChanged: () => void;
}) {
  const t = useTranslations("rythm.intelligence");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(owner ?? "");
  const [saving, setSaving] = useState(false);
  const needsReview = (confidence ?? 0) < LOW_CONFIDENCE;

  async function save() {
    setSaving(true);
    const r = await updateItemOwnerAction({ projectId, meetingId, category, index, owner: value.trim() });
    setSaving(false);
    if (!r.error) {
      setEditing(false);
      onChanged();
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          list={listId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("ownerPlaceholder")}
          className="w-36 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] focus:border-brand-500 focus:outline-none"
          autoFocus
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "…" : t("saveOwner")}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{owner || t("unassigned")}</span>
      <AttributionBadge attribution={attribution} />
      {needsReview && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-0.5 rounded border border-amber-300 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        >
          <Pencil className="h-2.5 w-2.5" />
          {t("reviewOwner")}
        </button>
      )}
    </span>
  );
}

// ── Evidence (expandable) ──────────────────────────────────────────────────────

function Evidence({ item }: { item: IntelEvidence & { confidence?: number } }) {
  const t = useTranslations("rythm.intelligence");
  const [open, setOpen] = useState(false);
  const hasEvidence = item.source_speaker || item.source_excerpt || typeof item.source_timestamp === "number";
  if (!hasEvidence) return null;
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t("evidence")}
      </button>
      {open && (
        <div className="mt-1 space-y-1 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
          <p>
            <span className="font-medium text-muted-foreground">{t("ev_speaker")}: </span>
            {item.source_speaker || "—"}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">{t("ev_timestamp")}: </span>
            {mmss(item.source_timestamp)}
          </p>
          <p className="italic text-foreground">
            <span className="font-medium not-italic text-muted-foreground">{t("ev_transcript")}: </span>
            {item.source_excerpt ? `“${item.source_excerpt}”` : "—"}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">{t("confidence")}: </span>
            {Math.round((item.confidence ?? 0) * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}

// ── Remove a single extracted item ──────────────────────────────────────────────

function DeleteX({
  projectId,
  meetingId,
  category,
  index,
  onChanged,
}: {
  projectId: string;
  meetingId: string;
  category: string;
  index: number;
  onChanged: () => void;
}) {
  const t = useTranslations("rythm.intelligence");
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      title={t("removeItem")}
      aria-label={t("removeItem")}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await deleteIntelligenceItemAction({ projectId, meetingId, category, index });
        setBusy(false);
        if (!r.error) onChanged();
      }}
      className="shrink-0 text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
    </button>
  );
}

// ── Promote button ─────────────────────────────────────────────────────────────

function PromoteButton({ label, promotedLabel, promoted, onClick }: { label: string; promotedLabel: string; promoted: boolean; onClick: () => Promise<void> }) {
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

// ── Card ───────────────────────────────────────────────────────────────────────

function Card({ icon: Icon, title, count, children }: { icon: React.ComponentType<{ className?: string }>; title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-brand-600" />
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
        {typeof count === "number" && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function GenericCard({
  icon,
  title,
  items,
  category,
  empty,
  ownerCtx,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: IntelItem[];
  category: string;
  empty: string;
  ownerCtx: { projectId: string; meetingId: string; listId: string; onChanged: () => void };
}) {
  return (
    <Card icon={icon} title={title} count={items.length}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground">{it.title || it.description}</p>
                <span className="flex shrink-0 items-center gap-1.5">
                  {typeof it.confidence === "number" && <Confidence value={it.confidence} />}
                  <DeleteX projectId={ownerCtx.projectId} meetingId={ownerCtx.meetingId} category={category} index={i} onChanged={ownerCtx.onChanged} />
                </span>
              </div>
              <div className="mt-1">
                <OwnerCell
                  projectId={ownerCtx.projectId}
                  meetingId={ownerCtx.meetingId}
                  category={category}
                  index={i}
                  owner={it.owner}
                  attribution={it.owner_attribution}
                  confidence={it.confidence}
                  listId={ownerCtx.listId}
                  onChanged={ownerCtx.onChanged}
                />
              </div>
              <Evidence item={it} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function RythmIntelligencePanel({ projectId, meetingId, locale, transcript, intelligence, ownerOptions, onChanged }: Props) {
  const t = useTranslations("rythm.intelligence");
  const tErr = useTranslations("rythm.errors");
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  async function clearAll() {
    if (!window.confirm(t("clearConfirm"))) return;
    setClearing(true);
    await deleteMeetingIntelligenceAction({ projectId, meetingId });
    setClearing(false);
    onChanged();
  }

  const transcriptReady = transcript?.status === "completed";
  const listId = `owner-opts-${meetingId}`;
  const ownerCtx = { projectId, meetingId, listId, onChanged };

  function markPromoted(key: string) {
    setPromoted((prev) => new Set(prev).add(key));
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    const r = await generateMeetingIntelligenceAction({ projectId, meetingId, locale });
    setGenerating(false);
    if (r.error) return setError(tErr.has(r.error) ? tErr(r.error) : tErr("ai_failed"));
    setPromoted(new Set());
    onChanged();
  }

  async function applyToProject() {
    setApplying(true);
    setError(null);
    const r = await applyIntelligenceToProjectAction({ projectId, meetingId, locale });
    setApplying(false);
    if (r.error) return setError(tErr.has(r.error) ? tErr(r.error) : tErr("apply_failed"));
    onChanged();
  }

  if (!intelligence) {
    return (
      <div className="rounded-xl border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h4>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{transcriptReady ? t("generateHint") : t("needTranscript")}</p>
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

  // Extraction quality (over owner-bearing categories).
  const flat: Array<{ owner?: string; confidence?: number; owner_attribution?: OwnerAttribution }> = [
    ...intelligence.decisions,
    ...intelligence.commitments,
    ...intelligence.actionItems,
    ...intelligence.risks,
    ...intelligence.dependencies,
    ...intelligence.milestones,
  ];
  const detected = flat.length;
  const lowConf = flat.filter((x) => (x.confidence ?? 0) < LOW_CONFIDENCE).length;
  const unknownOwners = flat.filter((x) => !x.owner || x.owner_attribution === "unknown").length;
  const attributed = flat.filter((x) => !!x.owner && (x.confidence ?? 0) >= LOW_CONFIDENCE).length;
  const needsReview = flat.filter((x) => (x.confidence ?? 0) < LOW_CONFIDENCE || !x.owner || x.owner_attribution === "unknown").length;

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-brand-600" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h4>
        <Confidence value={intelligence.confidenceScore} />
        <span className="text-[10px] text-muted-foreground">
          {t("generatedAt")} {new Date(intelligence.generatedAt).toLocaleString(locale)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating || clearing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("regenerate")}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={clearing || generating}
            title={t("clearAll")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-900/20"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("clearAll")}
          </button>
        </div>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-red-600">{error}</p>}

      <datalist id={listId}>
        {ownerOptions.map((o) => (
          <option key={`${o.source}-${o.name}`} value={o.name} />
        ))}
      </datalist>

      <div className="space-y-3 p-4">
        {/* Meeting Impact + Estimated Project Impact */}
        <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900 dark:bg-brand-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">{t("impactTitle")}</h5>
              <Impact label={t("decisions")} value={intelligence.decisions.length} />
              <Impact label={t("commitments")} value={intelligence.commitments.length} />
              <Impact label={t("actionItems")} value={intelligence.actionItems.length} />
              <Impact label={t("risks")} value={intelligence.risks.length} />
              <Impact label={t("dependencies")} value={intelligence.dependencies.length} />
              <Impact label={t("milestones")} value={intelligence.milestones.length} />
            </div>
            {intelligence.appliedAt ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                <Check className="h-3.5 w-3.5" />
                {t("applied")}
              </span>
            ) : (
              <button
                type="button"
                onClick={applyToProject}
                disabled={applying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                {t("applyToProject")}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-brand-200/60 pt-2 dark:border-brand-900/60">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("estimatedImpact")}</span>
            <Impact label={t("tasksCreated")} value={intelligence.actionItems.length} />
            <Impact label={t("risksCreated")} value={intelligence.risks.length} />
            <Impact label={t("decisionsCreated")} value={intelligence.decisions.length} />
            <Impact label={t("dependenciesCreated")} value={intelligence.dependencies.length} />
          </div>
        </div>

        {/* Extraction Quality */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <h5 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
              {t("qualityTitle")}
            </h5>
            <Impact label={t("detectedItems")} value={detected} />
            <Impact label={t("correctlyAttributed")} value={attributed} />
            <Impact label={t("needsReview")} value={needsReview} />
            <Impact label={t("unknownOwners")} value={unknownOwners} />
            <Impact label={t("lowConfidence")} value={lowConf} />
          </div>
        </div>

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
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Confidence value={d.confidence} />
                        <DeleteX projectId={projectId} meetingId={meetingId} category="decisions" index={i} onChanged={onChanged} />
                      </span>
                    </div>
                    {d.description && <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <OwnerCell projectId={projectId} meetingId={meetingId} category="decisions" index={i} owner={d.owner} attribution={d.owner_attribution} confidence={d.confidence} listId={listId} onChanged={onChanged} />
                      <PromoteButton
                        label={t("promoteDecision")}
                        promotedLabel={t("promoted")}
                        promoted={promoted.has(`decision-${i}`)}
                        onClick={async () => {
                          const r = await promoteDecisionAction({ projectId, meetingId, locale, title: d.title, description: d.description, owner: d.owner });
                          if (!r.error) markPromoted(`decision-${i}`);
                        }}
                      />
                    </div>
                    <Evidence item={d} />
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
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Confidence value={a.confidence} />
                        <DeleteX projectId={projectId} meetingId={meetingId} category="actionItems" index={i} onChanged={onChanged} />
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <OwnerCell projectId={projectId} meetingId={meetingId} category="actionItems" index={i} owner={a.owner} attribution={a.owner_attribution} confidence={a.confidence} listId={listId} onChanged={onChanged} />
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                          a.priority === "high" ? "bg-red-100 text-red-700" : a.priority === "low" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {t(`priority_${a.priority}`)}
                      </span>
                      {a.due_date && <span className="text-[11px] text-muted-foreground">{a.due_date}</span>}
                    </div>
                    <div className="mt-1.5 flex justify-end">
                      <PromoteButton
                        label={t("convertToTask")}
                        promotedLabel={t("promoted")}
                        promoted={promoted.has(`action-${i}`)}
                        onClick={async () => {
                          const r = await promoteActionItemToTaskAction({ projectId, meetingId, task: a.task, owner: a.owner, priority: a.priority, dueDate: a.due_date });
                          if (!r.error) markPromoted(`action-${i}`);
                        }}
                      />
                    </div>
                    <Evidence item={a} />
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
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Confidence value={r.confidence} />
                        <DeleteX projectId={projectId} meetingId={meetingId} category="risks" index={i} onChanged={onChanged} />
                      </span>
                    </div>
                    {r.impact && <p className="mt-0.5 text-xs text-muted-foreground">{t("impact")}: {r.impact}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <OwnerCell projectId={projectId} meetingId={meetingId} category="risks" index={i} owner={r.owner} attribution={r.owner_attribution} confidence={r.confidence} listId={listId} onChanged={onChanged} />
                      <PromoteButton
                        label={t("promoteRisk")}
                        promotedLabel={t("promoted")}
                        promoted={promoted.has(`risk-${i}`)}
                        onClick={async () => {
                          const res = await promoteRiskAction({ projectId, meetingId, description: r.description, impact: r.impact, owner: r.owner, confidence: r.confidence });
                          if (!res.error) markPromoted(`risk-${i}`);
                        }}
                      />
                    </div>
                    <Evidence item={r} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Commitments */}
          <Card icon={Handshake} title={t("commitments")} count={intelligence.commitments.length}>
            {intelligence.commitments.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="space-y-3">
                {intelligence.commitments.map((c, i) => (
                  <li key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground">{c.commitment}</p>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Confidence value={c.confidence} />
                        <DeleteX projectId={projectId} meetingId={meetingId} category="commitments" index={i} onChanged={onChanged} />
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <OwnerCell projectId={projectId} meetingId={meetingId} category="commitments" index={i} owner={c.owner} attribution={c.owner_attribution} confidence={c.confidence} listId={listId} onChanged={onChanged} />
                      {c.target_date && <span className="text-[11px] text-muted-foreground">{c.target_date}</span>}
                    </div>
                    <Evidence item={c} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Dependencies / Milestones / Blockers / Assumptions */}
          <GenericCard icon={Link2} title={t("dependencies")} items={intelligence.dependencies} category="dependencies" empty={t("none")} ownerCtx={ownerCtx} />
          <GenericCard icon={Flag} title={t("milestones")} items={intelligence.milestones} category="milestones" empty={t("none")} ownerCtx={ownerCtx} />
          <GenericCard icon={Ban} title={t("blockers")} items={intelligence.blockers} category="blockers" empty={t("none")} ownerCtx={ownerCtx} />
          <GenericCard icon={HelpCircle} title={t("assumptions")} items={intelligence.assumptions} category="assumptions" empty={t("none")} ownerCtx={ownerCtx} />
        </div>
      </div>
    </div>
  );
}
