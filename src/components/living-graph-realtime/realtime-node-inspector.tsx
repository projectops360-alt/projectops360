"use client";

// ============================================================================
// ProjectOps360° — Realtime Living Graph · Node inspector
// ============================================================================
// Right-side inspector for a selected node. Pure display of the view-model node
// (verbatim payload) + owner/team context. Shows evidence availability and the
// hierarchy path. Never recomputes truth, never mutates canonical data.
// ============================================================================

import { useTranslations } from "next-intl";
import { ExternalLink, Sparkles, Users, X } from "lucide-react";
import {
  nodeTitle,
  nodeStatus,
  nodeProgress,
  type RealtimeGraphNode,
} from "@/lib/living-graph-realtime-ui";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/50 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export interface RealtimeNodeInspectorProps {
  node: RealtimeGraphNode | null;
  ownerName: string | null;
  onClose: () => void;
  onOpenTeam?: () => void;
}

export function RealtimeNodeInspector({ node, ownerName, onClose, onOpenTeam }: RealtimeNodeInspectorProps) {
  const t = useTranslations("realtimeGraph");
  if (!node) return null;
  const status = nodeStatus(node);
  const progress = nodeProgress(node);
  const due = typeof node.payload.due_date === "string" ? node.payload.due_date : null;
  const priority = typeof node.payload.priority === "string" ? node.payload.priority : null;

  return (
    <aside
      data-testid="rt-inspector"
      className="flex h-full w-full max-w-xs flex-col overflow-y-auto border-l border-border bg-card p-4"
      aria-label={t("inspector.title")}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("inspector.title")}</h3>
        <button type="button" onClick={onClose} aria-label={t("inspector.close")} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm font-medium text-foreground">{nodeTitle(node)}</p>
      <div className="mt-3">
        <Row label={t("inspector.kind")} value={t(`kind.${node.nodeKind}`)} />
        <Row label={t("inspector.status")} value={status ? status.replaceAll("_", " ") : "—"} />
        <Row label={t("inspector.progress")} value={progress != null ? `${progress}%` : "—"} />
        <Row label={t("inspector.owner")} value={ownerName ?? t("inspector.unassigned")} />
        {priority && <Row label={t("inspector.priority")} value={priority.toUpperCase()} />}
        {due && <Row label={t("inspector.dueDate")} value={due} />}
        <Row label={t("inspector.version")} value={`v${node.changedAtVersion}`} />
        {node.evidenceAvailable && (
          <Row
            label={t("inspector.evidence")}
            value={
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Sparkles className="h-3 w-3" aria-hidden /> {t("inspector.evidenceAvailable")}
              </span>
            }
          />
        )}
      </div>
      {onOpenTeam && (
        <button
          type="button"
          onClick={onOpenTeam}
          data-testid="rt-open-team"
          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          <Users className="h-3 w-3" aria-hidden /> {t("inspector.viewTeam")}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </button>
      )}
    </aside>
  );
}
