import type {
  ControlState,
  EvidenceOutcome,
  FindingCondition,
} from "@/lib/eki-evidence/types";
import type {
  InstantiatedControl,
  NormativeStatement,
  ObservedControlState,
  ObservedEvaluation,
  ObservedFinding,
  TrustAuditReference,
  TrustContext,
  TrustControlView,
  TrustRelation,
} from "./types";

/**
 * Pure assembly of the Enterprise Trust context.
 *
 * Everything here is a function of rows already read. No queries, no clock, no
 * randomness — so the same rows always produce the same context and every claim
 * downstream can be reproduced from the record it came from.
 */

/** Ordering used everywhere a control list is presented. */
const STATE_URGENCY: Record<ControlState, number> = {
  ineffective: 0,
  degraded: 1,
  proposed: 2,
  designed: 3,
  implemented: 4,
  operating: 5,
  retired: 6,
};

const CONDITION_URGENCY: Record<FindingCondition, number> = {
  evidence_contradictory: 0,
  control_lost_operating: 1,
  evidence_missing: 2,
  evidence_unavailable: 3,
  evidence_invalid: 4,
  evidence_stale: 5,
};

/**
 * Align the three layers for one control.
 *
 * The layers stay labelled in the output. Collapsing them would let "we have a
 * control for that" answer "does the evidence hold?", which is the failure this
 * whole programme exists to prevent.
 */
export function buildControlView(
  control: InstantiatedControl,
  observed: ObservedControlState | undefined,
  relations: TrustRelation[],
  normative: NormativeStatement[],
  audit: TrustAuditReference[],
  ownerNames: ReadonlyMap<string, string> = new Map(),
): TrustControlView {
  const touching = relations.filter(
    (r) => r.sourceObjectId === control.controlObjectId || r.targetObjectId === control.controlObjectId,
  );
  return {
    controlObjectId: control.controlObjectId,
    title: control.title,
    ownerUserId: control.ownerUserId,
    ownerName: control.ownerUserId ? ownerNames.get(control.ownerUserId) ?? control.ownerName : null,
    knowledgeStatus: control.knowledgeStatus,
    // Null, never a default. A control with no runtime row has never been
    // measured, and "never measured" is not "implemented".
    controlState: observed?.controlState ?? null,
    gateReasons: observed?.gateReasons ?? [],
    bindings: control.bindings,
    latestEvaluations: latestPerBinding(observed?.evaluations ?? []),
    openFindings: [...(observed?.findings ?? [])].sort(
      (a, b) => CONDITION_URGENCY[a.conditionCode] - CONDITION_URGENCY[b.conditionCode],
    ),
    supportingRelations: touching.filter((r) => !r.contradictory),
    contradictoryRelations: touching.filter((r) => r.contradictory),
    normativeRequirements: normative.filter((n) => n.satisfiedByControlIds.includes(control.controlObjectId)),
    auditReferences: audit,
  };
}

/**
 * The latest evaluation for each binding, resolved by sequence number.
 *
 * Never by timestamp: `now()` is the transaction clock, two evaluations written
 * in one transaction share it, and picking by time then returns an arbitrary one
 * of the two (REG-029).
 */
export function latestPerBinding(evaluations: readonly ObservedEvaluation[]): ObservedEvaluation[] {
  const best = new Map<string, ObservedEvaluation>();
  for (const evaluation of evaluations) {
    const current = best.get(evaluation.bindingObjectId);
    if (!current || evaluation.sequenceNo > current.sequenceNo) best.set(evaluation.bindingObjectId, evaluation);
  }
  return [...best.values()].sort((a, b) => b.sequenceNo - a.sequenceNo);
}

