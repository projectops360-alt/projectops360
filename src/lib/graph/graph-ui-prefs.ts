// ============================================================================
// ProjectOps360° — Living Graph UI preferences (Sprint #2 — Focus & Usability)
// ============================================================================
// LAYOUT/INTERACTION ONLY. This module persists the user's *view* preferences
// (overlay, layout, level, insights panel state) and computes the active-filter
// count badge. It does NOT touch node/edge generation, status, blocker, rollup,
// capacity, or any graph business logic.
// ============================================================================

import { useEffect, useState } from "react";
import type { ProcessNodeType, ProcessEdgeType } from "@/types/database";

/** localStorage key namespace so graph prefs don't collide with other features. */
export const GRAPH_PREF_PREFIX = "po360.livingGraph.";

/**
 * SSR-safe persisted UI preference. Starts from `initial` on the server and the
 * first client render (no hydration mismatch), then hydrates from localStorage
 * after mount and writes back on every change. Used only for low-risk view
 * preferences — never for graph data.
 */
export function useGraphUiPref<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const storageKey = GRAPH_PREF_PREFIX + key;
  const [value, setValue] = useState<T>(initial);

  // Hydrate from localStorage after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore malformed/unavailable storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore quota/availability errors
    }
  }, [storageKey, value]);

  return [value, setValue];
}

export interface ActiveFilterArgs {
  statusFilter: string | null;
  riskFilter: "low" | "medium" | "high" | null;
  blockedOnly: boolean;
  criticalOnly: boolean;
  dateFrom: string;
  dateTo: string;
  nodeTypeFilter: Set<ProcessNodeType>;
  edgeTypeFilter: Set<ProcessEdgeType>;
  totalNodeTypes: number;
  totalEdgeTypes: number;
}

/**
 * How many filters are narrowing the graph right now. Drives the "N filters
 * active" badge on the Filters button. A node/edge-type set counts as one
 * active filter when it is not the full set (i.e. something is hidden).
 * Pure + deterministic so it is unit-testable.
 */
export function countActiveGraphFilters(a: ActiveFilterArgs): number {
  let n = 0;
  if (a.statusFilter != null) n++;
  if (a.riskFilter != null) n++;
  if (a.blockedOnly) n++;
  if (a.criticalOnly) n++;
  if (a.dateFrom) n++;
  if (a.dateTo) n++;
  if (a.nodeTypeFilter.size < a.totalNodeTypes) n++;
  if (a.edgeTypeFilter.size < a.totalEdgeTypes) n++;
  return n;
}
