// ============================================================================
// PMO Intelligence Center — session state reducer (CAP-048 Phase 2, M3)
// ============================================================================
// The half of the dashboard's state that does NOT travel in the URL: what is
// selected, what is focused, which drawer is open, how deep impact analysis is
// currently looking.
//
// It lives here rather than inside the hook for one reason: this is where the
// rules are that keep the screen consistent, and rules that only exist inside a
// component cannot be tested. In particular the rule that a scope change must
// discard selections the new scope no longer shows — the bug where narrowing to
// one project leaves the side panel describing a node from another.
//
// Pure and synchronous. The hook applies these transitions; it does not
// implement them.
// ============================================================================

import { retainValidSelection, type PmoScope } from "./scope";

/** Which secondary surface is open. Only one at a time, by construction. */
export type PmoDrawerState = "none" | "criticalPath" | "evidence" | "health" | "focus" | "insights";

export interface PmoSessionState {
  /** Multi-select. The side panel describes the last one. */
  selectedNodeIds: string[];
  focusedNodeId: string | null;
  selectedEdgeId: string | null;
  /** Find-path endpoints. Null until picked. */
  pathSource: string | null;
  pathTarget: string | null;
  /** Blast radius depth, or null when impact analysis is off. */
  impactDepth: 1 | 2 | 3 | null;
  expandedClusters: string[];
  drawerState: PmoDrawerState;
  /** Evidence package currently open, if any. */
  evidenceId: string | null;
}

export const EMPTY_SESSION: PmoSessionState = {
  selectedNodeIds: [],
  focusedNodeId: null,
  selectedEdgeId: null,
  pathSource: null,
  pathTarget: null,
  impactDepth: null,
  expandedClusters: [],
  drawerState: "none",
  evidenceId: null,
};

/**
 * Reconcile session state against the nodes the new scope actually shows.
 *
 * Everything that points at a node has to be checked, not just the selection:
 * a focused node, a path endpoint or an impact origin that no longer exists
 * would leave the canvas highlighting nothing while the toolbar still claims an
 * active query.
 */
export function reconcileSession(
  session: PmoSessionState,
  visibleNodeIds: ReadonlySet<string>,
): PmoSessionState {
  const selectedNodeIds = retainValidSelection(session.selectedNodeIds, visibleNodeIds);
  const focusedNodeId =
    session.focusedNodeId && visibleNodeIds.has(session.focusedNodeId)
      ? session.focusedNodeId
      : null;

  // A path needs BOTH ends. Keeping one endpoint would leave the toolbar in
  // "pick the second node" state with an invisible first pick.
  const pathIntact =
    session.pathSource != null &&
    session.pathTarget != null &&
    visibleNodeIds.has(session.pathSource) &&
    visibleNodeIds.has(session.pathTarget);

  const pathSource = pathIntact
    ? session.pathSource
    : session.pathSource && visibleNodeIds.has(session.pathSource)
      ? session.pathSource
      : null;
  const pathTarget = pathIntact ? session.pathTarget : null;

  // Impact analysis is anchored on the selection; with nothing selected there
  // is no origin, so the depth control must not stay lit.
  const impactDepth = selectedNodeIds.length > 0 ? session.impactDepth : null;

  const unchanged =
    selectedNodeIds.length === session.selectedNodeIds.length &&
    selectedNodeIds.every((id, index) => id === session.selectedNodeIds[index]) &&
    focusedNodeId === session.focusedNodeId &&
    pathSource === session.pathSource &&
    pathTarget === session.pathTarget &&
    impactDepth === session.impactDepth;

  // Returning the same object lets the hook skip a render when a scope change
  // did not actually invalidate anything.
  if (unchanged) return session;

  return { ...session, selectedNodeIds, focusedNodeId, pathSource, pathTarget, impactDepth };
}

/**
 * Selecting a node.
 *
 * `additive` is the shift-click gesture. A plain click replaces the selection,
 * because the common case is "look at this one instead", not "add this one".
 */
export function selectNode(
  session: PmoSessionState,
  nodeId: string,
  additive: boolean,
): PmoSessionState {
  if (!additive) {
    return { ...session, selectedNodeIds: [nodeId], selectedEdgeId: null };
  }
  const already = session.selectedNodeIds.includes(nodeId);
  return {
    ...session,
    selectedNodeIds: already
      ? session.selectedNodeIds.filter((id) => id !== nodeId)
      : [...session.selectedNodeIds, nodeId],
    selectedEdgeId: null,
  };
}

/**
 * Picking path endpoints.
 *
 * Two picks make a query; a third starts a new one rather than silently
 * extending the previous pair — the same rule the Phase 1 canvas established.
 */
export function pickPathEndpoint(session: PmoSessionState, nodeId: string): PmoSessionState {
  if (session.pathSource == null) return { ...session, pathSource: nodeId, pathTarget: null };
  if (session.pathTarget == null) return { ...session, pathTarget: nodeId };
  return { ...session, pathSource: nodeId, pathTarget: null };
}

/** Clearing everything that highlights the canvas, without touching the scope. */
export function clearSelection(session: PmoSessionState): PmoSessionState {
  return {
    ...session,
    selectedNodeIds: [],
    selectedEdgeId: null,
    focusedNodeId: null,
    impactDepth: null,
  };
}

/**
 * Toggling a drawer.
 *
 * Re-requesting the open drawer closes it, so a toolbar button is never a
 * one-way trip.
 */
export function toggleDrawer(
  session: PmoSessionState,
  drawer: PmoDrawerState,
): PmoSessionState {
  const next = session.drawerState === drawer ? "none" : drawer;
  // Closing the evidence drawer must drop the package it was showing, or
  // reopening it would flash stale evidence before the new one loads.
  return {
    ...session,
    drawerState: next,
    evidenceId: next === "evidence" ? session.evidenceId : null,
  };
}

/**
 * Apply a KPI intent to the session.
 *
 * The lens half of the intent belongs to the scope; this handles the part that
 * aims the canvas. Kept together with the other transitions so a KPI click and
 * a canvas click cannot end up producing different shapes of state.
 */
export function applyKpiIntentToSession(
  session: PmoSessionState,
  intent: {
    selectNodeIds: string[];
    openPanel: "health" | "focus" | "evidence" | null;
    focus: boolean;
  },
): PmoSessionState {
  return {
    ...session,
    selectedNodeIds: intent.selectNodeIds,
    selectedEdgeId: null,
    // Focus needs a single anchor; with a multi-node intent the first is the
    // one the camera can actually centre on.
    focusedNodeId: intent.focus ? (intent.selectNodeIds[0] ?? null) : null,
    drawerState: intent.openPanel ?? "none",
    impactDepth: null,
  };
}

/**
 * Whether a scope transition needs the session reconciled at all.
 *
 * Only narrowing can invalidate a selection. Widening (or changing the lens)
 * cannot, so the reconciliation pass — which walks every selected id — is
 * skipped for the common case of clicking between lenses.
 */
export function scopeNarrowed(previous: PmoScope, next: PmoScope): boolean {
  if (previous.organizationId !== next.organizationId) return true;
  if (next.projectIds.length === 0) return false;
  if (previous.projectIds.length === 0) return true;
  const before = new Set(previous.projectIds);
  return next.projectIds.some((id) => !before.has(id)) || next.projectIds.length < previous.projectIds.length;
}
