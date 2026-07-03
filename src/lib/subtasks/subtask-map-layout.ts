// ============================================================================
// ProjectOps360° — Subtask Map saved layouts (presentation-only)
// ============================================================================
// Mirrors the Living Graph saved-layout contract (UX-007 / PD-008) for the
// task-level Subtask Map: persists WHERE the user dragged the nodes (and the
// viewport) so a manually organized subtask map survives refresh. It stores
// ONLY coordinates keyed by project + task + layout mode — never subtask data,
// status, relationships, or any business logic. The map data stays the
// deterministic source of truth; a saved layout only changes node x/y.
//
// Persistence: localStorage, scoped per project + task + layout, implicitly
// personal (per browser). SSR-safe and exception-safe. Pure reconciliation so
// a stale layout (subtasks added/removed) applies partially, never crashes.
// ============================================================================

export const SUBTASK_LAYOUT_SCHEMA_VERSION = 1 as const;

const SUBTASK_LAYOUT_PREFIX = "projectops.graph.subtaskLayout.";

export interface SavedSubtaskNodePosition {
  x: number;
  y: number;
}

export interface SavedSubtaskViewport {
  x: number;
  y: number;
  zoom: number;
}

/** A persisted manual arrangement of one task's Subtask Map. */
export interface SavedSubtaskLayout {
  version: number;
  projectId: string;
  taskId: string;
  /** Layout context (radial / hierarchical / left_to_right). */
  layout: string;
  /** nodeId → coordinates. Presentation only — never relationships. */
  nodes: Record<string, SavedSubtaskNodePosition>;
  viewport?: SavedSubtaskViewport;
  savedAt: string;
}

/** The context key a saved arrangement is scoped to (task + layout mode). */
export function buildSubtaskLayoutKey(taskId: string, layout: string): string {
  return `${taskId}:${layout}`;
}

function storageKey(projectId: string, layoutKey: string): string {
  return `${SUBTASK_LAYOUT_PREFIX}${projectId}.${layoutKey}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidLayout(value: unknown): value is SavedSubtaskLayout {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.version !== SUBTASK_LAYOUT_SCHEMA_VERSION) return false;
  if (!o.nodes || typeof o.nodes !== "object") return false;
  for (const pos of Object.values(o.nodes as Record<string, unknown>)) {
    if (!pos || typeof pos !== "object") return false;
    const p = pos as Record<string, unknown>;
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return false;
  }
  return true;
}

/** Load the saved layout for a project + task + layout, or null. Never throws. */
export function loadSubtaskLayout(
  projectId: string,
  taskId: string,
  layout: string,
): SavedSubtaskLayout | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(projectId, buildSubtaskLayoutKey(taskId, layout)));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist a layout. Returns false if storage is unavailable / quota exceeded. */
export function saveSubtaskLayout(layout: SavedSubtaskLayout): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(
      storageKey(layout.projectId, buildSubtaskLayoutKey(layout.taskId, layout.layout)),
      JSON.stringify(layout),
    );
    return true;
  } catch {
    return false;
  }
}

/** Remove the saved layout for a project + task + layout. Never throws. */
export function clearSubtaskLayout(projectId: string, taskId: string, layout: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(projectId, buildSubtaskLayoutKey(taskId, layout)));
  } catch {
    // ignore
  }
}

export interface SubtaskLayoutApplyResult {
  positions: Map<string, SavedSubtaskNodePosition>;
  matchedCount: number;
  missingFromSaved: number;
  droppedFromSaved: number;
}

/**
 * Reconcile a saved layout against the live node set. Pure + deterministic:
 * saved positions for nodes that no longer exist are dropped; live nodes with
 * no saved position are reported (the auto-layout places them). Never throws.
 */
export function applySavedSubtaskPositions(
  saved: SavedSubtaskLayout | null,
  liveNodeIds: readonly string[],
): SubtaskLayoutApplyResult {
  const positions = new Map<string, SavedSubtaskNodePosition>();
  if (!saved) {
    return { positions, matchedCount: 0, missingFromSaved: liveNodeIds.length, droppedFromSaved: 0 };
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
  const missingFromSaved = liveNodeIds.reduce((n, id) => (id in saved.nodes ? n : n + 1), 0);
  return { positions, matchedCount: matched, missingFromSaved, droppedFromSaved };
}

export function isSubtaskLayoutPartial(result: SubtaskLayoutApplyResult): boolean {
  return result.droppedFromSaved > 0 || result.missingFromSaved > 0;
}
