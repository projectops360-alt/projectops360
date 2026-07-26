// ============================================================================
// PMO Intelligence Center — KPI click outcome (CAP-048 Phase 2)
// ============================================================================
// What a KPI click actually DID, in words the user can read.
//
// `kpiIntent` says what should happen. It cannot say whether it worked: an
// intent that selects "every project whose health is at_risk" produces an empty
// selection when the graph carries no health on its project nodes, and the
// screen then does nothing at all. A control that does nothing is indistinguish-
// able from a broken one, and this dashboard's whole premise is that clicking a
// number takes you to the thing it counts.
//
// So every click resolves to one of three outcomes, and the two that are not
// "it worked" are stated on screen rather than swallowed:
//
//   applied   — nodes were selected and the camera moved.
//   lens-only — no nodes to select, but the lens changed (budget variance is
//               the honest case: it is a portfolio figure, not a place).
//   empty     — nothing resolved. Said out loud, with the reason.
//
// Pure so the message can be tested, and so the shell never grows a private
// notion of "did that work".
// ============================================================================

import type { KpiIntent, PmoKpiKey } from "./kpi-bindings";

export type KpiOutcomeKind = "applied" | "lens-only" | "empty";

export interface KpiOutcome {
  kind: KpiOutcomeKind;
  /** i18n key under `pmoIntelligence`, resolved by the component. */
  messageKey: string;
  /** Number of nodes the click selected. */
  selectedCount: number;
}

/**
 * KPIs that legitimately select nothing.
 *
 * These are portfolio-wide figures, not locations on the graph. Reporting them
 * as "nothing found" would be wrong — they found what they measure, it just is
 * not a set of nodes. Keeping the list explicit is what stops a genuinely
 * broken binding from hiding behind a friendly message.
 */
const NON_SPATIAL_KPIS: ReadonlySet<PmoKpiKey> = new Set<PmoKpiKey>([
  "portfolioHealth",
  "budgetVariance",
]);

/**
 * Classify what a KPI click achieved.
 *
 * `intent` is what was asked for; this reports what the screen can honour.
 */
export function kpiOutcome(key: PmoKpiKey, intent: KpiIntent): KpiOutcome {
  const selectedCount = intent.selectNodeIds.length;

  if (selectedCount > 0) {
    return {
      kind: "applied",
      messageKey: intent.focus ? "kpiOutcomeFocused" : "kpiOutcomeSelected",
      selectedCount,
    };
  }

  // A panel opening is a visible effect even with nothing selected.
  if (intent.openPanel != null) {
    return { kind: "lens-only", messageKey: "kpiOutcomePanel", selectedCount: 0 };
  }

  if (NON_SPATIAL_KPIS.has(key)) {
    return { kind: "lens-only", messageKey: "kpiOutcomeLensOnly", selectedCount: 0 };
  }

  if (intent.lens != null) {
    // The lens moved but the KPI counts things that should have been on the
    // canvas. Worth distinguishing: the user sees a change AND is told the
    // selection came back empty.
    return { kind: "empty", messageKey: "kpiOutcomeLensNoNodes", selectedCount: 0 };
  }

  return { kind: "empty", messageKey: "kpiOutcomeNothing", selectedCount: 0 };
}
