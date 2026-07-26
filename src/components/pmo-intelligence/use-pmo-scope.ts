"use client";

// ============================================================================
// PMO Intelligence Center — the single scope hook (CAP-048 Phase 2, M3)
// ============================================================================
// One hook owns the whole dashboard's state. That is the requirement, not a
// style preference: the failure this replaces is panels with private filters,
// where a date range set on the left leaves the graph on the right answering a
// different question and nothing on screen says so.
//
// Two kinds of state, kept apart on purpose:
//
//   SCOPE    — the question being asked (org, projects, dates, lens, search).
//              Serialisable, mirrored to the URL, so a view is shareable.
//   SESSION  — how the user is currently interrogating the answer (selection,
//              focus, path endpoints, drawers). Not in the URL: putting hover
//              and selection in the address bar rewrites history on every click.
//
// Three rules do the real work here:
//
//   1. `isDataAffecting` decides whether a scope change costs a server round
//      trip. Switching lens or typing in search must NOT reload — the data is
//      already in memory and the lens only reprojects it.
//   2. Every reload is guarded by `scopeKey`. Responses that arrive after the
//      scope moved on are discarded, so a slow request for a scope the user has
//      already left can never overwrite the current one.
//   3. `reconcileSession` runs after any narrowing, so a selection the new scope
//      no longer shows is dropped instead of leaving the side panel describing
//      an invisible node.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  defaultScope,
  isDataAffecting,
  scopeKey,
  scopeToSearchParams,
  type PmoLens,
  type PmoScope,
} from "@/lib/pmo-intelligence/scope";
import {
  EMPTY_SESSION,
  applyKpiIntentToSession,
  clearSelection,
  pickPathEndpoint,
  reconcileSession,
  scopeNarrowed,
  selectNode,
  toggleDrawer,
  type PmoDrawerState,
  type PmoSessionState,
} from "@/lib/pmo-intelligence/session-state";

/** What a data-affecting scope change asks the server for. */
export type ScopeReloader<TModel> = (
  scope: PmoScope,
  signal: AbortSignal,
) => Promise<TModel>;

export interface UsePmoScopeOptions<TModel> {
  organizationId: string;
  /** Scope parsed from the URL on the server, so the first paint already matches. */
  initialScope?: PmoScope;
  /** Model the server rendered with. Avoids a redundant fetch on mount. */
  initialModel: TModel;
  /** Absent ⇒ the dashboard is read-only over its initial model. */
  reload?: ScopeReloader<TModel>;
  /**
   * Node ids currently on the canvas. Feeding this back in is what lets the
   * hook discard selections the new scope no longer shows.
   */
  visibleNodeIds?: ReadonlySet<string>;
}

export interface UsePmoScopeResult<TModel> {
  scope: PmoScope;
  session: PmoSessionState;
  model: TModel;
  /** True while a data-affecting reload is in flight. */
  isLoading: boolean;
  /** Set when the last reload failed; the previous model is kept on screen. */
  error: string | null;

  // ── scope transitions ────────────────────────────────────────────────────
  setScope: (next: PmoScope | ((current: PmoScope) => PmoScope)) => void;
  setLens: (lens: PmoLens) => void;
  setProjectIds: (projectIds: string[]) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setSearch: (search: string) => void;
  resetScope: () => void;

  // ── session transitions ──────────────────────────────────────────────────
  setSession: (next: PmoSessionState | ((current: PmoSessionState) => PmoSessionState)) => void;
  onSelectNode: (nodeId: string, additive?: boolean) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onPickPathEndpoint: (nodeId: string) => void;
  onClearSelection: () => void;
  onToggleDrawer: (drawer: PmoDrawerState) => void;
  onSetImpactDepth: (depth: 1 | 2 | 3 | null) => void;
  onApplyKpiIntent: (intent: {
    lens: PmoLens | null;
    selectNodeIds: string[];
    openPanel: "health" | "focus" | "evidence" | null;
    focus: boolean;
  }) => void;
}

