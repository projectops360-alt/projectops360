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

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRiskEventCaptureEnabled } from "./risk-capture-flag";
import {
  emitProjectEventSafe,
  prepareAtomicEvent,
  type EmitEventInput,
  type EventObjectRef,
} from "./ingestion";
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
  /** The transition recorded on the event (BLOCKER 3: the RPC also enforces this
   *  as a precondition against the live row BEFORE mutating). */
  fromState: string;
  toState: string;
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
    fromState: p.fromState,
    toState: p.toState,
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

// ── Atomic capture (P2-T2 remediation; pilot flag ON only) ─────────────────────
// One PostgreSQL transaction per direct capture: the Risk mutation and its
// canonical event + object_refs are written together by a capture_* RPC, so a
// failure can never leave one without the other. Validation + normalization +
// dedup_key + payload serialization stay in TS (prepareAtomicEvent) — the
// contract is NOT duplicated. The fire-and-forget emitRiskEventSafe above is
// retained for the derived response trail (which derives from events already in
// the PEG and needs no Risk mutation).

export interface AtomicCaptureResult {
  ok: boolean;
  eventId?: string;
  deduped?: boolean;
  /** The canonical risk id. For capture_risk_registered this is the EXISTING
   *  risk id on a dedup hit (read from the stored event's subject_id) or the
   *  newly inserted id on the first call — never a per-retry attempt id. */
  riskId?: string;
  error?: string;
  errors?: string[];
}

type RpcReturn = {
  ok?: boolean;
  deduped?: boolean;
  event_id?: string;
  risk_id?: string;
  error?: string;
} | null;

function rpcResult(data: RpcReturn, error?: { message?: string }): AtomicCaptureResult {
  if (error) return { ok: false, error: error.message ?? "rpc_failed" };
  const r = data ?? {};
  if (r.ok === false) return { ok: false, error: r.error ?? "rpc_failed" };
  return { ok: true, eventId: r.event_id, deduped: r.deduped, riskId: r.risk_id };
}

/**
 * Atomic risk_registered: INSERT the risk + append the risk_registered event +
 * object_refs in one transaction. Idempotency (BLOCKER 2): `operationId` is a
 * STABLE identity from the originating workflow (Scribe memory item id, import
 * job+source id, or a command operationId) — it drives the dedup_key so a retry
 * produces the SAME key and the RPC returns the EXISTING event_id + risk_id
 * without inserting another Risk. The risk id is generated here (crypto random
 * uuid) only as the INSERT attempt id; on a dedup hit the RPC returns the real
 * (first) risk id and the attempt id is discarded. `riskFields` is the exact
 * snake_case payload the writer would have passed to .from("risks").insert
 * (without `id`); the RPC applies the DDL defaults the writer omits, so the
 * resulting row is structurally identical to the flag-OFF path.
 */
export async function captureRiskRegisteredAtomic(params: {
  riskFields: Record<string, unknown>;
  actor: RiskEventActor;
  captureMethod: CaptureMethod;
  origin: string;
  sourceModule: string;
  title?: string;
  evidenceRef?: { type: string; id: string } | null;
  extraProvenance?: Record<string, unknown>;
  /** Stable operation id (required). MUST come from a persisted, retry-stable
   *  source — never a fresh timestamp or a per-retry uuid. */
  operationId: string;
}): Promise<AtomicCaptureResult> {
  // Defense in depth: the capture flag OFF is a strict no-op by construction,
  // regardless of which writer calls this (flag OFF ⇒ byte-identical to pre-P2-T2).
  if (!isRiskEventCaptureEnabled(String(params.riskFields.project_id))) {
    return { ok: false, error: "flag_off" };
  }
  const attemptRiskId = randomUUID();
  const risk: RiskRefInput = {
    riskId: attemptRiskId,
    organizationId: String(params.riskFields.organization_id),
    projectId: String(params.riskFields.project_id),
    linkedMilestoneId: (params.riskFields.linked_milestone_id as string | null | undefined) ?? null,
    linkedTaskId: (params.riskFields.linked_task_id as string | null | undefined) ?? null,
  };
  // P2-T2 BLOCKER 3 — the fingerprint of a risk_registered represents the LOGICAL
  // Risk the writer intends to create + its source item, NOT the per-attempt
  // attemptRiskId nor the new memoryItemId. Pick the stable risk fields only
  // (exclude id / organization_id / project_id — already in the base fingerprint
  // — and evidence_json / metadata, which may carry per-attempt memory item ids).
  const idempotencyRiskLogicalFields: Record<string, unknown> = {
    title: params.riskFields.title,
    description: params.riskFields.description,
    category: params.riskFields.category,
    probability: params.riskFields.probability,
    impact: params.riskFields.impact,
    severity: params.riskFields.severity,
    status: params.riskFields.status,
    origin: params.riskFields.origin,
    mitigation_plan: params.riskFields.mitigation_plan,
    linked_task_id: params.riskFields.linked_task_id,
    linked_milestone_id: params.riskFields.linked_milestone_id,
    confidence_score: params.riskFields.confidence_score,
    needs_review: params.riskFields.needs_review,
  };
  const input: EmitEventInput = {
    ...buildRiskRegistered({
      risk,
      actor: params.actor,
      captureMethod: params.captureMethod,
      origin: params.origin,
      sourceModule: params.sourceModule,
      title: params.title,
      evidenceRef: params.evidenceRef,
      extraProvenance: params.extraProvenance,
    }),
    idempotencyKey: params.operationId,
    idempotencyRiskLogicalFields,
  };
  const prepared = prepareAtomicEvent(input);
  if (!prepared.ok) return { ok: false, error: "validation_failed", errors: prepared.errors };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("capture_risk_registered", {
    p_risk: { ...params.riskFields, id: attemptRiskId },
    p_event: prepared.data.event,
    p_payload_text: prepared.data.payloadText,
    p_refs: prepared.data.refs,
  });
  const out = rpcResult(data as RpcReturn, error ?? undefined);
  // The RPC returns the canonical risk_id (existing on dedup, new on insert).
  // Fall back to the attempt id only if the RPC omits it (defensive).
  return out.ok ? { ...out, riskId: out.riskId ?? attemptRiskId } : out;
}

