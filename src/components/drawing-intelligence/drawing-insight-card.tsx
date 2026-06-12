"use client";

import { useState } from "react";
import {
  AlertTriangle, MessageSquareQuote, ClipboardCheck, ShieldCheck,
  CalendarClock, DollarSign, HelpCircle, GitCompareArrows, Scale,
  Lightbulb, Check, X as XIcon, Eye, Link2, Loader2, Crosshair, FileText,
} from "lucide-react";
import {
  updateDrawingInsightStatusAction,
  linkDrawingInsightToTaskAction,
} from "@/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/actions";
import type {
  DrawingInsight,
  DrawingInsightSeverity,
} from "@/types/drawing-intelligence";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InsightCardTranslations {
  typeLabels: Record<string, string>;
  severityLabels: Record<DrawingInsightSeverity, string>;
  statusLabels: Record<string, string>;
  actionLabels: Record<string, string>;
  confidence: string;
  evidence: string;
  recommendedAction: string;
  linkedTask: string;
  accept: string;
  dismiss: string;
  markReviewed: string;
  linkToTask: string;
  cancel: string;
  needsReviewNote: string;
}

interface DrawingInsightCardProps {
  insight: DrawingInsight;
  projectId: string;
  /** Drawing label (number or file name) for the source line */
  drawingLabel: string | null;
  tasks: { id: string; title: string }[];
  translations: t9n;
  onChanged: () => void;
}
type t9n = InsightCardTranslations;

// ── Visual config ─────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  risk: AlertTriangle,
  rfi_candidate: MessageSquareQuote,
  submittal_requirement: ClipboardCheck,
  inspection_requirement: ShieldCheck,
  schedule_impact: CalendarClock,
  cost_impact: DollarSign,
  missing_information: HelpCircle,
  contradiction: Scale,
  version_change: GitCompareArrows,
  scope_gap: HelpCircle,
  coordination_issue: GitCompareArrows,
  decision_required: Lightbulb,
};

const SEVERITY_BADGE: Record<DrawingInsightSeverity, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  dismissed: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  converted: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  linked: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  actioned: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface EvidenceRef {
  page_number?: number;
  text_excerpt?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DrawingInsightCard({
  insight,
  projectId,
  drawingLabel,
  tasks,
  translations: t,
  onChanged,
}: DrawingInsightCardProps) {
  const [busy, setBusy] = useState(false);
  const [showLinkSelect, setShowLinkSelect] = useState(false);

  const Icon = TYPE_ICON[insight.insight_type] ?? Lightbulb;
  const evidenceRefs: EvidenceRef[] =
    ((insight.evidence_json as { evidence?: EvidenceRef[] })?.evidence ?? []).slice(0, 3);
  const isFinal = ["accepted", "dismissed", "converted"].includes(insight.status);
  const linkedTask = insight.linked_task_id
    ? tasks.find((task) => task.id === insight.linked_task_id)
    : null;

  const setStatus = async (status: string) => {
    setBusy(true);
    await updateDrawingInsightStatusAction({ insightId: insight.id, projectId, status });
    setBusy(false);
    onChanged();
  };

  const linkTask = async (taskId: string) => {
    setBusy(true);
    await linkDrawingInsightToTaskAction({ insightId: insight.id, projectId, taskId });
    setBusy(false);
    setShowLinkSelect(false);
    onChanged();
  };

  return (
    <div className={`rounded-xl border border-border bg-card p-3.5 shadow-sm ${insight.status === "dismissed" ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{insight.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              {t.typeLabels[insight.insight_type] ?? insight.insight_type}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${SEVERITY_BADGE[insight.severity]}`}>
              {t.severityLabels[insight.severity]}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[insight.status] ?? STATUS_BADGE.open}`}>
              {t.statusLabels[insight.status] ?? insight.status}
            </span>
            {insight.confidence_score != null && (
              <span className="tabular-nums text-muted-foreground">
                {t.confidence}: {Math.round(insight.confidence_score * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description + source */}
      {insight.description && (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">{insight.description}</p>
      )}
      {drawingLabel && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <FileText className="h-3 w-3" /> {drawingLabel}
          {evidenceRefs[0]?.page_number != null && <span>· p.{evidenceRefs[0].page_number}</span>}
        </p>
      )}

      {/* Evidence excerpts */}
      {evidenceRefs.length > 0 && (
        <div className="mt-2 space-y-1">
          {evidenceRefs.map((ev, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
              <Crosshair className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className="break-words italic">&ldquo;{ev.text_excerpt}&rdquo;</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommended action + linked task */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {insight.recommended_action && (
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t.recommendedAction}:</span>{" "}
            {t.actionLabels[insight.recommended_action] ?? insight.recommended_action}
          </span>
        )}
        {linkedTask && (
          <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400">
            <Link2 className="h-3 w-3" /> {t.linkedTask}: {linkedTask.title}
          </span>
        )}
      </div>

      {insight.status === "in_review" && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {t.needsReviewNote}
        </p>
      )}

      {/* Review actions */}
      {!isFinal && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : showLinkSelect ? (
            <>
              <select
                className="max-w-[260px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                defaultValue=""
                onChange={(e) => { if (e.target.value) void linkTask(e.target.value); }}
              >
                <option value="" disabled>{t.linkToTask}…</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowLinkSelect(false)}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                {t.cancel}
              </button>
            </>
          ) : (
            <>
              <ActionButton icon={Check} label={t.accept} onClick={() => void setStatus("accepted")}
                className="text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30" />
              {insight.status !== "in_review" ? null : (
                <ActionButton icon={Eye} label={t.markReviewed} onClick={() => void setStatus("open")}
                  className="text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30" />
              )}
              <ActionButton icon={Link2} label={t.linkToTask} onClick={() => setShowLinkSelect(true)}
                className="text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/30" />
              <ActionButton icon={XIcon} label={t.dismiss} onClick={() => void setStatus("dismissed")}
                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors ${className}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
