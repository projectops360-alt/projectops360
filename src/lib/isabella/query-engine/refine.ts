// ============================================================================
// ProjectOps360° — Isabella Query Engine · follow-up report refinement
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// "ahora uno con las tareas que no tengan milestone" / "ese mismo reporte pero
// agrupado por milestone". A follow-up preserves the prior report's entity +
// columns (+ sort/group unless overridden) and applies the new refinement.
// Pure. Falls back gracefully when there is no prior context.
// ============================================================================

import { parseProjectDataQuery, parseRefinementOps, type ParseOptions } from "./parser";
import type { IsabellaProjectQueryPlan } from "./query-plan";

const RE_FOLLOWUP = /\bahora\b|ese\s+mismo|ese\s+pero|\bese\b\s+reporte|solo\s+las?\s+que|solo\s+las?\b|ahora\s+filtrad|con\s+las?\s+que|pero\s+sin\b|pero\s+con\b|only\s+those|same\s+report|filter\s+by|but\s+(only|without|with)|ese\s+pero/;

/** Does this message read as a refinement of the previous report? */
export function isFollowUpRefinement(text: string): boolean {
  return RE_FOLLOWUP.test((text ?? "").toLowerCase());
}

/**
 * Produce a refined plan from the previous report + a follow-up message. The new
 * message is parsed forcing the PRIOR entity; its filters REPLACE the prior ones
 * when present (a follow-up narrows the same report), while entity, columns, and
 * sort/group are inherited unless the follow-up overrides them. When there is no
 * prior plan, falls back to standalone parsing (never fails for lack of context).
 */
export function refineQueryPlan(
  prev: IsabellaProjectQueryPlan | null,
  followUpText: string,
  opts: ParseOptions,
): IsabellaProjectQueryPlan | null {
  const standalone = parseProjectDataQuery(followUpText, opts);

  if (!prev) return standalone; // no context → best-effort standalone

  // If the follow-up restated a full request for a DIFFERENT entity, prefer it.
  if (standalone && !standalone.requiresClarification && standalone.entity !== prev.entity) {
    return standalone;
  }

  // Inherit the prior report; apply the follow-up's ops (parsed WITHOUT the
  // entity gate, since a refinement often has no entity of its own).
  const ops = parseRefinementOps(followUpText);
  const refined: IsabellaProjectQueryPlan = {
    ...prev,
    requiresClarification: false,
    clarificationQuestion: null,
  };
  if (ops.filters.length > 0) refined.filters = ops.filters; // narrow the same report
  if (ops.sort.length > 0 && explicitlyDifferentSort(ops.sort[0], prev.sort[0])) refined.sort = ops.sort;
  if (ops.groupBy) {
    refined.groupBy = ops.groupBy;
    refined.aggregation = ops.aggregation;
  }
  return refined;
}

/** The follow-up specified a sort distinct from just inheriting the prior. */
function explicitlyDifferentSort(
  p: IsabellaProjectQueryPlan["sort"][number] | undefined,
  q: IsabellaProjectQueryPlan["sort"][number] | undefined,
): boolean {
  if (!p) return false;
  if (!q) return true;
  return p.field !== q.field || p.direction !== q.direction;
}
