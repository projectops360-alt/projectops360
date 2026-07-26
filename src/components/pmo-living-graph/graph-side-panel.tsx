"use client";

// ============================================================================
// PMO Portfolio Living Graph — inspection panel (CAP-048)
// ============================================================================
// The answer to "where does this come from?". Every node and every edge on the
// canvas can be opened here and traced back to the row that produced it —
// provenance, confidence, evidence, and a link to the canonical record.
//
// Nothing is computed in this file. It renders what the projection already
// carries, and where the projection carries nothing it says `dataUnavailable`
// rather than filling the gap with a plausible-looking value.
// ============================================================================

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import type {
  GraphEdge,
  GraphEvidenceRef,
  GraphNode,
} from "@/lib/pmo-living-graph/contracts";
import type { CriticalNode } from "@/lib/pmo-living-graph/graph-algorithms";
import { HEALTH_CLASS } from "./graph-flow-types";
import { EDGE_TYPE_LABEL, HEALTH_LABEL, KIND_LABEL } from "./graph-nodes";

export interface SidePanelNodeContext {
  node: GraphNode;
  /** Edges touching this node, already scoped to the current window. */
  connectedEdges: GraphEdge[];
  /** Labels for the other endpoint of each connected edge. */
  labelsById: ReadonlyMap<string, string>;
  /** Risk nodes that impact this node. */
  relatedRisks: GraphNode[];
  /** Child nodes reached by a containment edge (subtasks of a task, and so on). */
  children: GraphNode[];
  /** Budget items charged against this node. */
  costs: GraphNode[];
  /** Present when this node made the critical list; carries the reasons. */
  critical: CriticalNode | null;
  projectLabel: string | null;
}

/**
 * Metrics rendered as their own labelled fields rather than inside the generic
 * metrics list. Duplicating them there would show the same number twice under
 * two different names.
 */
const PROMOTED_TASK_METRICS = ["estimateHours", "actualHours", "priority"] as const;

