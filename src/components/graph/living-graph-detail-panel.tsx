"use client";

// ============================================================================
// ProjectOps360° — Living Graph detail panel (selected node / edge)
// ============================================================================

import { memo, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Route,
  Scissors,
  TrendingDown,
  Crosshair,
  Sparkles,
  ArrowRight,
  Lock,
  Pencil,
  HardHat,
  ShieldAlert,
  XCircle,
  ClipboardCheck,
  ExternalLink,
  Ban,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getI18nValue } from "@/types/database";
import { getNodeNavActions } from "@/lib/graph/node-navigation";
import type { ExecutionStatus } from "@/lib/execution/status-engine";
import type {
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphOverlay,
  LivingGraphSimulationState,
  LivingGraphSimulationScenario,
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
} from "@/types/living-graph";
import {
  buildNodeInsight,
  type GraphAnalysis,
} from "@/lib/graph/living-graph-analysis";
import {
  NODE_TYPE_STYLES,
  EDGE_TYPE_STYLES,
  RISK_COLORS,
  GRAPH_SEMANTIC_COLORS,
  SHORTAGE_RISK_COLORS,
} from "@/lib/graph/living-graph-styles";
import type { LaborRiskNodeData, ReadinessNodeData, VarianceNodeData } from "@/types/living-graph";
import type { ShortageRiskLevel, ReadinessLevel } from "@/types/database";
import { VarianceDetailBlock } from "@/components/graph/variance-detail-block";

const SCENARIOS: LivingGraphSimulationScenario[] = [
  "delay1d",
  "delay3d",
  "delay1w",
  "markBlocked",
  "removeBlocker",
  "increaseDuration",
];

/** Sprint #4 — bilingual labels for the deterministic execution status. */
const EXEC_STATUS_LABEL: Record<ExecutionStatus, { en: string; es: string }> = {
  draft: { en: "Draft", es: "Borrador" },
  ready: { en: "Ready", es: "Listo" },
  in_progress: { en: "In progress", es: "En progreso" },
  waiting: { en: "Waiting", es: "En espera" },
  waiting_on_dependency: { en: "Waiting on dependency", es: "Esperando dependencia" },
  blocked: { en: "Blocked", es: "Bloqueado" },
  on_hold: { en: "On hold", es: "En pausa" },
  completed: { en: "Completed", es: "Completado" },
  cancelled: { en: "Cancelled", es: "Cancelado" },
};

export interface LivingGraphDetailPanelProps {
  selectedNode: LivingGraphNode | null;
  selectedEdge: LivingGraphEdge | null;
  analysis: GraphAnalysis;
  overlay: LivingGraphOverlay;
  projectId: string;
  onNavigate: (href: string) => void;
  simulation: LivingGraphSimulationState | null;
  pathModeFromId: string | null;
  onFindPathFrom: (nodeId: string) => void;
  onExtractSubgraph: (node: LivingGraphNode) => void;
  onShowDownstream: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
  onRunScenario: (nodeId: string, scenario: LivingGraphSimulationScenario) => void;
  onEditEntity: (node: LivingGraphNode) => void;
  onClose: () => void;
  /** Owner id → display name (team members / assignees). Read-only context. */
  ownerNames?: Record<string, string>;
  /** Open the project team member roster from the map context. */
  onOpenTeam?: () => void;
  // ── Canonical-event Relationships view (CAP-045 extension) ───────────────
  /** When present, the panel renders the canonical-event detail block instead
   *  of the operational node/edge blocks. Read-only. */
  selectedCanonicalEvent?: LivingGraphCanonicalEvent | null;
  /** All projected relationships (used to show this event's related events). */
  canonicalEventRelationships?: LivingGraphEventRelationship[];
  /** Whether the event log read was truncated. Surfaced as a note. */
  eventsTruncated?: boolean;
}

