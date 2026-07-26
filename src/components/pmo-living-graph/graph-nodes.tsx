"use client";

// ============================================================================
// PMO Portfolio Living Graph — node renderer (CAP-048)
// ============================================================================
// One component for every kind, because the encoding is systematic rather than
// per-type bespoke: shape says what it is, size says how central it is, colour
// says how healthy it is, halo says how critical it is. Four independent
// channels a PMO can read at a glance without a lookup table.
//
// Memoised, and it reads ONLY from `data` — the parent patches interaction
// state in place (see graph-node-sync.ts), so a hover re-renders one node
// rather than the whole canvas.
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  Diamond,
  Flag,
  Gauge,
  ListChecks,
  Scale,
  ShieldAlert,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { GraphNodeKind } from "@/lib/pmo-living-graph/contracts";
import {
  HEALTH_CLASS,
  KIND_SHAPE,
  criticalityHalo,
  nodeFootprint,
  type GraphFlowNode,
} from "./graph-flow-types";

const KIND_ICON: Record<GraphNodeKind, typeof Building2> = {
  organization: Building2,
  project: Flag,
  milestone: Diamond,
  task: ListChecks,
  subtask: ListChecks,
  risk: ShieldAlert,
  decision: Scale,
  resource: Wrench,
  team_member: User,
  stakeholder: Users,
  kpi: Gauge,
  budget_item: CircleDollarSign,
};

/**
 * Shape is expressed through border geometry: React Flow nodes are boxes, and a
 * clipped polygon would make the label unreadable and the hit area lie about
 * where the node is.
 */
const SHAPE_CLASS: Record<string, string> = {
  hexagon: "rounded-[26px]",
  rounded: "rounded-xl",
  square: "rounded-[4px]",
  pill: "rounded-full",
  diamond: "rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm",
  circle: "rounded-[40%]",
};

/** Halo colour tracks health so the two channels reinforce instead of fighting. */
const HALO_CLASS: Record<string, string> = {
  healthy: "ring-emerald-200",
  at_risk: "ring-amber-200",
  critical: "ring-rose-200",
  unknown: "ring-slate-200",
};