export function usePmoScope<TModel>({
  organizationId,
  initialScope,
  initialModel,
  reload,
  visibleNodeIds,
}: UsePmoScopeOptions<TModel>): UsePmoScopeResult<TModel> {
  const router = useRouter();
  const pathname = usePathname();

  const [scope, setScopeState] = useState<PmoScope>(
    () => initialScope ?? defaultScope(organizationId),
  );
  const [session, setSession] = useState<PmoSessionState>(EMPTY_SESSION);
  const [model, setModel] = useState<TModel>(initialModel);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The data key the current `model` belongs to. Compared against the key of an
  // arriving response so a superseded one is dropped rather than rendered.
  const loadedKeyRef = useRef(scopeKey(scope));
  const abortRef = useRef<AbortController | null>(null);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // Read inside the async callback below, where `scope` would otherwise be the
  // value captured when the request started rather than the current one.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // ── URL mirror ──────────────────────────────────────────────────────────
  // `replace`, never `push`: a filter is not a page. Pushing would make the
  // back button walk through every project the user ticked instead of leaving
  // the dashboard.
  useEffect(() => {
    const params = scopeToSearchParams(scope).toString();
    const target = params ? `${pathname}?${params}` : pathname;
    // Skip the write when the address bar already says this. Without the guard
    // a `replace` fires on every scope-shaped render, which on some browsers
    // steals focus from the control the user is still typing in.
    const current =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : null;
    if (current === target) return;
    router.replace(target, { scroll: false });
  }, [scope, pathname, router]);

  // ── Data-affecting reloads ──────────────────────────────────────────────
  const runReload = useCallback((next: PmoScope) => {
    const loader = reloadRef.current;
    if (!loader) return;

    const key = scopeKey(next);
    // A request already in flight for a scope the user has left is not just
    // wasted — if it resolved last it would render the wrong data.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    loader(next, controller.signal)
      .then((fresh) => {
        if (controller.signal.aborted) return;
        // Second guard, for loaders that ignore the signal: the key must still
        // be the one the user is looking at.
        if (key !== scopeKey(scopeRef.current)) return;
        loadedKeyRef.current = key;
        setModel(fresh);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        // The previous model stays on screen. Blanking the dashboard because
        // one refresh failed loses the context the user was working in.
        setError(cause instanceof Error ? cause.message : "unknown");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const setScope = useCallback(
    (next: PmoScope | ((current: PmoScope) => PmoScope)) => {
      setScopeState((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        if (resolved === current) return current;

        if (isDataAffecting(current, resolved)) {
          runReload(resolved);
        }
        // Narrowing can strand a selection; widening and lens changes cannot,
        // so the reconciliation walk is skipped for the common case.
        if (scopeNarrowed(current, resolved) && visibleNodeIds) {
          setSession((currentSession) => reconcileSession(currentSession, visibleNodeIds));
        }
        return resolved;
      });
    },
    [runReload, visibleNodeIds],
  );

  // Selections can also be stranded by the graph changing under a stable scope
  // (a reload returning fewer nodes). Reconciling on the visible set covers it.
  useEffect(() => {
    if (!visibleNodeIds) return;
    setSession((current) => reconcileSession(current, visibleNodeIds));
  }, [visibleNodeIds]);

  // ── Narrow scope setters ────────────────────────────────────────────────
  const setLens = useCallback(
    (lens: PmoLens) => setScope((current) => ({ ...current, activeLens: lens })),
    [setScope],
  );

  const setProjectIds = useCallback(
    (projectIds: string[]) => setScope((current) => ({ ...current, projectIds })),
    [setScope],
  );

  const setDateRange = useCallback(
    (from: string | null, to: string | null) =>
      setScope((current) => ({ ...current, dateRange: { from, to } })),
    [setScope],
  );

  const setSearch = useCallback(
    (search: string) => setScope((current) => ({ ...current, search })),
    [setScope],
  );

  const resetScope = useCallback(
    () => setScope(defaultScope(organizationId)),
    [organizationId, setScope],
  );

  // ── Session transitions ─────────────────────────────────────────────────
  const onSelectNode = useCallback(
    (nodeId: string, additive = false) =>
      setSession((current) => selectNode(current, nodeId, additive)),
    [],
  );

  const onSelectEdge = useCallback(
    (edgeId: string | null) =>
      setSession((current) => ({ ...current, selectedEdgeId: edgeId, selectedNodeIds: [] })),
    [],
  );

  const onPickPathEndpoint = useCallback(
    (nodeId: string) => setSession((current) => pickPathEndpoint(current, nodeId)),
    [],
  );

  const onClearSelection = useCallback(
    () => setSession((current) => clearSelection(current)),
    [],
  );

  const onToggleDrawer = useCallback(
    (drawer: PmoDrawerState) => setSession((current) => toggleDrawer(current, drawer)),
    [],
  );

  const onSetImpactDepth = useCallback(
    (depth: 1 | 2 | 3 | null) => setSession((current) => ({ ...current, impactDepth: depth })),
    [],
  );

  const onApplyKpiIntent = useCallback(
    (intent: {
      lens: PmoLens | null;
      selectNodeIds: string[];
      openPanel: "health" | "focus" | "evidence" | null;
      focus: boolean;
    }) => {
      // A KPI click is one gesture: it may move the lens AND aim the canvas.
      // Both halves are applied together so the screen never shows a lens that
      // disagrees with the selection it was opened for.
      if (intent.lens) setLens(intent.lens);
      setSession((current) => applyKpiIntentToSession(current, intent));
    },
    [setLens],
  );

  return useMemo(
    () => ({
      scope,
      session,
      model,
      isLoading,
      error,
      setScope,
      setLens,
      setProjectIds,
      setDateRange,
      setSearch,
      resetScope,
      setSession,
      onSelectNode,
      onSelectEdge,
      onPickPathEndpoint,
      onClearSelection,
      onToggleDrawer,
      onSetImpactDepth,
      onApplyKpiIntent,
    }),
    [
      scope,
      session,
      model,
      isLoading,
      error,
      setScope,
      setLens,
      setProjectIds,
      setDateRange,
      setSearch,
      resetScope,
      onSelectNode,
      onSelectEdge,
      onPickPathEndpoint,
      onClearSelection,
      onToggleDrawer,
      onSetImpactDepth,
      onApplyKpiIntent,
    ],
  );
}
