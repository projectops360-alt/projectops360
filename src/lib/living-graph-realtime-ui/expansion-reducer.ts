// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Expansion Reducer (pure)
// ============================================================================
// NotebookLM-style progressive expansion state — PRESENTATION ONLY, scoped per
// project + root scope so it never leaks between milestones, tasks, projects,
// or users. Expansion never mutates canonical task data. Pure reducers: every
// op returns a new state.
// ============================================================================

import type { LivingGraphRootScope } from "@/lib/living-graph/realtime";

/** Expansion sets keyed by scope key so scopes are isolated (no leak). */
export type ScopedExpansionState = Readonly<Record<string, readonly string[]>>;

/** Build the scope key an expansion set is stored under. */
export function expansionScopeKey(projectId: string, rootScope: LivingGraphRootScope): string {
  return `${projectId}::${rootScope.type}::${rootScope.id ?? "root"}`;
}

export function emptyExpansion(): ScopedExpansionState {
  return {};
}

function setFor(state: ScopedExpansionState, key: string): Set<string> {
  return new Set(state[key] ?? []);
}
function commit(state: ScopedExpansionState, key: string, set: Set<string>): ScopedExpansionState {
  return { ...state, [key]: [...set].sort() };
}

/** Toggle one node's expansion within a scope. */
export function toggleExpanded(
  state: ScopedExpansionState,
  key: string,
  nodeId: string,
): ScopedExpansionState {
  const set = setFor(state, key);
  if (set.has(nodeId)) set.delete(nodeId);
  else set.add(nodeId);
  return commit(state, key, set);
}

/**
 * Expand ALL — SCOPED: expands only the given expandable node ids (already
 * narrowed to the current milestone/task by the caller). Never touches other
 * scopes' sets, so it can never reveal other milestones' tasks.
 */
export function expandAllScoped(
  state: ScopedExpansionState,
  key: string,
  expandableNodeIds: readonly string[],
): ScopedExpansionState {
  const set = setFor(state, key);
  for (const id of expandableNodeIds) set.add(id);
  return commit(state, key, set);
}

/** Collapse ALL — return this scope to the clean default (nothing expanded). */
export function collapseAllScoped(state: ScopedExpansionState, key: string): ScopedExpansionState {
  if (!state[key] || state[key].length === 0) return state;
  const next = { ...state };
  next[key] = [];
  return next;
}

/** Reset the whole scope key (drops its expansion entirely). */
export function resetScope(state: ScopedExpansionState, key: string): ScopedExpansionState {
  if (!(key in state)) return state;
  const next = { ...state };
  delete next[key];
  return next;
}

export function isExpanded(state: ScopedExpansionState, key: string, nodeId: string): boolean {
  return (state[key] ?? []).includes(nodeId);
}

export function expandedIds(state: ScopedExpansionState, key: string): readonly string[] {
  return state[key] ?? [];
}
