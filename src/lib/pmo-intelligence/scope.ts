// ============================================================================
// PMO Intelligence Center — shared scope (CAP-048 Phase 2, ADR-012)
// ============================================================================
// One scope for every panel. Before this, each surface kept its own filter
// state, so a date range set in one place left the rest of the screen showing
// something else. Here the scope is a single value: change it and everything
// recomputes from the same question.
//
// Serialisable on purpose — it round-trips through the URL, which is what makes
// a Dashboard 3 view shareable.
// ============================================================================

import type { GraphEdgeType, GraphNodeKind } from "@/lib/pmo-living-graph/contracts";

/**
 * Analytical lenses. Each reprojects the SAME graph rather than navigating
 * away — a lens that opened another screen would break the one thing this
 * dashboard is for.
 */
export const PMO_LENSES = [
  "overview",
  "process",
  "risk",
  "finance",
  "resources",
  "dependencies",
  "benefits",
  "whatif",
] as const;
export type PmoLens = (typeof PMO_LENSES)[number];

/** Inclusive ISO dates. Null on either side means unbounded. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface PmoScope {
  organizationId: string;
  /** Empty means the whole organization. */
  projectIds: string[];
  dateRange: DateRange;
  activeLens: PmoLens;
  /** Node kinds / edge types the user chose to hide. */
  nodeKinds: GraphNodeKind[];
  edgeTypes: GraphEdgeType[];
  search: string;
}

export function defaultScope(organizationId: string): PmoScope {
  return {
    organizationId,
    projectIds: [],
    dateRange: { from: null, to: null },
    activeLens: "overview",
    nodeKinds: [],
    edgeTypes: [],
    search: "",
  };
}

/**
 * Which parts of the scope change the *data* rather than only the presentation.
 *
 * Reloading the server read model is expensive; switching lens or typing in the
 * search box must not trigger it. This is the line between the two.
 */
export function isDataAffecting(previous: PmoScope, next: PmoScope): boolean {
  return (
    previous.organizationId !== next.organizationId ||
    previous.dateRange.from !== next.dateRange.from ||
    previous.dateRange.to !== next.dateRange.to ||
    previous.projectIds.length !== next.projectIds.length ||
    previous.projectIds.some((id, index) => id !== next.projectIds[index])
  );
}

/** A stable key for caching and for cancelling superseded requests. */
export function scopeKey(scope: PmoScope): string {
  return [
    scope.organizationId,
    [...scope.projectIds].sort().join(","),
    scope.dateRange.from ?? "",
    scope.dateRange.to ?? "",
  ].join("|");
}

// ── URL round-trip ─────────────────────────────────────────────────────────
// Only data-affecting fields plus the lens travel in the URL. Node selection
// and hover are session state; putting them in the address bar would rewrite
// history on every click.

const PARAM = {
  projects: "projects",
  from: "from",
  to: "to",
  lens: "lens",
  search: "q",
} as const;

export function scopeToSearchParams(scope: PmoScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.projectIds.length > 0) params.set(PARAM.projects, scope.projectIds.join(","));
  if (scope.dateRange.from) params.set(PARAM.from, scope.dateRange.from);
  if (scope.dateRange.to) params.set(PARAM.to, scope.dateRange.to);
  if (scope.activeLens !== "overview") params.set(PARAM.lens, scope.activeLens);
  if (scope.search) params.set(PARAM.search, scope.search);
  return params;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape is not enough: "2026-13-45" matches the pattern and is not a date.
 * Round-tripping through Date catches month 13 and day 45, both of which
 * Postgres would reject at query time rather than at the boundary.
 */
function isValidIsoDate(value: string | null): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function scopeFromSearchParams(
  organizationId: string,
  params: URLSearchParams | Record<string, string | undefined>,
): PmoScope {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    return params[key] ?? null;
  };

  const rawLens = get(PARAM.lens);
  const lens = PMO_LENSES.includes(rawLens as PmoLens) ? (rawLens as PmoLens) : "overview";

  // A malformed date is dropped rather than passed to the database, where it
  // would either throw or silently match nothing.
  const from = get(PARAM.from);
  const to = get(PARAM.to);

  const projects = get(PARAM.projects);

  return {
    organizationId,
    projectIds: projects ? projects.split(",").filter(Boolean) : [],
    dateRange: {
      from: isValidIsoDate(from) ? from : null,
      to: isValidIsoDate(to) ? to : null,
    },
    activeLens: lens,
    nodeKinds: [],
    edgeTypes: [],
    search: get(PARAM.search) ?? "",
  };
}

/**
 * Drop selections that the new scope no longer contains.
 *
 * Narrowing to one project must not leave a node selected from another —
 * the side panel would keep describing something the user can no longer see.
 */
export function retainValidSelection(
  selectedNodeIds: readonly string[],
  visibleNodeIds: ReadonlySet<string>,
): string[] {
  return selectedNodeIds.filter((id) => visibleNodeIds.has(id));
}
