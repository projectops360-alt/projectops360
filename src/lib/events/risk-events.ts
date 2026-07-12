// ============================================================================
// P2-T2 — Risk event emission helpers (PD-018 §B.4; RISK-EVENT-CAPTURE)
// ============================================================================
// The ONLY way risk writers emit canonical risk events. Pure builders
// (unit-tested) + a flag-gated fire-and-forget emitter over the single PEG
// ingestion gateway (one pipeline — CLAUDE.md rule #5). With the pilot flag
// off, emitRiskEventSafe is a strict no-op: current behavior stays
// byte-identical. No risk business-table columns are read or written here —
// the actor travels in the event, not in `risks` (PD-018).
// ============================================================================

import { isRiskEventCaptureEnabled } from "./risk-capture-flag";
import { emitProjectEventSafe, type EmitEventInput, type EventObjectRef } from "./ingestion";
import type { ActorType, CaptureMethod, ClosureReason, DataQualityFlag } from "./registry";

// ── Shared shapes ─────────────────────────────────────────────────────────────

export interface RiskEventActor {
  actorType: ActorType;
  actorId?: string | null;
}

export interface RiskRefInput {
  riskId: string;
  organizationId: string;
  projectId: string;
  linkedMilestoneId?: string | null;
  linkedTaskId?: string | null;
}

function baseObjectRefs(risk: RiskRefInput): EventObjectRef[] {
  const refs: EventObjectRef[] = [
    { objectType: "risk", objectId: risk.riskId, role: "focal" },
    { objectType: "project", objectId: risk.projectId, role: "context" },
  ];
  if (risk.linkedMilestoneId) refs.push({ objectType: "milestone", objectId: risk.linkedMilestoneId, role: "impacted" });
  if (risk.linkedTaskId) refs.push({ objectType: "task", objectId: risk.linkedTaskId, role: "response" });
  return refs;
}

function provenance(
  captureMethod: CaptureMethod,
  flags: DataQualityFlag[],
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    capture_method: captureMethod,
    ...(flags.length > 0 ? { data_quality_flags: flags } : {}),
    ...(extra ?? {}),
  };
}

// ── Pure builders (PD-018 §B.4 direct-capture events) ─────────────────────────

export function buildRiskRegistered(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  captureMethod: CaptureMethod;
  origin: string;
  sourceModule: string;
  title?: string;
  evidenceRef?: { type: string; id: string } | null;
  extraProvenance?: Record<string, unknown>;
}): EmitEventInput {
  const flags: DataQualityFlag[] = [];
  if (p.captureMethod === "imported") flags.push("imported");
  if (!p.actor.actorId && p.actor.actorType !== "system") flags.push("missing_actor");
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: "risk_registered",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    provenance: provenance(p.captureMethod, flags, {
      ...(p.evidenceRef ? { evidenceRefs: [p.evidenceRef] } : {}),
      ...(p.extraProvenance ?? {}),
    }),
    payload: { origin: p.origin, ...(p.title ? { title: p.title } : {}) },
    objectRefs: baseObjectRefs(p.risk),
  };
}

export function buildRiskAssessed(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  sourceModule: string;
  method: string;
  values: { probability: string; impact: string; severity: string };
  assessedAt: string;
}): EmitEventInput {
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: "risk_assessed",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    provenance: provenance("direct", []),
    payload: { method: p.method, values: p.values, assessed_at: p.assessedAt },
    objectRefs: baseObjectRefs(p.risk),
  };
}

export function buildRiskOwnerEvent(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  sourceModule: string;
  newOwner: string;
  previousOwner?: string | null;
}): EmitEventInput {
  const isChange = Boolean(p.previousOwner);
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: isChange ? "risk_owner_changed" : "risk_owner_assigned",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    provenance: provenance("direct", []),
    payload: {
      new_owner: p.newOwner,
      ...(isChange ? { previous_owner: p.previousOwner } : {}),
    },
    objectRefs: [
      ...baseObjectRefs(p.risk),
      { objectType: "actor", objectId: p.newOwner, role: "responsibility" },
    ],
  };
}

export function buildRiskResponsePlanApproved(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  sourceModule: string;
  strategy: string;
  decisionRef?: string | null;
}): EmitEventInput {
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: "risk_response_plan_approved",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    provenance: provenance("direct", []),
    payload: { strategy: p.strategy, ...(p.decisionRef ? { decision_ref: p.decisionRef } : {}) },
    objectRefs: [
      ...baseObjectRefs(p.risk),
      ...(p.decisionRef ? [{ objectType: "decision", objectId: p.decisionRef, role: "control" }] : []),
    ],
  };
}

/**
 * Closure without the full RI-05 workflow (the request→validate steps do not
 * exist in today's flows): always flagged `unvalidated_closure`; the closeout
 * acceptance path additionally carries `bulk_closure` (mapping decision
 * documented in the P2-T2 PR).
 */
export function buildRiskClosed(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  sourceModule: string;
  closureReason: ClosureReason;
  viaCloseout: boolean;
}): EmitEventInput {
  const flags: DataQualityFlag[] = ["unvalidated_closure"];
  if (p.viaCloseout) flags.push("bulk_closure");
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: "risk_closed",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    provenance: provenance("direct", flags),
    payload: { closure_reason: p.closureReason },
    objectRefs: baseObjectRefs(p.risk),
  };
}

export function buildRiskReopened(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  sourceModule: string;
  reasonCode: string;
  priorClosureEventId?: string | null;
}): EmitEventInput {
  const flags: DataQualityFlag[] = p.priorClosureEventId ? [] : ["missing_prior_closure"];
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: "risk_reopened",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    causedBy: p.priorClosureEventId ? [p.priorClosureEventId] : [],
    provenance: provenance("direct", flags),
    payload: {
      reason_code: p.reasonCode,
      ...(p.priorClosureEventId ? { prior_closure_event_id: p.priorClosureEventId } : {}),
    },
    objectRefs: baseObjectRefs(p.risk),
  };
}

/**
 * RI-06 interim exception (recorded in PD-018): no Issue/Blocker entity exists
 * yet (CAP-018), so the payload documents scope + impact instead of linking a
 * materialization target.
 */
export function buildRiskMaterialized(p: {
  risk: RiskRefInput;
  actor: RiskEventActor;
  sourceModule: string;
  materializationScope: "total" | "partial";
  impactNote?: string | null;
}): EmitEventInput {
  return {
    organizationId: p.risk.organizationId,
    projectId: p.risk.projectId,
    eventType: "risk_materialized",
    subjectId: p.risk.riskId,
    actorType: p.actor.actorType,
    actorId: p.actor.actorId ?? null,
    sourceModule: p.sourceModule,
    sourceEntityType: "risks",
    sourceEntityId: p.risk.riskId,
    provenance: provenance("direct", [], { ri06_interim_exception: true }),
    payload: {
      materialization_scope: p.materializationScope,
      ...(p.impactNote ? { impact: { note: p.impactNote } } : {}),
    },
    objectRefs: baseObjectRefs(p.risk),
  };
}

// ── Flag-gated emitter ────────────────────────────────────────────────────────

/**
 * Emit a risk event iff the pilot flag is on for the project. Fire-and-forget:
 * never throws, never blocks or alters the caller's behavior (flag OFF ⇒
 * strict no-op).
 */
export function emitRiskEventSafe(input: EmitEventInput): void {
  try {
    if (!isRiskEventCaptureEnabled(input.projectId)) return;
    emitProjectEventSafe(input);
  } catch (err) {
    console.error("[events] emitRiskEventSafe error:", err);
  }
}
