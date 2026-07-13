// ============================================================================
// Living Graph — Canonical-event flow builder (CAP-045 extension)
// ============================================================================
// PURE: maps the projected canonical events + relationships (output of
// event-relationship-projection.ts) into React Flow nodes/edges + a
// deterministic layout. No Supabase, no I/O, no side effects, no mutation.
//
// Node id conventions (deterministic):
//   event  node → `ev:<eventId>`
//   object node → `obj:<objectType>:<objectId>`
//
// Edge styling by relationshipClass (the view's edge component applies it):
//   temporal         → dashed (order only — NEVER causality)
//   causal           → solid + arrow (explicitly recorded cause)
//   compensation     → dotted + arrow (explicitly recorded compensation)
//   object_reference → thin dotted (secondary)
// ============================================================================

import { MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import type {
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
} from "@/types/living-graph";
import type {
  CanonicalEventFlowNode,
  CanonicalEventFlowEdge,
  CanonicalObjectFlowNode,
} from "@/components/graph/living-graph-flow-types";

/** Stable event node id. */
export function canonicalEventNodeId(eventId: string): string {
  return `ev:${eventId}`;
}

/** Stable object node id. */
export function canonicalObjectNodeId(objectType: string, objectId: string): string {
  return `obj:${objectType}:${objectId}`;
}

export interface CanonicalFlowResult {
  nodes: Node[];
  edges: Edge[];
  /** Deterministic positions keyed by node id (event + object nodes). */
  positions: Map<string, { x: number; y: number }>;
}

// ── Layout constants ───────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 96;
const OBJ_NODE_W = 150;
const COLS = 6;
const GAP_X = 64;
const GAP_Y = 56;

/** Deterministic grid layout: events flow left→right, wrapping every COLS.
 *  Ordered by sequence_number so the project's authoritative order reads
 *  naturally. Object nodes are placed in a secondary band below. */
function layoutPositions(
  events: LivingGraphCanonicalEvent[],
  objectIds: Array<{ id: string; type: string; rawId: string }>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  events.forEach((e, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    positions.set(canonicalEventNodeId(e.eventId), {
      x: col * (NODE_W + GAP_X),
      y: row * (NODE_H + GAP_Y),
    });
  });
  // Object band: a row beneath the events, wrapped too.
  const eventsRows = Math.max(1, Math.ceil(events.length / COLS));
  const baseY = eventsRows * (NODE_H + GAP_Y) + 40;
  objectIds.forEach((o, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    positions.set(canonicalObjectNodeId(o.type, o.rawId), {
      x: col * (OBJ_NODE_W + GAP_X),
      y: baseY + row * (NODE_H + GAP_Y),
    });
  });
  return positions;
}

function markerEnd(color: string): { type: MarkerType.ArrowClosed; color: string; width: number; height: number } {
  return { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
}

/**
 * Build React Flow nodes/edges + positions for the canonical-events view.
 * PURE and deterministic: same inputs ⇒ same output.
 */
export function buildCanonicalFlow(
  events: LivingGraphCanonicalEvent[],
  relationships: LivingGraphEventRelationship[],
  selectedEventId: string | null,
): CanonicalFlowResult {
  // ── Event nodes ──
  const eventNodes: CanonicalEventFlowNode[] = events.map((e) => ({
    id: canonicalEventNodeId(e.eventId),
    type: "canonicalEvent" as const,
    position: { x: 0, y: 0 }, // positions applied by the caller
    width: NODE_W,
    height: NODE_H,
    selected: canonicalEventNodeId(e.eventId) === selectedEventId,
    data: {
      event: e,
      selected: canonicalEventNodeId(e.eventId) === selectedEventId,
    },
  }));

  // ── Object nodes (secondary) — one per unique object touched by events ──
  const objectMap = new Map<string, { type: string; rawId: string; label: string }>();
  for (const e of events) {
    for (const ref of e.objectRefs) {
      const key = `${ref.object_type}:${ref.object_id}`;
      if (!objectMap.has(key)) {
        objectMap.set(key, {
          type: ref.object_type,
          rawId: ref.object_id,
          label: `${ref.object_type} · ${ref.object_id.slice(0, 8)}`,
        });
      }
    }
  }
  const objectEntries = [...objectMap.values()];
  const objectNodes: CanonicalObjectFlowNode[] = objectEntries.map((o) => {
    const id = canonicalObjectNodeId(o.type, o.rawId);
    return {
      id,
      type: "canonicalObject" as const,
      position: { x: 0, y: 0 },
      width: OBJ_NODE_W,
      height: 56,
      selected: id === selectedEventId,
      data: {
        objectType: o.type,
        objectId: o.rawId,
        label: o.label,
        selected: id === selectedEventId,
      },
    };
  });

  // ── Relationship edges ──
  const edges: CanonicalEventFlowEdge[] = [];
  for (const rel of relationships) {
    const source = canonicalEventNodeId(rel.sourceEventId);
    let target: string;
    if (rel.relationshipType === "relates_to_object") {
      // event → object node
      if (!rel.objectId || !rel.objectType) continue;
      target = canonicalObjectNodeId(rel.objectType, rel.objectId);
    } else {
      if (!rel.targetEventId) continue;
      target = canonicalEventNodeId(rel.targetEventId);
    }
    const color =
      rel.relationshipClass === "causal"
        ? "#dc2626" // red — explicit cause
        : rel.relationshipClass === "compensation"
          ? "#7c3aed" // purple — compensation
          : rel.relationshipClass === "object_reference"
            ? "#94a3b8" // slate — secondary
            : "#0891b2"; // cyan — temporal order
    edges.push({
      id: rel.id,
      type: "canonicalEventEdge" as const,
      source,
      target,
      // Causal + compensation carry a visible direction arrow; temporal order
      // and object-reference are undirected in meaning (no arrow) so the view
      // doesn't imply a causal direction that wasn't recorded.
      markerEnd:
        rel.relationshipClass === "causal" || rel.relationshipClass === "compensation"
          ? markerEnd(color)
          : undefined,
      data: {
        relationship: rel,
        relationshipClass: rel.relationshipClass,
      },
      // Stroke styling is finalized in the edge component (dash pattern by class).
      style: { stroke: color },
    });
  }

  const positions = layoutPositions(
    events,
    objectEntries.map((o) => ({ id: o.rawId, type: o.type, rawId: o.rawId })),
  );

  return {
    nodes: [...eventNodes, ...objectNodes] as Node[],
    edges: edges as Edge[],
    positions,
  };
}