/** Tasks and milestones can be edited in place via the roadmap dialogs. */
function isEditable(node: LivingGraphNode): boolean {
  return (
    node.id.startsWith("milestone:") ||
    node.sourceEntityType === "milestones" ||
    node.sourceEntityType === "roadmap_tasks"
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[11px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

function LivingGraphDetailPanelComponent({
  selectedNode,
  selectedEdge,
  analysis,
  overlay,
  projectId,
  onNavigate,
  simulation,
  pathModeFromId,
  onFindPathFrom,
  onExtractSubgraph,
  onShowDownstream,
  onFocusNode,
  onRunScenario,
  onEditEntity,
  onClose,
  ownerNames,
  onOpenTeam,
  selectedCanonicalEvent,
  canonicalEventRelationships,
  eventsTruncated,
}: LivingGraphDetailPanelProps) {
  const t = useTranslations("livingGraph");
  const locale = useLocale();
  const isEs = locale === "es";
  const tr = (f: { en?: string; es?: string }) => (isEs ? f.es : f.en) ?? f.en ?? "";

  const fmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const formatDate = (value: string | null) =>
    value ? fmt.format(new Date(value)) : "—";

  const metrics = selectedNode ? analysis.metrics.get(selectedNode.id) : undefined;
  const insight = selectedNode ? buildNodeInsight(selectedNode, metrics) : null;

  const incoming = selectedNode
    ? (analysis.adjacency.inc.get(selectedNode.id) ?? [])
    : [];
  const outgoing = selectedNode
    ? (analysis.adjacency.out.get(selectedNode.id) ?? [])
    : [];
  // The milestone-flow view draws a SYNTHETIC sequential chain (order_index) to
  // show reading order — it is NOT a prerequisite dependency. Exclude it from the
  // "Incoming/Outgoing dependencies" lists so a new/empty milestone does not read
  // as depending on whatever phase merely precedes it in the chain. Structural
  // counts (Neighbors / in-degree / upstream) keep the flow connection.
  const isRealDep = (e: { metadata?: Record<string, unknown> }) =>
    e.metadata?.milestone_chain !== true;
  const incomingDeps = incoming.filter(isRealDep);
  const outgoingDeps = outgoing.filter(isRealDep);

  const durationDays = (node: LivingGraphNode): string => {
    if (node.durationDays != null) return `${node.durationDays}d`;
    if (node.startDate && node.endDate) {
      const days =
        (new Date(node.endDate).getTime() - new Date(node.startDate).getTime()) / 86_400_000;
      return `${Math.max(0, Math.round(days * 10) / 10)}d`;
    }
    return "—";
  };

  const actionButton =
    "inline-flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors";

  if (!selectedNode && !selectedEdge && !selectedCanonicalEvent) return null;

  // ── Canonical-event detail (CAP-045 extension) ─────────────────────────────
  // When a canonical event is selected, render its read-only detail block and
  // skip the operational node/edge blocks. Every field is read straight from
  // the event store projection — none is invented. Payload/provenance are
  // behind collapsible sections so they don't dump raw JSON by default.
  if (selectedCanonicalEvent) {
    return (
      <CanonicalEventDetail
        event={selectedCanonicalEvent}
        relationships={canonicalEventRelationships ?? []}
        eventsTruncated={eventsTruncated ?? false}
        onClose={onClose}
        formatDate={formatDate}
      />
    );
  }

  return (
    <aside
      aria-label={t("detailPanel.title")}
      className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card/95 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <h3 className="text-xs font-semibold text-foreground">
          {selectedNode ? t("selectedNode") : t("selectedEdge")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("actions.close")}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* ── Node detail ── */}
      {selectedNode && (
        <div className="space-y-4 p-3">
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">{selectedNode.label}</p>
            {selectedNode.description && (
              <p className="mt-1 text-[11px] text-muted-foreground">{selectedNode.description}</p>
            )}
          </div>

          <dl className="divide-y divide-border/60 rounded-md border border-border px-2.5 py-1">
            <Field label={t("detailPanel.type")}>
              <span style={{ color: NODE_TYPE_STYLES[selectedNode.nodeType].accent }}>
                {t(`nodeTypes.${selectedNode.nodeType}`)}
              </span>
            </Field>
            <Field label={t("detailPanel.sourceEntity")}>
              {selectedNode.sourceEntityType}
            </Field>
            <Field label={t("detailPanel.sourceEntityId")}>
              <span className="break-all font-mono text-[10px]">{selectedNode.sourceEntityId}</span>
            </Field>
            <Field label={t("detailPanel.status")}>
              {selectedNode.status ? selectedNode.status.replaceAll("_", " ") : "—"}
            </Field>
            {metrics?.executionStatus && (
              <Field label={isEs ? "Estado de ejecución" : "Execution status"}>
                {tr(EXEC_STATUS_LABEL[metrics.executionStatus])}
              </Field>
            )}
            <Field label={t("detailPanel.progress")}>
              {selectedNode.progress != null ? `${selectedNode.progress}%` : "—"}
            </Field>

            {/* Subtask node inspector — owner (team member), due date, priority,
                and blocker reason from the read-only subtask layer metadata. */}
            {selectedNode.nodeType === "subtask_item" && (
              <>
                <Field label={t("subtasks.owner")}>
                  {(() => {
                    const ownerId = selectedNode.metadata.owner_id;
                    if (typeof ownerId !== "string" || !ownerId) return t("subtasks.unassigned");
                    return ownerNames?.[ownerId] ?? t("subtasks.unassigned");
                  })()}
                </Field>
                <Field label={t("subtasks.dueDate")}>
                  {formatDate(
                    typeof selectedNode.metadata.due_date === "string"
                      ? selectedNode.metadata.due_date
                      : null,
                  )}
                </Field>
                <Field label={t("subtasks.priority")}>
                  {typeof selectedNode.metadata.priority === "string"
                    ? selectedNode.metadata.priority.toUpperCase()
                    : "—"}
                </Field>
                {typeof selectedNode.metadata.blocked_reason === "string" &&
                  selectedNode.metadata.blocked_reason && (
                    <Field label={t("subtasks.blockedReason")}>
                      {selectedNode.metadata.blocked_reason}
                    </Field>
                  )}
                {onOpenTeam && (
                  <button
                    type="button"
                    onClick={onOpenTeam}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                    data-testid="graph-open-team"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden />
                    {t("subtasks.viewTeam")}
                  </button>
                )}
              </>
            )}

            <Field label={t("detailPanel.occurredAt")}>{formatDate(selectedNode.occurredAt)}</Field>
            <Field label={t("detailPanel.createdAt")}>{formatDate(selectedNode.createdAt)}</Field>
            <Field label={t("detailPanel.updatedAt")}>{formatDate(selectedNode.updatedAt)}</Field>
            <Field label={t("detailPanel.startDate")}>{formatDate(selectedNode.startDate)}</Field>
            <Field label={t("detailPanel.endDate")}>{formatDate(selectedNode.endDate)}</Field>
            <Field label={t("detailPanel.duration")}>{durationDays(selectedNode)}</Field>
            <Field label={t("detailPanel.riskLevel")}>
              {selectedNode.riskLevel ? (
                <span style={{ color: RISK_COLORS[selectedNode.riskLevel] }}>
                  {t(`detailPanel.risk.${selectedNode.riskLevel}`)}
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field label={t("detailPanel.blockerState")}>
              {selectedNode.isBlocked ? (
                <span className="inline-flex items-center gap-1" style={{ color: GRAPH_SEMANTIC_COLORS.blocked }}>
                  <Lock className="h-3 w-3" aria-hidden /> {t("detailPanel.blocked")}
                </span>
              ) : (
                t("detailPanel.notBlocked")
              )}
            </Field>
            <Field label={t("detailPanel.traceability")}>
              {metrics
                ? `${Math.round((1 - metrics.traceabilityGapScore) * 100)}%`
                : "—"}
            </Field>
            <Field label={t("detailPanel.neighbors")}>
              {incoming.length + outgoing.length}
            </Field>
            {metrics && (
              <>
                <Field label={t("detailPanel.inDegree")}>{metrics.inDegree}</Field>
                <Field label={t("detailPanel.outDegree")}>{metrics.outDegree}</Field>
                <Field label={t("detailPanel.downstream")}>{metrics.downstreamCount}</Field>
                <Field label={t("detailPanel.upstream")}>{metrics.upstreamCount}</Field>
                <Field label={t("detailPanel.criticalPath")}>
                  {metrics.onCriticalPath ? t("detailPanel.yes") : t("detailPanel.no")}
                </Field>
              </>
            )}
          </dl>

          {/* Dependencies (real prerequisites only — never the synthetic flow chain) */}
          {(incomingDeps.length > 0 || outgoingDeps.length > 0) && (
            <div className="space-y-2">
              {incomingDeps.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("detailPanel.incoming")}
                  </h4>
                  <ul className="space-y-1">
                    {incomingDeps.slice(0, 8).map((e) => (
                      <li key={e.id} className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: EDGE_TYPE_STYLES[e.edgeType].stroke }}
                          aria-hidden
                        />
                        <span className="truncate">
                          {analysis.adjacency.nodeById.get(e.sourceNodeId)?.label ?? e.sourceNodeId}
                        </span>
                        <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
                          {t(`edgeTypes.${e.edgeType}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {outgoingDeps.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("detailPanel.outgoing")}
                  </h4>
                  <ul className="space-y-1">
                    {outgoingDeps.slice(0, 8).map((e) => (
                      <li key={e.id} className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: EDGE_TYPE_STYLES[e.edgeType].stroke }}
                          aria-hidden
                        />
                        <span className="truncate">
                          {analysis.adjacency.nodeById.get(e.targetNodeId)?.label ?? e.targetNodeId}
                        </span>
                        <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
                          {t(`edgeTypes.${e.edgeType}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Labor Capacity Risk section */}
          {Boolean(selectedNode.metadata?.laborRisk) &&
            (selectedNode.metadata!.laborRisk as LaborRiskNodeData).shortageRisk !== "none" && (
            <LaborRiskDetailBlock
              laborRisk={selectedNode.metadata!.laborRisk as LaborRiskNodeData}
            />
          )}

          {/* Readiness detail block */}
          {Boolean(selectedNode.metadata?.readiness) && (
            <ReadinessDetailBlock
              readiness={selectedNode.metadata!.readiness as ReadinessNodeData}
            />
          )}

          {Boolean(selectedNode.metadata?.variance) && (
            <VarianceDetailBlock
              variance={selectedNode.metadata!.variance as VarianceNodeData}
            />
          )}

          {/* AI placeholder insight */}
          {insight && (
            <div className="rounded-md border border-brand-500/30 bg-brand-500/5 p-2.5">
              <h4 className="mb-1 flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("detailPanel.aiExplanation")}
              </h4>
              <p className="text-[11px] text-foreground">
                {t(`insights.${insight.kind}`, insight.values)}
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {t(`recommendations.${insight.kind}`)}
              </p>
            </div>
          )}

          {/* Sprint #4 — evidence/relationship state + navigate to the real record */}
          {incoming.length === 0 && outgoing.length === 0 && (
            <p className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {isEs
                ? "Este nodo aún no está vinculado a otros registros del proyecto."
                : "This node is not yet linked to other project records."}
            </p>
          )}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isEs ? "Ir al registro" : "Go to record"}
            </h4>
            {getNodeNavActions(selectedNode, projectId).map((a) =>
              a.enabled && a.href ? (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onNavigate(a.href!)}
                  className="inline-flex w-full items-center gap-2 rounded-md bg-brand-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {tr(a.label_i18n)}
                </button>
              ) : (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground"
                  title={a.disabledReason_i18n ? tr(a.disabledReason_i18n) : undefined}
                >
                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium text-foreground/80">{tr(a.label_i18n)}</span>
                    {a.disabledReason_i18n ? ` — ${tr(a.disabledReason_i18n)}` : ""}
                  </span>
                </div>
              ),
            )}
            {/* Isabella explanation — grounded handoff lands in a later sprint. */}
            <button
              type="button"
              disabled
              title={isEs ? "Próximamente: explicación de Isabella sobre este nodo" : "Coming soon: Isabella explanation for this node"}
              className="inline-flex w-full items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground opacity-70"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {isEs ? "Preguntar a Isabella sobre este nodo" : "Ask Isabella about this node"}
              <span className="ml-auto text-[9px] uppercase tracking-wide">{isEs ? "pronto" : "soon"}</span>
            </button>
          </div>

          {/* Actions */}
          <div className="space-y-1.5">
            {isEditable(selectedNode) && (
              <button
                type="button"
                onClick={() => onEditEntity(selectedNode)}
                className="inline-flex w-full items-center gap-2 rounded-md bg-brand-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t("actions.edit")}
              </button>
            )}
            <button
              type="button"
              onClick={() => onFindPathFrom(selectedNode.id)}
              className={cn(
                actionButton,
                pathModeFromId === selectedNode.id &&
                  "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400",
              )}
            >
              <Route className="h-3.5 w-3.5" aria-hidden />
              {pathModeFromId === selectedNode.id
                ? t("actions.findPathPending")
                : t("actions.findPath")}
            </button>
            <button
              type="button"
              onClick={() => onExtractSubgraph(selectedNode)}
              className={actionButton}
            >
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              {t("actions.extractSubgraph")}
            </button>
            <button
              type="button"
              onClick={() => onShowDownstream(selectedNode.id)}
              className={actionButton}
            >
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              {t("actions.showDownstream")}
            </button>
            <button
              type="button"
              onClick={() => onFocusNode(selectedNode.id)}
              className={actionButton}
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden />
              {t("actions.focusNode")}
            </button>
          </div>

          {/* What-if simulation */}
          {overlay === "simulation" && (
            <div className="space-y-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-2.5">
              <h4 className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
                {t("simulation.title")}
              </h4>
              {/* PD-005 — sandbox-first: simulation never mutates real data. */}
              <p className="rounded bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                {t("simulation.sandboxLabel")}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {SCENARIOS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onRunScenario(selectedNode.id, s)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px] transition-colors",
                      simulation?.focusNodeId === selectedNode.id && simulation.scenario === s
                        ? "border-orange-500 bg-orange-500/15 text-orange-600 dark:text-orange-400"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {t(`simulation.scenarios.${s}`)}
                  </button>
                ))}
              </div>
              {simulation && simulation.focusNodeId === selectedNode.id && (
                <div className="space-y-1 border-t border-orange-500/20 pt-2 text-[11px] text-foreground">
                  <p>
                    {t("simulation.result", {
                      affected: simulation.affectedNodeIds.length,
                      delay: simulation.estimatedDelayDays,
                      critical: simulation.criticalPathImpact,
                    })}
                  </p>
                  {simulation.affectedMilestoneLabels.length > 0 && (
                    <p className="text-muted-foreground">
                      {t("simulation.milestonesAffected", {
                        milestones: simulation.affectedMilestoneLabels.join(", "),
                      })}
                    </p>
                  )}
                  {simulation.strongestDependencyLabel && (
                    <p className="text-muted-foreground">
                      {t("simulation.strongestDependency", {
                        label: simulation.strongestDependencyLabel,
                      })}
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">{t("simulation.riskDelta")}: </span>
                    <span style={{ color: RISK_COLORS[simulation.riskDelta] }}>
                      {t(`detailPanel.risk.${simulation.riskDelta}`)}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t("simulation.mitigation")}</p>
                  <button
                    type="button"
                    disabled
                    title={t("simulation.applyUnavailable")}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-70"
                  >
                    {t("simulation.applyUnavailable")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Edge detail ── */}
      {!selectedNode && selectedEdge && (
        <div className="space-y-4 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="truncate">
              {analysis.adjacency.nodeById.get(selectedEdge.sourceNodeId)?.label ??
                selectedEdge.sourceNodeId}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {analysis.adjacency.nodeById.get(selectedEdge.targetNodeId)?.label ??
                selectedEdge.targetNodeId}
            </span>
          </div>

          <dl className="divide-y divide-border/60 rounded-md border border-border px-2.5 py-1">
            <Field label={t("detailPanel.edgeType")}>
              <span style={{ color: EDGE_TYPE_STYLES[selectedEdge.edgeType].stroke }}>
                {t(`edgeTypes.${selectedEdge.edgeType}`)}
              </span>
            </Field>
            <Field label={t("detailPanel.weight")}>{selectedEdge.weight}</Field>
            <Field label={t("detailPanel.lag")}>
              {selectedEdge.lagDays != null ? `${selectedEdge.lagDays}d` : "—"}
            </Field>
            <Field label={t("detailPanel.criticalPath")}>
              {analysis.criticalEdgeIds.has(selectedEdge.id)
                ? t("detailPanel.yes")
                : t("detailPanel.no")}
            </Field>
            <Field label={t("detailPanel.reworkLike")}>
              {selectedEdge.edgeType === "delayed" || selectedEdge.edgeType === "blocked"
                ? t("detailPanel.yes")
                : t("detailPanel.no")}
            </Field>
            <Field label={t("detailPanel.lacksEvidence")}>
              {selectedEdge.edgeType !== "informed" &&
              Object.keys(selectedEdge.metadata).length === 0
                ? t("detailPanel.yes")
                : t("detailPanel.no")}
            </Field>
          </dl>

          <div className="rounded-md border border-brand-500/30 bg-brand-500/5 p-2.5">
            <h4 className="mb-1 flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
              <Sparkles className="h-3 w-3" aria-hidden />
              {t("detailPanel.aiExplanation")}
            </h4>
            <p className="text-[11px] text-foreground">
              {t(`edgeMeanings.${selectedEdge.edgeType}`)}
            </p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {t("detailPanel.edgeRecommendation")}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

export const LivingGraphDetailPanel = memo(LivingGraphDetailPanelComponent);
LivingGraphDetailPanel.displayName = "LivingGraphDetailPanel";

// ============================================================================
// Canonical-event detail block (CAP-045 extension)
// ============================================================================
// Read-only inspector for a single canonical event (project_event_log row) and
// its projected relationships. Every field is read straight from the projection
// — nothing is invented. Payload + provenance are behind collapsible sections
// so the panel doesn't dump raw JSON by default.
// ============================================================================

function CanonicalEventDetail({
  event,
  relationships,
  eventsTruncated,
  onClose,
  formatDate,
}: {
  event: LivingGraphCanonicalEvent;
  relationships: LivingGraphEventRelationship[];
  eventsTruncated: boolean;
  onClose: () => void;
  formatDate: (value: string | null) => string;
}) {
  const t = useTranslations("livingGraph.canonicalEvents");
  const [showPayload, setShowPayload] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);

  // This event's relationships (excluding object_reference noise from the list).
  const related = relationships.filter(
    (r) => r.sourceEventId === event.eventId || r.targetEventId === event.eventId,
  );
  const causes = related.filter((r) => r.relationshipType === "caused_by" && r.targetEventId === event.eventId);
  const compensates = related.find((r) => r.relationshipType === "compensates" && r.sourceEventId === event.eventId);

  const classLabel: Record<string, string> = {
    temporal: t("classTemporal"),
    causal: t("classCausal"),
    compensation: t("classCompensation"),
    object_reference: t("classObjectReference"),
  };

  return (
    <aside
      aria-label={t("viewTitle")}
      className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card/95 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <h3 className="text-xs font-semibold text-foreground">{t("viewTitle")}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("viewTitle")}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <p className="break-all font-mono text-sm font-semibold leading-tight text-foreground">
            {event.eventType}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            #{event.sequenceNumber} · {event.eventCategory}
          </p>
        </div>

        <dl className="divide-y divide-border/60 rounded-md border border-border px-2.5 py-1">
          <Field label={t("occurredAt")}>{formatDate(event.occurredAt)}</Field>
          <Field label={t("recordedAt")}>
            <span className="flex items-center gap-1">
              {formatDate(event.recordedAt)}
              {event.lateRecorded && (
                <span className="rounded-sm bg-amber-500/15 px-1 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                  {t("lateRecorded")}
                </span>
              )}
            </span>
          </Field>
          <Field label={t("sequence")}>{event.sequenceNumber}</Field>
          <Field label={t("actor")}>
            {event.actorType ? `${event.actorType}${event.actorId ? ` · ${event.actorId.slice(0, 8)}` : ""}` : t("noActor")}
          </Field>
          <Field label={t("source")}>
            {event.sourceEntityType
              ? `${event.sourceEntityType}${event.sourceEntityId ? ` · ${event.sourceEntityId.slice(0, 8)}` : ""}`
              : t("noSource")}
          </Field>
          <Field label={t("stateTransition")}>
            {event.fromState || event.toState
              ? `${event.fromState ?? "—"} → ${event.toState ?? "—"}`
              : "—"}
          </Field>
          <Field label={t("captureMethod")}>{event.captureMethod ?? "—"}</Field>
          <Field label={t("confidence")}>
            {event.confidence != null ? `${Math.round(event.confidence * 100)}%` : "—"}
          </Field>
          <Field label={t("importance")}>{event.eventImportance ?? "—"}</Field>
          <Field label={t("lifecycle")}>{event.lifecycleClass ?? "—"}</Field>
        </dl>

        {/* Caused by — explicit only. When absent, surface the no-inference note. */}
        <div className="rounded-md border border-border px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("causedBy")}
          </p>
          {causes.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {causes.map((c) => (
                <li key={c.id} className="flex items-center gap-1 text-[10px] text-foreground">
                  <ArrowRight className="h-3 w-3 text-red-600" aria-hidden />
                  <span className="font-mono break-all">{c.sourceEventId.slice(0, 8)}</span>
                  <span className="text-muted-foreground">· {t("classCausal")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[10px] italic text-muted-foreground">{t("noCause")}</p>
          )}
        </div>

        {/* Compensates — explicit only. */}
        {compensates && (
          <div className="rounded-md border border-border px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("compensates")}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-foreground">
              <ArrowRight className="h-3 w-3 text-purple-600" aria-hidden />
              <span className="font-mono break-all">{compensates.targetEventId?.slice(0, 8)}</span>
            </p>
          </div>
        )}

        {/* Object references (type / id / role) — secondary. */}
        {event.objectRefs.length > 0 && (
          <div className="rounded-md border border-border px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("objectRefs")}
            </p>
            <ul className="mt-1 space-y-1">
              {event.objectRefs.map((ref, i) => (
                <li key={`${ref.object_type}-${ref.object_id}-${ref.role}-${i}`} className="text-[10px] text-foreground">
                  <span className="font-mono break-all">{ref.object_type} · {ref.object_id.slice(0, 8)}</span>
                  <span className="ml-1 rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">{ref.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Data quality flags. */}
        {event.dataQualityFlags.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {t("dataQualityFlags")}
            </p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {event.dataQualityFlags.map((f) => (
                <li key={f} className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible: Provenance. */}
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setShowProvenance((v) => !v)}
            className="flex w-full items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
            aria-expanded={showProvenance}
          >
            {showProvenance ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t("provenance")}
          </button>
          {showProvenance && event.provenance && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all border-t border-border px-2.5 py-2 text-[9px] text-muted-foreground">
              {JSON.stringify(event.provenance, null, 2)}
            </pre>
          )}
        </div>

        {/* Collapsible: Payload. */}
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setShowPayload((v) => !v)}
            className="flex w-full items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
            aria-expanded={showPayload}
          >
            {showPayload ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t("payload")}
          </button>
          {showPayload && event.payload && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all border-t border-border px-2.5 py-2 text-[9px] text-muted-foreground">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          )}
        </div>

        {/* Tamper-evident chain (read-only display). */}
        <dl className="divide-y divide-border/60 rounded-md border border-border px-2.5 py-1">
          <Field label={t("eventHash")}>
            <span className="break-all font-mono text-[9px]">{event.eventHash?.slice(0, 12) ?? "—"}…</span>
          </Field>
          <Field label={t("previousEventHash")}>
            <span className="break-all font-mono text-[9px]">
              {event.previousEventHash ? `${event.previousEventHash.slice(0, 12)}…` : "— (genesis)"}
            </span>
          </Field>
        </dl>

        {/* Related relationships summary. */}
        {related.filter((r) => r.relationshipType !== "relates_to_object").length > 0 && (
          <div className="rounded-md border border-border px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("classTemporal")} / {t("classCausal")} / {t("classCompensation")}
            </p>
            <ul className="mt-1 space-y-1">
              {related
                .filter((r) => r.relationshipType !== "relates_to_object")
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-1 text-[10px] text-foreground">
                    <span className="font-mono break-all">
                      {r.sourceEventId === event.eventId ? r.targetEventId?.slice(0, 8) : r.sourceEventId.slice(0, 8)}
                    </span>
                    <span className="text-muted-foreground">· {classLabel[r.relationshipClass]}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {eventsTruncated && (
          <p className="text-[9px] italic text-muted-foreground">{t("truncated", { count: 1000 })}</p>
        )}
      </div>
    </aside>
  );
}

function LaborRiskDetailBlock({ laborRisk: lr }: { laborRisk: LaborRiskNodeData }) {
  const t = useTranslations("livingGraph");

  return (
    <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2.5 space-y-2">
      <h4 className="flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400">
        <HardHat className="h-3 w-3" aria-hidden />
        {t("detailPanel.laborCapacitySection")}
      </h4>
      <dl className="divide-y divide-border/60 px-1 py-0.5">
        <Field label={t("detailPanel.laborTrade")}>{lr.tradeKey}</Field>
        <Field label={t("detailPanel.laborWeek")}>{lr.weekLabel}</Field>
        <Field label={t("detailPanel.laborRequiredHC")}>{lr.requiredHeadcount}</Field>
        <Field label={t("detailPanel.laborAvailableHC")}>{lr.availableHeadcount}</Field>
        <Field label={t("detailPanel.laborGapHC")}>
          <span style={{
            color: SHORTAGE_RISK_COLORS[lr.shortageRisk as ShortageRiskLevel] ?? RISK_COLORS.high,
          }}>
            {lr.gapHeadcount > 0 ? "+" : ""}{lr.gapHeadcount}
          </span>
        </Field>
        <Field label={t("detailPanel.laborUtilization")}>
          {lr.utilizationPct != null ? `${lr.utilizationPct}%` : "—"}
        </Field>
        <Field label={t("detailPanel.laborZone")}>{lr.locationZone || "—"}</Field>
        <Field label={t("detailPanel.laborCriticalPath")}>
          {lr.criticalPathImpact ? t("detailPanel.yes") : t("detailPanel.no")}
        </Field>
        {lr.affectedActivityKeys.length > 0 && (
          <Field label={t("detailPanel.laborAffectedActivities")}>
            <span className="text-[10px]">
              {lr.affectedActivityKeys.slice(0, 5).join(", ")}
              {lr.affectedActivityKeys.length > 5 ? ` +${lr.affectedActivityKeys.length - 5}` : ""}
            </span>
          </Field>
        )}
        {lr.affectedMilestoneIds.length > 0 && (
          <Field label={t("detailPanel.laborAffectedMilestones")}>
            <span className="text-[10px]">
              {lr.affectedMilestoneIds.length} milestone(s)
            </span>
          </Field>
        )}
      </dl>
      {lr.insightKind && (
        <p className="text-[10px] text-muted-foreground">
          {t("detailPanel.laborInsightKind")}: {lr.insightKind}
        </p>
      )}
    </div>
  );
}

// ── Readiness Detail Block ──────────────────────────────────────────────────────

const READINESS_LEVEL_COLORS: Record<ReadinessLevel, string> = {
  ready: "text-emerald-600 dark:text-emerald-400",
  at_risk: "text-amber-600 dark:text-amber-400",
  not_ready: "text-orange-600 dark:text-orange-400",
  blocked: "text-red-600 dark:text-red-400",
};

const READINESS_LEVEL_BG: Record<ReadinessLevel, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/5",
  at_risk: "border-amber-500/30 bg-amber-500/5",
  not_ready: "border-orange-500/30 bg-orange-500/5",
  blocked: "border-red-500/30 bg-red-500/5",
};

const READINESS_LEVEL_ICON: Record<ReadinessLevel, React.ReactNode> = {
  ready: <ClipboardCheck className="h-3 w-3 text-emerald-500" />,
  at_risk: <ShieldAlert className="h-3 w-3 text-amber-500" />,
  not_ready: <ShieldAlert className="h-3 w-3 text-orange-500" />,
  blocked: <XCircle className="h-3 w-3 text-red-500" />,
};

function ReadinessDetailBlock({ readiness }: { readiness: ReadinessNodeData }) {
  const t = useTranslations("livingGraph");

  return (
    <div className={`rounded-md border ${READINESS_LEVEL_BG[readiness.readinessLevel]} p-2.5 space-y-2`}>
      <h4 className={`flex items-center gap-1 text-[11px] font-medium ${READINESS_LEVEL_COLORS[readiness.readinessLevel]}`}>
        {READINESS_LEVEL_ICON[readiness.readinessLevel]}
        {t("detailPanel.readinessSection")}
      </h4>
      <dl className="divide-y divide-border/60 px-1 py-0.5">
        <Field label={t("detailPanel.readinessLevel")}>
          <span className={READINESS_LEVEL_COLORS[readiness.readinessLevel]}>
            {readiness.readinessLevel.replace("_", " ")}
          </span>
        </Field>
        <Field label={t("detailPanel.readinessPct")}>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  readiness.readinessPct >= 80 ? "bg-emerald-500" :
                  readiness.readinessPct >= 50 ? "bg-amber-500" :
                  "bg-red-500"
                )}
                style={{ width: `${readiness.readinessPct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums">{readiness.readinessPct}%</span>
          </div>
        </Field>
        {readiness.missingPrerequisites.length > 0 && (
          <Field label={t("detailPanel.readinessMissing")}>
            <span className="text-[10px] text-orange-600 dark:text-orange-400">
              {readiness.missingPrerequisites.slice(0, 3).join(", ")}
              {readiness.missingPrerequisites.length > 3 ? ` +${readiness.missingPrerequisites.length - 3}` : ""}
            </span>
          </Field>
        )}
        {readiness.summary && (
          <Field label={t("detailPanel.readinessSummary")}>
            <span className="text-[10px] text-foreground/80">{readiness.summary}</span>
          </Field>
        )}
        {readiness.recommendedAction && (
          <Field label={t("detailPanel.readinessAction")}>
            <span className="text-[10px] text-brand-600 dark:text-brand-400">{readiness.recommendedAction}</span>
          </Field>
        )}
      </dl>
    </div>
  );
}