export function GraphSidePanel({
  locale,
  base,
  nodeContext,
  edgeContext,
  onClose,
}: {
  locale: "en" | "es";
  /** Locale prefix for canonical-record links ("" or "/es"). */
  base: string;
  nodeContext: SidePanelNodeContext | null;
  edgeContext: { edge: GraphEdge; sourceLabel: string; targetLabel: string } | null;
  onClose: () => void;
}) {
  const t = useTranslations("pmoLivingGraph");
  if (!nodeContext && !edgeContext) return null;

  return (
    <aside
      aria-label={nodeContext ? t("nodeType") : t("relationship")}
      className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {nodeContext
              ? KIND_LABEL[nodeContext.node.kind][locale]
              : t("relationship")}
          </p>
          <h2 className="mt-0.5 text-sm font-extrabold leading-tight text-slate-950">
            {nodeContext
              ? nodeContext.node.label
              : `${edgeContext!.sourceLabel} → ${edgeContext!.targetLabel}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "es" ? "Cerrar" : "Close"}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {nodeContext ? (
          <NodeDetails locale={locale} base={base} context={nodeContext} />
        ) : (
          <EdgeDetails locale={locale} context={edgeContext!} />
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

function NodeDetails({
  locale,
  base,
  context,
}: {
  locale: "en" | "es";
  base: string;
  context: SidePanelNodeContext;
}) {
  const t = useTranslations("pmoLivingGraph");
  const { node, connectedEdges, labelsById, relatedRisks, children, costs, critical, projectLabel } =
    context;
  const recordHref = canonicalRecordHref(base, node);
  // Tasks and subtasks carry hours and priority; promoting them to their own
  // fields is what turns "Metrics: estimateHours 8" into something a PMO reads
  // without decoding a key name.
  const workLike = node.kind === "task" || node.kind === "subtask";

  return (
    <div className="space-y-4">
      {/* Description first: it is the answer to "what is M9?", which is the
          question a two-character milestone title provokes. Missing is stated,
          never smoothed over. */}
      <div>
        <FieldLabel>{t("description")}</FieldLabel>
        <p
          className={`mt-0.5 whitespace-pre-line text-xs leading-relaxed ${
            node.description ? "text-slate-700" : "text-slate-400"
          }`}
        >
          {node.description ?? t("noDescription")}
        </p>
      </div>

      <Field label={t("nodeType")} value={KIND_LABEL[node.kind][locale]} />
      <Field label={t("project")} value={projectLabel} fallback={t("dataUnavailable")} />
      <Field
        label={t("status")}
        value={node.status ? node.status.replaceAll("_", " ") : null}
        fallback={t("dataUnavailable")}
      />

      <div>
        <FieldLabel>{t("health")}</FieldLabel>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <span className={`h-2 w-2 rounded-full ${HEALTH_CLASS[node.health].dot}`} aria-hidden />
          {HEALTH_LABEL[node.health][locale]}
        </p>
      </div>

      <Field
        label={t("dates")}
        // Both bounds are optional in the projection; an open range is stated as
        // open rather than silently rendered as a single date.
        value={
          node.validFrom || node.validTo
            ? `${node.validFrom ?? "—"} → ${node.validTo ?? "—"}`
            : null
        }
        fallback={t("dataUnavailable")}
      />
      {workLike ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("estimateHours")}
            value={metricText(node.metrics.estimateHours)}
            fallback={t("dataUnavailable")}
          />
          <Field
            label={t("actualHours")}
            value={metricText(node.metrics.actualHours)}
            fallback={t("dataUnavailable")}
          />
          {node.kind === "task" ? (
            <Field
              label={t("priority")}
              value={metricText(node.metrics.priority)}
              fallback={t("dataUnavailable")}
            />
          ) : null}
        </div>
      ) : null}

      <Field label={t("lastUpdated")} value={node.updatedAt} fallback={t("dataUnavailable")} />

      {/* Metrics ---------------------------------------------------------- */}
      <Section title={t("metrics")}>
        {remainingMetrics(node, workLike).length === 0 ? (
          <Empty>{t("dataUnavailable")}</Empty>
        ) : (
          <dl className="space-y-1">
            {remainingMetrics(node, workLike).map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2 text-xs">
                <dt className="truncate text-slate-500">{humanise(key)}</dt>
                <dd className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {/* A null metric is missing, not zero. */}
                  {value === null || value === "" ? t("dataUnavailable") : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      {/* Children --------------------------------------------------------- */}
      {/* A task's subtasks, a milestone's tasks. Rendered with their own
          descriptions because that is exactly what the canvas cannot fit. */}
      {children.length > 0 ? (
        <Section
          title={node.kind === "task" ? t("subtasks") : t("dependencies")}
        >
          <ul className="space-y-1.5">
            {children.map((child) => (
              <li key={child.id} className="text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${HEALTH_CLASS[child.health].dot}`}
                    aria-hidden
                  />
                  <span className="truncate">{child.label}</span>
                </span>
                <span
                  className={`mt-0.5 block line-clamp-2 pl-3 ${
                    child.description ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {child.description ?? t("noDescription")}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Costs ------------------------------------------------------------ */}
      {costs.length > 0 ? (
        <Section title={t("costs")}>
          <ul className="space-y-1">
            {costs.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-slate-700">{item.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {/* Actual first, estimate as the fallback; a null cost is
                      unknown, never rendered as zero money. */}
                  {metricText(item.metrics.actualCost) ??
                    metricText(item.metrics.estimatedCost) ??
                    t("dataUnavailable")}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Why critical ----------------------------------------------------- */}
      {critical ? (
        <Section title={t("whyCritical")}>
          <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700">
            {critical.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Dependencies ----------------------------------------------------- */}
      <Section title={t("dependencies")}>
        {connectedEdges.length === 0 ? (
          <Empty>{t("dataUnavailable")}</Empty>
        ) : (
          <ul className="space-y-1">
            {connectedEdges.map((edge) => {
              const outgoing = edge.sourceNodeId === node.id;
              const otherId = outgoing ? edge.targetNodeId : edge.sourceNodeId;
              return (
                <li key={edge.id} className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">
                    {outgoing ? "→" : "←"} {EDGE_TYPE_LABEL[edge.type]?.[locale] ?? edge.type}
                  </span>{" "}
                  <span className="text-slate-800">
                    {labelsById.get(otherId) ?? otherId}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Related risks ---------------------------------------------------- */}
      <Section title={t("relatedRisks")}>
        {relatedRisks.length === 0 ? (
          <Empty>{t("dataUnavailable")}</Empty>
        ) : (
          <ul className="space-y-1">
            {relatedRisks.map((risk) => (
              <li key={risk.id} className="flex items-center gap-1.5 text-xs text-slate-800">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${HEALTH_CLASS[risk.health].dot}`}
                  aria-hidden
                />
                <span className="truncate">{risk.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ProvenanceBlock
        provenance={node.provenance}
        confidence={node.confidence}
        evidence={node.evidenceRefs}
      />

      {recordHref ? (
        <Link
          href={recordHref}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {t("openRecord")}
        </Link>
      ) : (
        // No route exists for this entity type. Saying so beats a dead link.
        <p className="text-xs text-slate-400">{t("dataUnavailable")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

function EdgeDetails({
  locale,
  context,
}: {
  locale: "en" | "es";
  context: { edge: GraphEdge; sourceLabel: string; targetLabel: string };
}) {
  const t = useTranslations("pmoLivingGraph");
  const { edge, sourceLabel, targetLabel } = context;

  return (
    <div className="space-y-4">
      <Field
        label={t("relationship")}
        value={EDGE_TYPE_LABEL[edge.type]?.[locale] ?? edge.type}
      />
      <Field
        label={t("direction")}
        value={
          edge.direction === "directed"
            ? `${sourceLabel} → ${targetLabel}`
            : `${sourceLabel} ↔ ${targetLabel}`
        }
      />
      <Field
        label={t("status")}
        value={edge.status ? edge.status.replaceAll("_", " ") : null}
        fallback={t("dataUnavailable")}
      />

      <Section title={t("whyExists")}>
        {/* The explanation is the evidence note the projection attached, not a
            sentence generated here — an invented rationale would be exactly the
            fiction this module is built to avoid. */}
        {edge.evidenceRefs.length === 0 ? (
          <Empty>{t("dataUnavailable")}</Empty>
        ) : (
          <ul className="space-y-1 text-xs text-slate-700">
            {edge.evidenceRefs.map((ref) => (
              <li key={`${ref.sourceTable}:${ref.sourceId}`}>
                {ref.note ? (
                  <span>{ref.note}</span>
                ) : (
                  <span className="text-slate-500">
                    {locale === "es" ? "Registrado en" : "Recorded in"} {ref.sourceTable}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ProvenanceBlock
        provenance={edge.provenance}
        confidence={edge.confidence}
        evidence={edge.evidenceRefs}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function ProvenanceBlock({
  provenance,
  confidence,
  evidence,
}: {
  provenance: string;
  confidence: number;
  evidence: readonly GraphEvidenceRef[];
}) {
  const t = useTranslations("pmoLivingGraph");
  // Only the three provenances Phase 1 can actually produce have a translated
  // sentence; anything else falls back to the raw token rather than being
  // described in words the data does not support.
  const provenanceLabel =
    provenance === "OBSERVED"
      ? t("provenanceObserved")
      : provenance === "INFERRED"
        ? t("provenanceInferred")
        : provenance === "DECLARED"
          ? t("provenanceDeclared")
          : provenance;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <FieldLabel>{t("provenance")}</FieldLabel>
        <p className="mt-0.5 text-xs font-semibold text-slate-800">{provenanceLabel}</p>
      </div>
      <div>
        <FieldLabel>{t("confidence")}</FieldLabel>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-bold tabular-nums text-slate-700">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>
      <div>
        <FieldLabel>{t("evidence")}</FieldLabel>
        {evidence.length === 0 ? (
          <Empty>{t("dataUnavailable")}</Empty>
        ) : (
          <ul className="mt-0.5 space-y-0.5">
            {evidence.map((ref) => (
              <li
                key={`${ref.sourceTable}:${ref.sourceId}`}
                className="truncate font-mono text-[10px] text-slate-500"
                title={`${ref.sourceTable} · ${ref.sourceId}`}
              >
                {ref.sourceTable} · {ref.sourceId.slice(0, 8)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className={`mt-0.5 text-xs ${value ? "font-semibold text-slate-800" : "text-slate-400"}`}>
        {value ?? fallback ?? "—"}
      </p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-3">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-400">{children}</p>;
}

/**
 * A metric as display text, or null when there is nothing to show.
 *
 * Null and empty string both mean "not recorded" and must stay distinguishable
 * from a real 0 — an unestimated task is not a zero-hour task.
 */
function metricText(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

/** Metrics not already promoted to their own field, so nothing renders twice. */
function remainingMetrics(
  node: GraphNode,
  workLike: boolean,
): [string, number | string | null][] {
  const entries = Object.entries(node.metrics);
  if (!workLike) return entries;
  const promoted = new Set<string>(PROMOTED_TASK_METRICS);
  return entries.filter(([key]) => !promoted.has(key));
}

/** `estimateHours` → `Estimate hours`. Keys are camelCase by contract. */
function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Deep link to the canonical record.
 *
 * Only kinds with a real route are linked. Fabricating a URL for an entity that
 * has no page would hand the PMO a 404 — worse than admitting there is nowhere
 * to go.
 */
export function canonicalRecordHref(base: string, node: GraphNode): string | null {
  const projectId = node.projectId;
  switch (node.kind) {
    case "project":
      return `${base}/projects/${node.canonicalEntityId}`;
    case "milestone":
    case "task":
      return projectId ? `${base}/projects/${projectId}/execution-map` : null;
    // No dedicated risk register route exists; the project status page is the
    // closest canonical surface that actually lists them.
    case "risk":
      return projectId ? `${base}/projects/${projectId}/status` : null;
    case "decision":
      return projectId
        ? `${base}/projects/${projectId}/decisions/${node.canonicalEntityId}`
        : null;
    case "budget_item":
      return projectId ? `${base}/projects/${projectId}/budget` : null;
    case "stakeholder":
      return projectId ? `${base}/projects/${projectId}/stakeholders` : null;
    case "resource":
      return projectId ? `${base}/projects/${projectId}/resource-capacity` : null;
    default:
      return null;
  }
}
