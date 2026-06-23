// ============================================================================
// ProjectOps360° — Work Item readiness (pure function)
// ============================================================================
// Adapts to the project's refinement template. The Definition of Ready (from
// the template, materialized on the item) is the backbone; we blend it with the
// presence of the universal refinement signals (criteria, estimate, owner,
// priority, risk reviewed, dependencies resolved). Score 0–100 maps to a band.
//
// Pure over already-fetched data — the server action persists the score, the
// client recomputes it live for instant feedback. Mirrors the style of
// src/lib/execution/readiness.ts.
// ============================================================================

import type { RefinementTemplate } from "./templates";
import { bandForScore, type ReadinessBand } from "./templates";

export interface ReadinessCheck {
  key: string;
  es: string;
  en: string;
  ok: boolean;
  /** "dor" = template Definition of Ready item; "signal" = universal signal. */
  group: "dor" | "signal";
}

export interface ReadinessResult {
  score: number; // 0–100
  band: ReadinessBand;
  checks: ReadinessCheck[];
  missing: ReadinessCheck[];
}

/** The shape we read off a backlog/work item row (loose — DB rows are untyped). */
export interface WorkItemLike {
  description?: string | null;
  acceptance_criteria?: string | null;
  completion_criteria?: string | null;
  definition_of_ready?: unknown; // [{key,label,checked}]
  estimation_method?: string | null;
  estimate_value?: number | string | null;
  estimate_unit?: string | null;
  estimate_optimistic?: number | string | null;
  estimate_most_likely?: number | string | null;
  estimate_pessimistic?: number | string | null;
  owner_id?: string | null;
  priority?: string | null;
  risk_level?: string | null;
  business_value?: number | string | null;
}

interface DorEntry { key?: string; label?: string; checked?: boolean }

const has = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
};

/** True if the item carries an estimate under its chosen method. Discrete
 *  scales (t-shirt) and cost ranges store the value in estimate_unit; numeric
 *  methods (story points, hours, days, crew-hours) use estimate_value. */
function hasEstimate(item: WorkItemLike): boolean {
  if (item.estimation_method === "three_point") {
    return has(item.estimate_most_likely) || (has(item.estimate_optimistic) && has(item.estimate_pessimistic));
  }
  return has(item.estimate_value) || has(item.estimate_unit);
}

/**
 * Compute readiness for a work item against its refinement template.
 *
 * @param item            the work item row
 * @param template        the resolved refinement template (drives DoR)
 * @param unresolvedDeps  count of dependencies that are NOT yet resolved
 *                        (i.e. predecessor items still open). 0 = none blocking.
 */
export function computeReadiness(
  item: WorkItemLike,
  template: RefinementTemplate,
  unresolvedDeps = 0,
): ReadinessResult {
  const checks: ReadinessCheck[] = [];

  // 1. Definition of Ready items (from the template, materialized on the item).
  const dor = Array.isArray(item.definition_of_ready) ? (item.definition_of_ready as DorEntry[]) : [];
  const dorByKey = new Map(dor.map((d) => [String(d.key ?? ""), !!d.checked]));
  for (const d of template.definitionOfReady) {
    checks.push({
      key: `dor:${d.key}`,
      es: d.es,
      en: d.en,
      ok: dorByKey.get(d.key) ?? false,
      group: "dor",
    });
  }

  // 2. Universal refinement signals (apply to every template).
  const signals: ReadinessCheck[] = [
    { key: "sig:desc", es: "Descripción presente", en: "Description present", ok: has(item.description), group: "signal" },
    { key: "sig:criteria", es: "Criterios de aceptación/terminación", en: "Acceptance/completion criteria", ok: has(item.acceptance_criteria) || has(item.completion_criteria), group: "signal" },
    { key: "sig:estimate", es: "Estimación completada", en: "Estimate completed", ok: hasEstimate(item), group: "signal" },
    { key: "sig:owner", es: "Owner asignado", en: "Owner assigned", ok: has(item.owner_id), group: "signal" },
    { key: "sig:priority", es: "Prioridad asignada", en: "Priority assigned", ok: has(item.priority), group: "signal" },
    { key: "sig:risk", es: "Riesgo revisado", en: "Risk reviewed", ok: has(item.risk_level), group: "signal" },
    { key: "sig:deps", es: "Dependencias resueltas", en: "Dependencies resolved", ok: unresolvedDeps === 0, group: "signal" },
  ];
  checks.push(...signals);

  // 3. Weighted score: DoR is 60% of the score, universal signals are 40%.
  //    Empty DoR (no template items) collapses everything onto the signals.
  const dorChecks = checks.filter((c) => c.group === "dor");
  const sigChecks = checks.filter((c) => c.group === "signal");
  const dorOk = dorChecks.filter((c) => c.ok).length;
  const sigOk = sigChecks.filter((c) => c.ok).length;

  const dorPct = dorChecks.length > 0 ? dorOk / dorChecks.length : null;
  const sigPct = sigChecks.length > 0 ? sigOk / sigChecks.length : 0;

  const blended = dorPct === null ? sigPct : dorPct * 0.6 + sigPct * 0.4;
  const score = Math.round(blended * 100);

  return {
    score,
    band: bandForScore(score),
    checks,
    missing: checks.filter((c) => !c.ok),
  };
}
