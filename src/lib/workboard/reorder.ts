// ============================================================================
// ProjectOps360° — Workboard drag reorder / move (UX-013, pure, testable)
// ============================================================================
// Pure functions that turn a drag-and-drop result into a new task array plus the
// order_index updates to persist. No DOM, no I/O — so same-column reordering and
// cross-column moves are unit-tested without a browser. The board applies the
// result optimistically and persists via reorderTasksAction.
//
// Layout/interaction only (UX-013): status changes go through the existing
// status-change flow; reordering never changes counts, filters, or schema. When a
// milestone/sprint filter hides some tasks, reorder operates ONLY on the visible
// subset and preserves the hidden tasks' relative order (safe "Option A").
// ============================================================================

export interface BoardTaskLike {
  id: string;
  status: string;
  order_index: number;
}

export interface DragEndpoint {
  droppableId: string;
  index: number;
}

export interface ApplyBoardDragInput<T extends BoardTaskLike> {
  /** The full client task list (any order; grouped by status downstream). */
  tasks: T[];
  /** The @hello-pangea/dnd draggableId (e.g. "task-<id>" or a raw id). */
  draggableId: string;
  source: DragEndpoint;
  destination: DragEndpoint;
  /** Filter predicate — a task is "visible" when it passes the active filter.
   *  When omitted, every task is visible. `destination.index` is always an index
   *  within the VISIBLE subset of the destination column. */
  isVisible?: (task: T) => boolean;
}

export interface OrderUpdate {
  id: string;
  order_index: number;
}

export interface ApplyBoardDragResult<T extends BoardTaskLike> {
  tasks: T[];
  movedTaskId: string;
  fromStatus: string;
  toStatus: string;
  statusChanged: boolean;
  /** order_index writes to persist (affected column only). */
  orderUpdates: OrderUpdate[];
}

/** Strip the board's "task-" draggableId prefix if present. */
export function taskIdFromDraggableId(draggableId: string): string {
  return draggableId.startsWith("task-") ? draggableId.slice("task-".length) : draggableId;
}

/**
 * Insert `moved` into `column` (which must NOT already contain it) at the array
 * position that makes it land at `visibleIndex` among the VISIBLE tasks, while
 * keeping every hidden task in its original relative position.
 */
function insertAtVisibleIndex<T extends BoardTaskLike>(
  column: T[],
  moved: T,
  visibleIndex: number,
  isVisible: (t: T) => boolean,
): T[] {
  const out = [...column];
  if (visibleIndex <= 0) {
    // Before the first visible task (or at the end if none are visible).
    const firstVisible = out.findIndex(isVisible);
    out.splice(firstVisible === -1 ? out.length : firstVisible, 0, moved);
    return out;
  }
  let seen = 0;
  let insertPos = out.length;
  for (let i = 0; i < out.length; i++) {
    if (isVisible(out[i])) {
      seen++;
      if (seen === visibleIndex) {
        insertPos = i + 1;
        break;
      }
    }
  }
  out.splice(insertPos, 0, moved);
  return out;
}

/** Reindex a column's order_index to 0..n-1 in its current order. */
function reindex<T extends BoardTaskLike>(column: T[]): { column: T[]; updates: OrderUpdate[] } {
  const updates: OrderUpdate[] = [];
  const next = column.map((t, i) => {
    if (t.order_index !== i) updates.push({ id: t.id, order_index: i });
    return t.order_index === i ? t : { ...t, order_index: i };
  });
  return { column: next, updates };
}

/**
 * Apply a drag result. Returns null for a no-op (same column, same position, or a
 * missing/moved-nowhere task). For a same-column reorder it renumbers that column;
 * for a cross-column move it sets the moved task's status and renumbers the
 * destination column (the source column keeps its relative order).
 */
export function applyBoardDrag<T extends BoardTaskLike>(
  input: ApplyBoardDragInput<T>,
): ApplyBoardDragResult<T> | null {
  const { tasks, source, destination } = input;
  const isVisible = input.isVisible ?? (() => true);
  const movedTaskId = taskIdFromDraggableId(input.draggableId);
  const moved = tasks.find((t) => t.id === movedTaskId);
  if (!moved) return null;

  const fromStatus = source.droppableId;
  const toStatus = destination.droppableId;

  // ── Same-column reorder ────────────────────────────────────────────────────
  if (fromStatus === toStatus) {
    if (source.index === destination.index) return null;
    const fullColumn = tasks.filter((t) => t.status === fromStatus);
    const without = fullColumn.filter((t) => t.id !== movedTaskId);
    const reordered = insertAtVisibleIndex(without, moved, destination.index, isVisible);
    const { column, updates } = reindex(reordered);
    if (updates.length === 0) return null;
    const columnIds = new Set(column.map((t) => t.id));
    const rest = tasks.filter((t) => !columnIds.has(t.id));
    return {
      tasks: [...rest, ...column],
      movedTaskId,
      fromStatus,
      toStatus,
      statusChanged: false,
      orderUpdates: updates,
    };
  }

  // ── Cross-column move (status change) ──────────────────────────────────────
  const movedUpdated = { ...moved, status: toStatus };
  const sourceColumn = tasks.filter((t) => t.status === fromStatus && t.id !== movedTaskId);
  const destColumn = tasks.filter((t) => t.status === toStatus); // moved not here yet
  const newDest = insertAtVisibleIndex(destColumn, movedUpdated, destination.index, isVisible);
  const { column: reindexedDest, updates } = reindex(newDest);

  const affected = new Set<string>([
    ...sourceColumn.map((t) => t.id),
    ...reindexedDest.map((t) => t.id),
  ]);
  const rest = tasks.filter((t) => !affected.has(t.id) && t.id !== movedTaskId);

  return {
    tasks: [...rest, ...sourceColumn, ...reindexedDest],
    movedTaskId,
    fromStatus,
    toStatus,
    statusChanged: true,
    orderUpdates: updates,
  };
}