/** Controls ordered by how much attention they need. Worst first. */
export function orderByUrgency(views: readonly TrustControlView[]): TrustControlView[] {
  return [...views].sort((a, b) => {
    const aState = a.controlState ? STATE_URGENCY[a.controlState] : 2.5;
    const bState = b.controlState ? STATE_URGENCY[b.controlState] : 2.5;
    if (aState !== bState) return aState - bState;
    if (a.openFindings.length !== b.openFindings.length) return b.openFindings.length - a.openFindings.length;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Remediation ranking.
 *
 * Deterministic and explainable — every position is justified by a stated
 * reason, because a priority list nobody can question is an instruction, and
 * this system may only advise.
 */
export interface RemediationCandidate {
  controlObjectId: string;
  title: string;
  rank: number;
  reasons: string[];
  ownerUserId: string | null;
  blocking: boolean;
}

export function rankRemediation(views: readonly TrustControlView[]): RemediationCandidate[] {
  const candidates = views
    .filter((v) => v.controlState !== "operating" || v.openFindings.length > 0)
    .map((view) => {
      const reasons: string[] = [];
      if (view.contradictoryRelations.some((r) => r.resolutionStatus === "unresolved")) {
        reasons.push("unresolved_contradiction");
      }
      if (view.controlState === "degraded") reasons.push("lost_operating");
      if (view.controlState === "ineffective") reasons.push("declared_ineffective");
      if (!view.ownerUserId) reasons.push("owner_not_assigned");
      if (view.bindings.length === 0) reasons.push("no_evidence_binding");
      if (view.openFindings.some((f) => f.conditionCode === "evidence_missing")) reasons.push("never_evidenced");
      if (view.openFindings.some((f) => f.conditionCode === "evidence_stale")) reasons.push("evidence_lapsed");
      if (view.latestEvaluations.some((e) => e.outcome === "unavailable")) reasons.push("source_unreadable");
      if (view.openFindings.some((f) => f.occurrenceCount > 3)) reasons.push("recurring");
      return { view, reasons };
    })
    // A control nobody could explain a reason for is not ranked at all, rather
    // than ranked last: an unexplained entry on a remediation list gets actioned
    // anyway and nobody can say why.
    .filter((c) => c.reasons.length > 0)
    .sort((a, b) => {
      if (a.reasons.length !== b.reasons.length) return b.reasons.length - a.reasons.length;
      const aState = a.view.controlState ? STATE_URGENCY[a.view.controlState] : 2.5;
      const bState = b.view.controlState ? STATE_URGENCY[b.view.controlState] : 2.5;
      if (aState !== bState) return aState - bState;
      return a.view.title.localeCompare(b.view.title);
    });

  return candidates.map(({ view, reasons }, index) => ({
    controlObjectId: view.controlObjectId,
    title: view.title,
    rank: index + 1,
    reasons,
    ownerUserId: view.ownerUserId,
    blocking: reasons.includes("unresolved_contradiction") || reasons.includes("never_evidenced"),
  }));
}

/**
 * What changed between two observed snapshots of the same organization.
 *
 * Compared by control identity and sequence, so a re-read that returns the same
 * rows produces no changes at all — "nothing changed" has to be a real answer,
 * not the absence of one.
 */
export interface TrustChange {
  controlObjectId: string;
  kind: "control_state" | "evidence_outcome" | "finding_opened" | "finding_closed";
  from: string | null;
  to: string | null;
  detail?: string;
}

export function diffObserved(
  previous: readonly ObservedControlState[],
  next: readonly ObservedControlState[],
): TrustChange[] {
  const changes: TrustChange[] = [];
  const before = new Map(previous.map((o) => [o.controlObjectId, o]));

  for (const now of next) {
    const then = before.get(now.controlObjectId);
    if (!then) continue;

    if (then.controlState !== now.controlState) {
      changes.push({
        controlObjectId: now.controlObjectId,
        kind: "control_state",
        from: then.controlState,
        to: now.controlState,
      });
    }

    const thenOutcomes = outcomeByBinding(then.evaluations);
    const nowOutcomes = outcomeByBinding(now.evaluations);
    for (const [bindingId, outcome] of nowOutcomes) {
      const previousOutcome = thenOutcomes.get(bindingId);
      if (previousOutcome && previousOutcome !== outcome) {
        changes.push({
          controlObjectId: now.controlObjectId,
          kind: "evidence_outcome",
          from: previousOutcome,
          to: outcome,
          detail: bindingId,
        });
      }
    }

    const thenFindings = new Set(then.findings.map((f) => f.conditionCode));
    const nowFindings = new Set(now.findings.map((f) => f.conditionCode));
    for (const condition of nowFindings) {
      if (!thenFindings.has(condition)) {
        changes.push({ controlObjectId: now.controlObjectId, kind: "finding_opened", from: null, to: condition });
      }
    }
    for (const condition of thenFindings) {
      if (!nowFindings.has(condition)) {
        changes.push({ controlObjectId: now.controlObjectId, kind: "finding_closed", from: condition, to: null });
      }
    }
  }
  return changes;
}

function outcomeByBinding(evaluations: readonly ObservedEvaluation[]): Map<string, EvidenceOutcome> {
  const map = new Map<string, EvidenceOutcome>();
  for (const evaluation of latestPerBinding(evaluations)) map.set(evaluation.bindingObjectId, evaluation.outcome);
  return map;
}

/** Summary counts. Counts only — no score, no percentage, no readiness figure. */
export interface TrustSummary {
  total: number;
  byState: Record<ControlState, number>;
  openFindings: number;
  contradictions: number;
  approachingStale: number;
  neverMeasured: number;
}

export function summarize(views: readonly TrustControlView[]): TrustSummary {
  const byState = {
    proposed: 0, designed: 0, implemented: 0, operating: 0, degraded: 0, ineffective: 0, retired: 0,
  } as Record<ControlState, number>;
  let openFindings = 0;
  let contradictions = 0;
  let approachingStale = 0;
  let neverMeasured = 0;

  for (const view of views) {
    if (view.controlState) byState[view.controlState] += 1;
    else neverMeasured += 1;
    openFindings += view.openFindings.length;
    contradictions += view.contradictoryRelations.filter((r) => r.resolutionStatus === "unresolved").length;
    if (view.latestEvaluations.some((e) => e.outcome === "approaching_stale")) approachingStale += 1;
  }
  return { total: views.length, byState, openFindings, contradictions, approachingStale, neverMeasured };
}

export function emptyContext(organizationId: string, assembledAt: string): TrustContext {
  return {
    organizationId,
    assembledAt,
    normative: [],
    instantiated: [],
    observed: [],
    relations: [],
    auditReferences: [],
    unavailableLayers: [],
  };
}

export function toControlViews(context: TrustContext, ownerNames?: ReadonlyMap<string, string>): TrustControlView[] {
  const observedById = new Map(context.observed.map((o) => [o.controlObjectId, o]));
  return orderByUrgency(
    context.instantiated.map((control) =>
      buildControlView(
        control,
        observedById.get(control.controlObjectId),
        context.relations,
        context.normative,
        context.auditReferences.filter((a) =>
          a.reasonCodes.some((code) => code === control.controlObjectId) ||
          a.eventId === control.controlObjectId,
        ),
        ownerNames,
      ),
    ),
  );
}

export type { ObservedFinding };