function PortfolioGraphNode({ data, selected }: NodeProps<GraphFlowNode>) {
  const { node, drillable, isAnchor, hovered, dimmed, onPath, blastHop, lensEmphasis, locale } =
    data;
  const health = HEALTH_CLASS[node.health];
  const Icon = KIND_ICON[node.kind];
  const { width, height } = nodeFootprint(node);
  const halo = criticalityHalo(node.criticality);
  const es = locale === "es";

  // Kind label comes from the shared glossary namespace rather than being spelled
  // out here, so the canvas and the side panel never disagree.
  const kindLabel = KIND_LABEL[node.kind][es ? "es" : "en"];

  return (
    <div
      // The accessible name carries kind + health, which are otherwise only
      // encoded visually.
      aria-label={`${kindLabel}: ${node.label} — ${HEALTH_LABEL[node.health][es ? "es" : "en"]}`}
      style={{ width, minHeight: height }}
      className={[
        "relative flex flex-col justify-between border-2 bg-white px-3 py-2 shadow-sm",
        "transition-[opacity,box-shadow,border-color] duration-200 motion-reduce:transition-none",
        SHAPE_CLASS[KIND_SHAPE[node.kind]],
        selected ? "border-emerald-600 ring-4 ring-emerald-100" : health.border,
        // The anchor is the node the current level is *about*. Marking it stops
        // the milestone view reading as a flat list of unrelated boxes.
        !selected && isAnchor ? "border-emerald-600 ring-2 ring-emerald-100" : "",
        !selected && !isAnchor && halo ? `${halo} ${HALO_CLASS[node.health]}` : "",
        hovered ? "shadow-lg" : "",
        onPath ? "outline outline-2 outline-offset-2 outline-sky-500" : "",
        blastHop != null ? "shadow-[0_0_0_3px_rgba(217,119,6,0.35)]" : "",
        // Lens emphasis is a violet channel of its own: it must not be mistaken
        // for health (emerald/amber/rose) or for the sky-blue path highlight.
        lensEmphasis === "highlighted"
          ? "outline outline-2 outline-offset-[3px] outline-violet-500"
          : "",
        // A hover-driven dim is stronger than a lens mute — the explicit
        // gesture wins, and stacking both would make the node invisible.
        dimmed ? "opacity-20" : lensEmphasis === "muted" ? "opacity-40" : "opacity-100",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-white !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-white !bg-slate-400" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide ${health.text}`}>
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{kindLabel}</span>
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-tight text-slate-950">
            {node.label}
          </h3>
        </div>

        {/* Only offered where it leads somewhere: a leaf with a chevron would
            promise a level that does not exist. Double-click does the same
            thing; the button exists for keyboard and touch. */}
        {drillable && !isAnchor ? (
          <button
            type="button"
            // nodrag/nopan stop the click from being swallowed by the canvas.
            className="nodrag nopan inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            onClick={(event) => {
              event.stopPropagation();
              data.onDrillDown(node.id);
            }}
            aria-label={es ? `Abrir ${node.label}` : `Open ${node.label}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* The record's own description, when it has one. A title like "M9" is
          meaningless on its own, and the canvas is where the user is looking
          when they ask what it is. Never a placeholder: absent stays absent. */}
      {node.description ? (
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500">
          {node.description}
        </p>
      ) : null}

      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${health.dot}`} aria-hidden />
        <span className="truncate">
          {/* An absent status is stated, never rendered as a blank that reads as "fine". */}
          {node.status ? node.status.replaceAll("_", " ") : es ? "sin estado" : "no status"}
        </span>
        {blastHop != null ? (
          <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 font-bold text-amber-800">
            {blastHop}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Kind and health labels live here rather than in the message catalogue because
 * they are a closed, schema-level vocabulary shared with the side panel and the
 * legend; keeping them in one map is what stops the three surfaces drifting.
 */
export const KIND_LABEL: Record<GraphNodeKind, { en: string; es: string }> = {
  organization: { en: "Organization", es: "Organización" },
  project: { en: "Project", es: "Proyecto" },
  milestone: { en: "Milestone", es: "Hito" },
  task: { en: "Task", es: "Tarea" },
  subtask: { en: "Subtask", es: "Subtarea" },
  risk: { en: "Risk", es: "Riesgo" },
  decision: { en: "Decision", es: "Decisión" },
  resource: { en: "Resource", es: "Recurso" },
  team_member: { en: "Team member", es: "Miembro del equipo" },
  stakeholder: { en: "Stakeholder", es: "Interesado" },
  kpi: { en: "KPI", es: "KPI" },
  budget_item: { en: "Budget item", es: "Partida de presupuesto" },
};

export const HEALTH_LABEL: Record<string, { en: string; es: string }> = {
  healthy: { en: "Healthy", es: "Saludable" },
  at_risk: { en: "At risk", es: "En riesgo" },
  critical: { en: "Critical", es: "Crítico" },
  unknown: { en: "Unknown", es: "Desconocido" },
};

export const EDGE_TYPE_LABEL: Record<string, { en: string; es: string }> = {
  contains: { en: "Contains", es: "Contiene" },
  belongs_to: { en: "Belongs to", es: "Pertenece a" },
  depends_on: { en: "Depends on", es: "Depende de" },
  blocks: { en: "Blocks", es: "Bloquea" },
  assigned_to: { en: "Assigned to", es: "Asignado a" },
  owned_by: { en: "Owned by", es: "Propiedad de" },
  impacts: { en: "Impacts", es: "Impacta" },
  mitigates: { en: "Mitigates", es: "Mitiga" },
  approves: { en: "Approves", es: "Aprueba" },
  contributes_to: { en: "Contributes to", es: "Contribuye a" },
  consumes_budget: { en: "Consumes budget", es: "Consume presupuesto" },
  triggered_by: { en: "Triggered by", es: "Disparado por" },
  shares_resource_with: { en: "Shares a resource with", es: "Comparte recurso con" },
};

export const GraphNodeRenderer = memo(PortfolioGraphNode);
