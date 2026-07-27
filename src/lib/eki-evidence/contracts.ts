import { z } from "zod";
import {
  CONTROL_STATES,
  EVIDENCE_OUTCOMES,
  EVIDENCE_RESOLVERS,
  FINDING_CONDITIONS,
  FINDING_RESOLUTIONS,
  type ControlState,
  type EvidenceOutcome,
  type FindingCondition,
} from "./types";

/** Postgres interval literals this layer accepts. Closed, so no free text reaches SQL. */
const intervalSchema = z
  .string()
  .trim()
  .regex(/^\d+ (microseconds?|milliseconds?|seconds?|minutes?|hours?|days?|weeks?)$/, "invalid_interval");

export const createEvidenceBindingSchema = z
  .object({
    bindingObjectId: z.string().uuid(),
    resolverKey: z.enum(EVIDENCE_RESOLVERS),
    freshnessInterval: intervalSchema,
    warningInterval: intervalSchema,
  })
  .strict();

/**
 * Evaluation cadence.
 *
 * Bounded vocabulary, like the freshness interval. A cadence in seconds turns
 * the scheduler into a spin loop measuring the same instant repeatedly, and free
 * text here would reach SQL.
 */
export const bindingScheduleSchema = z
  .object({
    evaluationInterval: z
      .string()
      .trim()
      .regex(/^\d+ (minutes?|hours?|days?|weeks?)$/, "invalid_evaluation_interval"),
    enabled: z.boolean().optional(),
  })
  .strict();

export const resolveFindingSchema = z
  .object({
    findingObjectId: z.string().uuid(),
    resolution: z.enum(FINDING_RESOLUTIONS),
    // A resolution without a reason is a closure nobody can review.
    rationale: z.string().trim().min(3).max(4000),
    evidenceRef: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const assignOwnerSchema = z
  .object({
    objectId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    rationale: z.string().trim().min(3).max(4000),
  })
  .strict();

/**
 * Outcomes that count as passing evidence.
 *
 * Everything else — including `unavailable` and `invalid` — fails. The engine
 * fails closed: an error, an unreachable source or an ambiguous result must
 * never be read as passing.
 */
const PASSING_OUTCOMES: ReadonlySet<EvidenceOutcome> = new Set(["current", "approaching_stale"]);

export function outcomeIsPassing(outcome: EvidenceOutcome): boolean {
  return PASSING_OUTCOMES.has(outcome);
}

/**
 * The finding condition an outcome raises, or null when the outcome is passing.
 *
 * `evidence_missing` and `evidence_stale` are both reached from a `stale`
 * outcome and separated by whether any evidence exists at all: a control that
 * has never been evidenced and one whose evidence lapsed need different
 * remediation, and one condition code could not tell an owner which they have.
 */
export function conditionForOutcome(
  outcome: EvidenceOutcome,
  evidenceCount: number,
): FindingCondition | null {
  switch (outcome) {
    case "current":
    case "approaching_stale":
      return null;
    case "stale":
      return evidenceCount === 0 ? "evidence_missing" : "evidence_stale";
    case "unavailable":
      return "evidence_unavailable";
    case "invalid":
      return "evidence_invalid";
    case "contradictory":
      return "evidence_contradictory";
  }
}

/** Severity per condition. Fixed, so severity is never a judgement call at runtime. */
export function severityForCondition(condition: FindingCondition) {
  switch (condition) {
    case "evidence_missing":
    case "evidence_contradictory":
    case "control_lost_operating":
      return "high" as const;
    default:
      return "medium" as const;
  }
}

/**
 * Whether a human may move a control to this state without new evidence.
 *
 * A human may always be MORE conservative. Becoming less conservative requires
 * evidence, because the whole value of `operating` is that it cannot be asserted.
 */
const CONSERVATISM: Record<ControlState, number> = {
  operating: 5,
  degraded: 4,
  implemented: 3,
  designed: 2,
  proposed: 1,
  ineffective: 0,
  retired: 0,
};

export function isMoreConservative(from: ControlState, to: ControlState): boolean {
  return CONSERVATISM[to] < CONSERVATISM[from];
}

export function humanMayTransition(from: ControlState, to: ControlState): boolean {
  return isMoreConservative(from, to);
}

export const EVIDENCE_VOCABULARIES = {
  outcomes: EVIDENCE_OUTCOMES,
  controlStates: CONTROL_STATES,
  conditions: FINDING_CONDITIONS,
} as const;

/**
 * Actions this layer authorizes, and the roles that may perform them.
 *
 * `evaluate` is deliberately open to any member: running an evaluation reads
 * evidence and records what it found, and restricting who may look would let a
 * control stay green because nobody with authority happened to check. Closing a
 * finding and naming an owner are restricted, because both change what the
 * record claims about accountability.
 *
 * The database enforces the same rule independently (`eki_resolve_finding`,
 * `eki_assign_owner`). This copy exists to fail before the round trip, not
 * instead of it — removing the check here must not grant anything.
 */
export type EvidenceAction = "read" | "define_binding" | "evaluate" | "resolve_finding" | "assign_owner";

const actionRoles: Record<EvidenceAction, ReadonlySet<string>> = {
  read: new Set(["owner", "admin", "member", "viewer"]),
  define_binding: new Set(["owner", "admin"]),
  evaluate: new Set(["owner", "admin", "member"]),
  resolve_finding: new Set(["owner", "admin"]),
  assign_owner: new Set(["owner", "admin"]),
};

export function authorizeEvidenceAction(role: string, action: EvidenceAction): boolean {
  return actionRoles[action].has(role);
}
