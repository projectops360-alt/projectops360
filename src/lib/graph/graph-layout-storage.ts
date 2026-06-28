// ============================================================================
// ProjectOps360° — Living Graph saved layouts (UX-007 / PD-008)
// ============================================================================
// PRESENTATION STATE ONLY. This module persists *where the user dragged the
// nodes* (and the viewport) so a manually organized graph survives a refresh.
// It stores coordinates keyed by project + graph context — it NEVER stores
// edges, dependencies, status, blockers, capacity, rollups, or any business
// logic. The graph data stays the deterministic source of truth; a saved layout
// only changes the x/y of matching nodes. See PD-008 and
// docs/product-brain/12-living-graph-strategy.md.
//
// Persistence: localStorage, scoped per project + layout context, implicitly
// personal (per browser). A durable Supabase table (`project_graph_layouts`) is
// the documented upgrade path for shared/team layouts (PMO/Admin) — see PD-008.
// ============================================================================

import type { LivingGraphViewLevel, LivingGraphLayoutMode } from "@/types/living-graph";
import { GRAPH_PREF_PREFIX } from "./graph-ui-prefs";

/** Bump only on an incompatible shape change (old payloads are then ignored). */
export const LAYOUT_SCHEMA_VERSION = 1 as const;

export interface SavedNodePosition {
  x: number;
  y: number;
}

export interface SavedGraphViewport {
  x: number;
  y: number;
  zoom: number;
}

/** A persisted manual arrangement of the graph for one project + context. */
export interface SavedGraphLayout {
  version: number;
  projectId: string;
  /** Context key (level + layout mode) — see `buildLayoutKey`. */
  layoutKey: string;
  level: LivingGraphViewLevel;
  layoutMode: LivingGraphLayoutMode;
  /** nodeId → coordinates. Presentation only — never relationships. */
  nodes: Record<string, SavedNodePosition>;
  viewport?: SavedGraphViewport;
  savedAt: string;
}

/** Storage namespace for saved layouts (distinct from the view-pref keys). */
const LAYOUT_PREFIX = `${GRAPH_PREF_PREFIX}layout.`;

/**
 * The layout-context key a saved arrangement is scoped to. Milestones use a
 * serpentine flow that ignores `layoutMode`, so they share one key; the other
 * levels key by level + mode because each produces a different auto-geometry.
 * Changing layout mode (Executive Flow / Process Mining) therefore loads ITS
 * own saved layout instead of silently destroying the manual one.
 */
export function buildLayoutKey(
  level: LivingGraphViewLevel,
  layoutMode: LivingGraphLayoutMode,
): string {
  return level === "milestones" ? "milestones" : `${level}:${layoutMode}`;
}

function storageKey(projectId: string, layoutKey: string): string {
  return `${LAYOUT_PREFIX}${projectId}.${layoutKey}`;
}

/** SSR-safe, exception-safe handle to localStorage (null when unavailable). */
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null; // storage disabled / blocked (private mode, policy)
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A parsed value is a usable layout only if its node map is sane. */
function isValidLayout(value: unknown): value is SavedGraphLayout {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.version !== LAYOUT_SCHEMA_VERSION) return false;
  if (!o.nodes || typeof o.nodes !== "object") return false;
  for (const pos of Object.values(o.nodes as Record<string, unknown>)) {
    if (!pos || typeof pos !== "object") return false;
    const p = pos as Record<string, unknown>;
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return false;
  }
  return true;
}

/** Load the saved layout for a project + context, or null. Never throws. */
export function loadSavedLayout(projectId: string, layoutKey: string): SavedGraphLayout | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(projectId, layoutKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidLayout(parsed) ? parsed : null;
  } catch {
    return null; // malformed JSON or unavailable storage → treat as no layout
  }
}

/** Persist a layout. Returns false if storage is unavailable / quota exceeded. */
export function saveLayout(layout: SavedGraphLayout): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(storageKey(layout.projectId, layout.layoutKey), JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

/** Remove the saved layout for a project + context. Never throws. */
export function clearSavedLayout(projectId: string, layoutKey: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(projectId, layoutKey));
  } catch {
    // ignore
  }
}

/** Whether a saved layout exists for a project + context. */
export function hasSavedLayout(projectId: string, layoutKey: string): boolean {
  return loadSavedLayout(projectId, layoutKey) != null;
}

export interface LayoutApplyResult {
  /** Saved coordinates for nodes that still exist (apply over the auto-layout). */
  positions: Map<string, SavedNodePosition>;
  /** Saved positions matched to a live node. */
  matchedCount: number;
  /** Live nodes with no saved position (new nodes → auto-layout places them). */
  missingFromSaved: number;
  /** Saved positions whose node no longer exists (deleted nodes → ignored). */
  droppedFromSaved: number;
}

/**
 * Reconcile a saved layout against the live node set. Pure + deterministic and
 * resilient to graph change (TASK 7): saved positions for nodes that no longer
 * exist are dropped, and live nodes without a saved position are reported so the
 * caller can place them with the auto-layout. Never throws on stale data.
 */
export function applySavedPositions(
  saved: SavedGraphLayout | null,
  liveNodeIds: readonly string[],
): LayoutApplyResult {
  const positions = new Map<string, SavedNodePosition>();
  if (!saved) {
    return {
      positions,
      matchedCount: 0,
      missingFromSaved: liveNodeIds.length,
      droppedFromSaved: 0,
    };
  }
  const liveSet = new Set(liveNodeIds);
  let matched = 0;
  for (const [id, pos] of Object.entries(saved.nodes)) {
    if (liveSet.has(id)) {
      positions.set(id, pos);
      matched++;
    }
  }
  const droppedFromSaved = Object.keys(saved.nodes).length - matched;
  const missingFromSaved = liveNodeIds.reduce(
    (n, id) => (id in saved.nodes ? n : n + 1),
    0,
  );
  return { positions, matchedCount: matched, missingFromSaved, droppedFromSaved };
}

/**
 * Whether the saved layout only partially matched the current graph — i.e. some
 * saved nodes are gone or some visible nodes are new. Drives the subtle "Saved
 * layout was partially applied because the graph changed." notice (TASK 7).
 */
export function isPartialApply(result: LayoutApplyResult): boolean {
  return result.droppedFromSaved > 0 || result.missingFromSaved > 0;
}