/**
 * Atomic risk status transition (risk_reopened → status 'open'). UPDATEs the
 * risk row + appends the event + object_refs in one transaction. The event
 * input is built upstream with the real risk id (it exists) and, for reopen,
 * the pre-read prior closure event id as causation. risk_closed is NOT wired
 * here (no RI-05 validation gate on the closeout bulk-resolve path).
 *
 * BLOCKER 3: `operationId` (stable, retry-safe) drives the dedup_key so a retry
 * returns deduped WITHOUT re-mutating the risk or bumping updated_at. The RPC
 * checks dedup BEFORE the UPDATE. `expectedFromStatus` is a precondition the
 * RPC enforces against the live row — a stale request (the risk has since moved
 * to another state) is rejected WITHOUT any mutation or event.
 */
export async function captureRiskStatusChangeAtomic(params: {
  riskId: string;
  newStatus: string;
  /** Precondition: the live risk status MUST equal this for the transition to
   *  apply. Rejects stale requests without mutation. */
  expectedFromStatus: string;
  organizationId: string;
  projectId: string;
  input: EmitEventInput;
  /** Stable operation id (required, retry-safe). */
  operationId: string;
}): Promise<AtomicCaptureResult> {
  if (!isRiskEventCaptureEnabled(params.projectId)) return { ok: false, error: "flag_off" };
  const input: EmitEventInput = { ...params.input, idempotencyKey: params.operationId };
  const prepared = prepareAtomicEvent(input);
  if (!prepared.ok) return { ok: false, error: "validation_failed", errors: prepared.errors };
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("capture_risk_status_change", {
    p_risk_id: params.riskId,
    p_new_status: params.newStatus,
    p_expected_from_status: params.expectedFromStatus,
    p_organization_id: params.organizationId,
    p_project_id: params.projectId,
    p_event: prepared.data.event,
    p_payload_text: prepared.data.payloadText,
    p_refs: prepared.data.refs,
  });
  return rpcResult(data as RpcReturn, error ?? undefined);
}

/**
 * Atomic append-only risk event with no Risk mutation (risk_assessed,
 * risk_materialized). The operation IS the event; atomicity = a single atomic
 * append via the RPC.
 *
 * BLOCKER 2: `operationId` is REQUIRED for direct capture events. It is a stable
 * identity for the user's intent, generated ONCE by the client and reused across
 * retries of the same request, so a retry dedupes to the first event (no second
 * risk_assessed / risk_materialized). It MUST NOT be derived from `new Date()`,
 * the method, scope, impact note, or any semantic value. A later, legitimate
 * assessment/materialization uses a DIFFERENT operationId (new client command).
 */
export async function captureRiskEventAtomic(params: {
  input: EmitEventInput;
  /** Stable operation id (required for direct events). Generated by the client
   *  once per command and reused on retries. Drives the dedup_key so a retry
   *  dedupes; a new command gets a new key and is allowed. */
  operationId: string;
}): Promise<AtomicCaptureResult> {
  if (!isRiskEventCaptureEnabled(params.input.projectId)) return { ok: false, error: "flag_off" };
  if (!params.operationId?.trim()) return { ok: false, error: "validation_failed", errors: ["operationId required"] };
  const input: EmitEventInput = { ...params.input, idempotencyKey: params.operationId };
  const prepared = prepareAtomicEvent(input);
  if (!prepared.ok) return { ok: false, error: "validation_failed", errors: prepared.errors };
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("append_risk_event_atomic", {
    p_event: prepared.data.event,
    p_payload_text: prepared.data.payloadText,
    p_refs: prepared.data.refs,
  });
  return rpcResult(data as RpcReturn, error ?? undefined);
}
