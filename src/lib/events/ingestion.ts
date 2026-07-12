// ============================================================================
// ProjectOps360° — Event Ingestion Service (Phase 2)
// ============================================================================
// The single controlled, server-side gateway for writing canonical project
// events into project_event_log. No module writes to the table directly. Every
// event is validated against the Canonical Event Taxonomy registry before it is
// written. Append-only, idempotent, tamper-evident. Additive: does NOT touch
// process_nodes / process_edges. See the Product Constitution §4.
// ============================================================================

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEventDef,
  isRegisteredEvent,
  isEphemeralExcluded,
  isPastTenseName,
  requiresEvidence,
  DEPRECATED_EVENT_TYPES,
  VALID_ACTOR_TYPES,
  VALID_VISIBILITY,
  VALID_IMPORTANCE,
  type ActorType,
  type EventImportance,
  type EventLifecycleClass,
} from "./registry";

/** PD-018 §A.1 row 9 — one event may reference multiple objects with roles
 *  (OCEL-style). Persisted to project_event_objects; the envelope subject
 *  remains the PRIMARY object. */
export interface EventObjectRef {
  objectType: string;
  objectId: string;
  role: string;
}

/** Task events that feed the derived risk response trail (PD-018 §B.4). */
const DERIVABLE_TASK_EVENT_TYPES: ReadonlySet<string> = new Set([
  "TaskCreated", "TaskStatusChanged", "TaskCompleted",
]);

const VALID_LIFECYCLE_CLASSES: ReadonlySet<string> = new Set([
  "BUSINESS_EVENT", "SYSTEM_EVENT", "AI_EVENT",
  "DERIVED_EVENT", "EXTERNAL_EVENT", "SYNTHETIC_BACKFILL_EVENT",
]);

// ── Input ────────────────────────────────────────────────────────────────────

export interface EmitEventInput {
  organizationId: string;
  projectId: string;
  eventType: string;
  subjectId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  occurredAt?: string; // ISO; defaults to now
  sourceModule: string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  fromState?: string | null;
  toState?: string | null;
  causedBy?: string[];
  correlationId?: string | null;
  sagaId?: string | null;
  caseId?: string | null; // defaults to projectId
  portfolioId?: string | null;
  provenance?: Record<string, unknown>;
  confidence?: number | null;
  impact?: Partial<Record<"schedule" | "cost" | "quality" | "risk" | "scope", string>>;
  payload?: Record<string, unknown>;
  visibility?: string;
  permissionScope?: Record<string, unknown>;
  /** Authorized importance override — recorded in provenance.importanceOverride. */
  importanceOverride?: EventImportance;
  /** Lifecycle-class override (e.g. SYNTHETIC_BACKFILL_EVENT for the Backfill Service). */
  lifecycleClassOverride?: EventLifecycleClass;
  isCompensatingEvent?: boolean;
  compensatesEventId?: string | null;
  eventSchemaVersion?: number;
  /** PD-018: additional object references (subject stays the primary object). */
  objectRefs?: EventObjectRef[];
  /** Stable operation id for idempotent retries (P2-T2 BLOCKER 2/3). When set,
   *  the dedup_key is derived ONLY from (projectId, eventType, idempotencyKey),
   *  independent of occurredAt / subjectId / sourceEntityId, so a retry of the
   *  same operation produces the SAME dedup_key and dedupes against the first
   *  attempt — no second Risk, no second event, no second ref set. The idempotency
   *  key MUST be a stable, persisted identity from the originating workflow
   *  (Scribe memory item id, import job+source id, or a command operationId) —
   *  NEVER a fresh timestamp, a per-retry uuid, or an unpersisted random.
   *
   *  P2-T2 BLOCKER 2 (scope) + BLOCKER 3 (fingerprint): the dedup_key INTENTIONALLY
   *  collides for the same (projectId, eventType, idempotencyKey) — it does NOT
   *  embed the riskId — so a commandId reused on another Risk of the same project
   *  is DETECTED in the dedup hit and rejected with `idempotency_scope_conflict`
   *  rather than silently producing a second event. The riskId is enforced as
   *  part of the operation identity via the RPC scope check (event.subject_id =
   *  request.riskId), NOT via the hash. The request fingerprint
   *  (provenance.idempotency_fingerprint) is then compared on every dedup hit:
   *  a mismatch raises `idempotency_payload_conflict` (a reused idempotency key
   *  with a DIFFERENT request is never silently accepted). */
  idempotencyKey?: string;
  /** P2-T2 BLOCKER 3 — for risk_registered ONLY: the logical risk fields the
   *  writer intends to create (title/category/probability/impact/severity/
   *  status/origin/links/…), WITHOUT id / organization_id / project_id /
   *  evidence_json / metadata (those are already in the base fingerprint or are
   *  per-attempt variables). The fingerprint of a risk_registered represents the
   *  logical Risk + its source item, so a full-capture retry (which generates a
   *  new attempt riskId) dedupes, while a DIFFERENT logical Risk with the same
   *  captureOperationId:item:index raises `idempotency_payload_conflict`. */
  idempotencyRiskLogicalFields?: Record<string, unknown>;
}

export interface EmitResult {
  ok: boolean;
  eventId?: string;
  deduped?: boolean;
  error?: string;
  errors?: string[];
}

// Envelope columns a payload must NOT duplicate.
const ENVELOPE_KEYS = new Set([
  "organization_id", "project_id", "event_type", "event_category", "occurred_at",
  "recorded_at", "actor_type", "actor_id", "subject_type", "subject_id",
  "from_state", "to_state", "caused_by", "correlation_id", "saga_id",
  "confidence", "provenance", "visibility", "sequence_number",
  "impact_schedule", "impact_cost", "impact_quality", "impact_risk", "impact_scope",
]);

// ── Pure helpers (unit-tested; no DB) ─────────────────────────────────────────

function hasEvidence(input: EmitEventInput): boolean {
  const prov = input.provenance ?? {};
  const refs = (prov as { evidenceRefs?: unknown }).evidenceRefs;
  if (Array.isArray(refs) && refs.length > 0) return true;
  if ((prov as { evidence?: unknown }).evidence != null) return true;
  if (input.sourceEntityId) return true;
  if (input.payload && (input.payload as { evidence?: unknown }).evidence != null) return true;
  return false;
}

export function resolveImportance(input: EmitEventInput): EventImportance | null {
  if (input.importanceOverride) return input.importanceOverride;
  const def = getEventDef(input.eventType);
  return def ? def.importance : null;
}

/** Deterministic projection-invalidation tags for an event (Constitution §? / v2.3). */
export function generateProjectionInvalidationTags(input: EmitEventInput): string[] {
  const def = getEventDef(input.eventType);
  const tags = new Set<string>();
  tags.add(`project:${input.projectId}`);
  tags.add(`case:${input.caseId ?? input.projectId}`);
  const subjectType = def?.subjectType;
  if (subjectType && input.subjectId) tags.add(`subject:${subjectType}:${input.subjectId}`);
  const milestoneId = (input.payload as { milestone_id?: string } | undefined)?.milestone_id;
  if (milestoneId) tags.add(`milestone:${milestoneId}`);
  if (input.portfolioId) tags.add(`portfolio:${input.portfolioId}`);
  for (const s of def?.invalidationScopes ?? []) tags.add(s);
  if (def?.retention === "LEARNING") tags.add(`org-knowledge:${input.organizationId}`);
  return [...tags];
}

/** Stable idempotency key. Compensating events are never deduped (dedupKey=null).
 *  When `idempotencyKey` is set (P2-T2 BLOCKER 2/3), the key is derived ONLY from
 *  (projectId, eventType, idempotencyKey) — stable across retries regardless of
 *  occurredAt / subjectId / sourceEntityId — so the atomic capture RPCs can
 *  dedup a retry of the same operation. The riskId is INTENTIONALLY NOT part of
 *  the hash: the key collides for the same (projectId, eventType, commandId) so
 *  a commandId reused on another Risk of the same project is caught in the dedup
 *  hit and rejected with `idempotency_scope_conflict` (the RPC scope check
 *  validates event.subject_id = request.riskId). Embedding riskId in the hash
 *  would make such reuse undetectable (a distinct key → a silent second event).
 *  Without idempotencyKey, the legacy shape (which includes occurredAt) is used,
 *  preserving the existing derived-trail behavior. */
export function computeDedupKey(input: EmitEventInput): string | null {
  if (input.isCompensatingEvent) return null;
  if (input.idempotencyKey) {
    return createHash("sha256")
      .update([input.projectId, input.eventType, input.idempotencyKey].join("|"))
      .digest("hex");
  }
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(input.payload ?? {}))
    .digest("hex")
    .slice(0, 16);
  const parts = [
    input.projectId,
    input.eventType,
    input.sourceModule,
    input.sourceEntityType ?? "",
    input.sourceEntityId ?? "",
    input.occurredAt ?? "",
    input.correlationId ?? "",
    // Backfill marker keeps synthetic history distinct from live-captured events.
    input.lifecycleClassOverride === "SYNTHETIC_BACKFILL_EVENT" ? "backfill" : "",
    payloadHash,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Deterministic JSON serialization: object keys sorted recursively, so two
 *  structurally-equal payloads with different key order produce the SAME string.
 *  Primitives, arrays and plain objects are handled; anything else is coerced
 *  via String() (no Date/class instances reach this path — the fingerprint is
 *  computed from plain EmitEventInput fields). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

/** Keys dropped from the payload before fingerprinting: regenerated timestamps
 *  (occurred_at / assessed_at / recorded_at …) and DB-assigned / per-attempt
 *  values (sequence_number, event_hash, the attempt risk id, the new
 *  memoryItemId a full-capture retry creates). They are NOT significative — a
 *  retry regenerates them — so keeping them would make the fingerprint unstable. */
const FINGERPRINT_PAYLOAD_DROP_KEYS = new Set([
  "occurred_at", "assessed_at", "recorded_at", "updated_at", "created_at",
  "occurredAt", "assessedAt", "recordedAt", "updatedAt", "createdAt",
  "sequence_number", "event_hash", "attempt_risk_id", "attemptRiskId",
  "memory_item_id", "memoryItemId",
]);

/** Returns a canonical copy of `payload` with the regenerated/audit keys
 *  removed, recursing into nested objects/arrays. Preserves every significative
 *  field (method, scope, reason_code, values, origin, title, …). */
function canonicalizePayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== "object") return payload ?? {};
  if (Array.isArray(payload)) return payload.map(canonicalizePayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (FINGERPRINT_PAYLOAD_DROP_KEYS.has(k)) continue;
    out[k] = typeof v === "object" && v !== null ? canonicalizePayload(v) : v;
  }
  return out;
}

/** P2-T2 BLOCKER 3 — stable request fingerprint for idempotent captures.
 *  Covers the SIGNIFICATIVE request fields (org, project, event_type,
 *  subject_type, actor, source_module, from/to state, payload, object_refs, and
 *  — for risk_registered only — the logical risk fields). EXCLUDES the
 *  naturally-variable values: subject_id (the per-attempt attemptRiskId for
 *  risk_registered; validated via the scope check for events on an existing
 *  risk), occurred_at, the per-attempt uuid inside the risk-focal ref, the
 *  recorded_at / sequence_number / event_hash assigned by the DB, and the new
 *  memoryItemId created by a full-capture retry. Persisted by
 *  `prepareAtomicEvent` into `provenance.idempotency_fingerprint` and compared
 *  on every dedup hit: a mismatch raises `idempotency_payload_conflict`. */
export function computeIdempotencyFingerprint(
  input: EmitEventInput,
  riskLogicalFields?: Record<string, unknown>,
): string {
  // Canonical refs: keep object_type + role + id, but DROP the object_id of the
  // risk-focal ref (for risk_registered that id is the per-attempt uuid; for
  // events on an existing risk it is the stable riskId already validated via the
  // RPC scope check). Other refs (project context, milestone, task, actor,
  // decision) keep their ids — they are stable across retries.
  const refsCanonical = (input.objectRefs ?? [])
    .map((r) => ({
      t: r.objectType,
      r: r.role,
      id: r.objectType === "risk" ? null : r.objectId,
    }))
    .sort((a, b) =>
      `${a.t}|${a.r}|${a.id ?? ""}`.localeCompare(`${b.t}|${b.r}|${b.id ?? ""}`),
    );
  const canonical = {
    organization_id: input.organizationId,
    project_id: input.projectId,
    event_type: input.eventType,
    subject_type: getEventDef(input.eventType)?.subjectType ?? null,
    // subject_id EXCLUDED (see above).
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    source_module: input.sourceModule,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    payload: canonicalizePayload(input.payload ?? {}),
    refs: refsCanonical,
    // risk_registered only: the logical risk the writer intends to create, so a
    // DIFFERENT logical Risk with the same captureOperationId:item:index is
    // detected as `idempotency_payload_conflict` while a full-capture retry of
    // the SAME logical Risk dedupes.
    risk_logical: riskLogicalFields ?? null,
  };
  return createHash("sha256").update(stableStringify(canonical)).digest("hex");
}

/** Deterministic tamper-evident hash from stable fields + the previous hash. */
export function computeEventHash(
  input: EmitEventInput,
  sequenceNumber: number,
  previousHash: string | null,
): string {
  const stable = [
    input.projectId,
    sequenceNumber,
    input.eventType,
    input.subjectId ?? "",
    input.actorType,
    input.occurredAt ?? "",
    input.fromState ?? "",
    input.toState ?? "",
    JSON.stringify(input.payload ?? {}),
    previousHash ?? "",
  ];
  return createHash("sha256").update(stable.join("|")).digest("hex");
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateProjectEvent(input: EmitEventInput): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const { eventType } = input;

  if (!eventType) errors.push("event_type is required");
  else if (isEphemeralExcluded(eventType)) errors.push(`event_type ${eventType} is EPHEMERAL_EXCLUDED and must not enter the log`);
  else if (DEPRECATED_EVENT_TYPES.has(eventType)) errors.push(`event_type ${eventType} is deprecated for new emissions — use its canonical snake_case type (PD-018 §A.4)`);
  else if (!isRegisteredEvent(eventType)) errors.push(`event_type ${eventType} is not in the Canonical Event Taxonomy registry`);
  else if (!isPastTenseName(eventType)) errors.push(`event_type ${eventType} must be a past-tense name`);

  // PD-018: object refs must be complete triples (type + id + role).
  for (const [i, ref] of (input.objectRefs ?? []).entries()) {
    if (!ref || !ref.objectType || !ref.objectId || !ref.role) {
      errors.push(`object_refs[${i}] must carry objectType, objectId and role`);
    }
  }

  const def = getEventDef(eventType);
  if (!input.organizationId) errors.push("organization_id is required");
  if (!input.projectId) errors.push("project_id is required");
  if (!input.sourceModule) errors.push("source_module is required");
  if (!input.actorType || !VALID_ACTOR_TYPES.has(input.actorType)) errors.push("actor_type is invalid");
  if (input.visibility && !VALID_VISIBILITY.has(input.visibility)) errors.push("visibility is invalid");
  if (input.permissionScope != null && typeof input.permissionScope !== "object") errors.push("permission_scope must be an object");
  if (input.eventSchemaVersion != null && (!Number.isInteger(input.eventSchemaVersion) || input.eventSchemaVersion < 1)) {
    errors.push("event_schema_version must be a positive integer");
  }
  if (input.confidence != null && (input.confidence < 0 || input.confidence > 1)) errors.push("confidence must be within [0,1]");

  if (input.lifecycleClassOverride != null && !VALID_LIFECYCLE_CLASSES.has(input.lifecycleClassOverride)) {
    errors.push("event_lifecycle_class override is invalid");
  }
  // Synthetic backfill events must be marked (provenance.backfilled) and carry reduced confidence.
  if (input.lifecycleClassOverride === "SYNTHETIC_BACKFILL_EVENT") {
    if (input.confidence == null) errors.push("backfill event requires confidence");
    if ((input.provenance as { backfilled?: unknown } | undefined)?.backfilled !== true) {
      errors.push("backfill event requires provenance.backfilled = true");
    }
  }

  if (def) {
    const importance = resolveImportance(input);
    if (!importance || !VALID_IMPORTANCE.has(importance)) errors.push("event_importance could not be resolved");

    // subject required for real facts (project events default subject to the project).
    const subjectRequired =
      def.lifecycleClass !== "SYSTEM_EVENT" && def.subjectType !== "project";
    if (subjectRequired && !input.subjectId) errors.push(`subject_id is required for ${eventType}`);

    // required payload fields present
    const payload = input.payload ?? {};
    for (const key of def.requiredPayload) {
      if (payload[key] == null) errors.push(`payload.${key} is required for ${eventType}`);
    }
    // payload must not duplicate envelope fields
    for (const key of Object.keys(payload)) {
      if (ENVELOPE_KEYS.has(key)) errors.push(`payload.${key} duplicates an envelope field`);
    }

    // HIGH / CRITICAL require evidence
    if (importance && requiresEvidence(importance) && !hasEvidence(input)) {
      errors.push(`${importance} event ${eventType} requires evidence (provenance.evidenceRefs, evidence, or source_entity_id)`);
    }

    // AI events require provenance + confidence
    if (def.lifecycleClass === "AI_EVENT" || input.actorType === "ai") {
      const provEmpty = !input.provenance || Object.keys(input.provenance).length === 0;
      if (provEmpty) errors.push(`AI event ${eventType} requires provenance`);
      if (input.confidence == null) errors.push(`AI event ${eventType} requires confidence`);
    }
  }

  // compensating events must reference a prior event
  if (input.isCompensatingEvent && !input.compensatesEventId) {
    errors.push("compensating event must reference compensates_event_id");
  }
  if (!input.isCompensatingEvent && input.compensatesEventId) {
    errors.push("compensates_event_id is only allowed on compensating events");
  }

  return { ok: errors.length === 0, errors };
}

// ── Normalization (fills defaults from the registry) ──────────────────────────

export interface NormalizedRow {
  organization_id: string;
  project_id: string;
  portfolio_id: string | null;
  case_id: string;
  event_category: string;
  event_type: string;
  event_schema_version: number;
  event_importance: EventImportance;
  event_lifecycle_class: string;
  subject_type: string;
  subject_id: string | null;
  actor_type: string;
  actor_id: string | null;
  occurred_at: string;
  source_module: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  from_state: string | null;
  to_state: string | null;
  caused_by: string[];
  correlation_id: string | null;
  saga_id: string | null;
  provenance: Record<string, unknown>;
  confidence: number | null;
  impact_schedule: string | null;
  impact_cost: string | null;
  impact_quality: string | null;
  impact_risk: string | null;
  impact_scope: string | null;
  payload: Record<string, unknown>;
  visibility: string;
  permission_scope: Record<string, unknown>;
  invalidation_tags: string[];
  dedup_key: string | null;
  is_compensating_event: boolean;
  compensates_event_id: string | null;
}

export function normalizeProjectEvent(input: EmitEventInput): NormalizedRow {
  const def = getEventDef(input.eventType)!;
  const importance = resolveImportance(input)!;
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const provenance = { ...(input.provenance ?? {}) };
  if (input.importanceOverride) {
    (provenance as Record<string, unknown>).importanceOverride = input.importanceOverride;
  }
  // project events default the subject to the project itself.
  const subjectId =
    input.subjectId ?? (def.subjectType === "project" ? input.projectId : null);

  return {
    organization_id: input.organizationId,
    project_id: input.projectId,
    portfolio_id: input.portfolioId ?? null,
    case_id: input.caseId ?? input.projectId,
    event_category: def.category,
    event_type: input.eventType,
    event_schema_version: input.eventSchemaVersion ?? 1,
    event_importance: importance,
    event_lifecycle_class: input.lifecycleClassOverride ?? def.lifecycleClass,
    subject_type: def.subjectType,
    subject_id: subjectId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    occurred_at: occurredAt,
    source_module: input.sourceModule,
    source_entity_type: input.sourceEntityType ?? null,
    source_entity_id: input.sourceEntityId ?? null,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    caused_by: input.causedBy ?? [],
    correlation_id: input.correlationId ?? null,
    saga_id: input.sagaId ?? null,
    provenance,
    confidence: input.confidence ?? null,
    impact_schedule: input.impact?.schedule ?? null,
    impact_cost: input.impact?.cost ?? null,
    impact_quality: input.impact?.quality ?? null,
    impact_risk: input.impact?.risk ?? null,
    impact_scope: input.impact?.scope ?? null,
    payload: input.payload ?? {},
    visibility: input.visibility ?? "normal",
    permission_scope: input.permissionScope ?? {},
    invalidation_tags: generateProjectionInvalidationTags({ ...input, occurredAt }),
    dedup_key: computeDedupKey({ ...input, occurredAt }),
    is_compensating_event: input.isCompensatingEvent ?? false,
    compensates_event_id: input.compensatesEventId ?? null,
  };
}

// ── Atomic capture support (P2-T2 remediation) ─────────────────────────────────
// The capture_* RPCs (supabase/migrations/20260845000000) own the transactional
// boundary; TS still owns validation + normalization + dedup_key + payload
// serialization so the contract is NOT duplicated. This helper produces the
// (eventRow, payloadText, refs) triple the RPCs consume. Reuses the exact
// serialization computeEventHash uses, so the SQL-side hash stays consistent
// with the non-atomic emission path.

export interface PreparedAtomicEvent {
  event: Record<string, unknown>;
  payloadText: string;
  refs: { object_type: string; object_id: string; role: string }[];
}

export function prepareAtomicEvent(
  input: EmitEventInput,
): { ok: true; data: PreparedAtomicEvent } | { ok: false; errors: string[] } {
  const { ok, errors } = validateProjectEvent(input);
  if (!ok) return { ok: false, errors };
  const row = normalizeProjectEvent(input);
  // P2-T2 BLOCKER 3 — persist the request fingerprint into provenance so the
  // RPC can compare it on a dedup hit (a reused idempotency key with a DIFFERENT
  // request raises `idempotency_payload_conflict`). Only when the capture is
  // idempotent (idempotencyKey set) — the non-atomic / legacy path is untouched.
  if (input.idempotencyKey) {
    const fp = computeIdempotencyFingerprint(input, input.idempotencyRiskLogicalFields);
    (row.provenance as Record<string, unknown>).idempotency_fingerprint = fp;
  }
  const payloadText = JSON.stringify(input.payload ?? {});
  const refs = (input.objectRefs ?? []).map((r) => ({
    object_type: r.objectType,
    object_id: r.objectId,
    role: r.role,
  }));
  // The row is JSON-safe (strings, numbers, nulls, string arrays, jsonb-shaped
  // objects). The supabase client serializes it to the p_event jsonb param.
  return { ok: true, data: { event: row as unknown as Record<string, unknown>, payloadText, refs } };
}

// ── Write path (server-only; service_role via admin client) ───────────────────

/** Emit a single canonical project event. Idempotent, append-only. */
export async function emitProjectEvent(input: EmitEventInput): Promise<EmitResult> {
  const { ok, errors } = validateProjectEvent(input);
  if (!ok) return { ok: false, error: "validation_failed", errors };

  try {
    const supabase = createAdminClient();
    const row = normalizeProjectEvent(input);

    // Idempotency: return the existing event if the dedup key already exists.
    if (row.dedup_key) {
      const { data: existing } = await supabase
        .from("project_event_log")
        .select("event_id")
        .eq("project_id", row.project_id)
        .eq("dedup_key", row.dedup_key)
        .maybeSingle();
      if (existing?.event_id) return { ok: true, eventId: existing.event_id, deduped: true };
    }

    // Compensating events must reference a real prior event.
    if (row.is_compensating_event && row.compensates_event_id) {
      const { data: prior } = await supabase
        .from("project_event_log")
        .select("event_id")
        .eq("event_id", row.compensates_event_id)
        .maybeSingle();
      if (!prior) return { ok: false, error: "compensates_event_not_found" };
    }

    // Atomic per-project sequence.
    const { data: seq, error: seqErr } = await supabase.rpc("next_project_event_seq", {
      p_project_id: row.project_id,
    });
    if (seqErr || seq == null) {
      console.error("[events] sequence assignment failed:", seqErr?.message);
      return { ok: false, error: "sequence_failed" };
    }
    const sequenceNumber = Number(seq);

    // Tamper-evident chain (best-effort during early rollout).
    const { data: prev } = await supabase
      .from("project_event_log")
      .select("event_hash")
      .eq("project_id", row.project_id)
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousHash = (prev as { event_hash?: string } | null)?.event_hash ?? null;
    const eventHash = computeEventHash({ ...input, occurredAt: row.occurred_at }, sequenceNumber, previousHash);

    const { data: inserted, error: insErr } = await supabase
      .from("project_event_log")
      .insert({ ...row, sequence_number: sequenceNumber, event_hash: eventHash, previous_event_hash: previousHash })
      .select("event_id")
      .single();

    if (insErr) {
      // Unique dedup race → return the existing row (still idempotent).
      if (insErr.code === "23505" && row.dedup_key) {
        const { data: existing } = await supabase
          .from("project_event_log")
          .select("event_id")
          .eq("project_id", row.project_id)
          .eq("dedup_key", row.dedup_key)
          .maybeSingle();
        if (existing?.event_id) return { ok: true, eventId: existing.event_id, deduped: true };
      }
      console.error("[events] insert failed:", insErr.message);
      return { ok: false, error: "insert_failed" };
    }

    // PD-018 §A.1 row 9 — persist object refs (idempotent via upsert on the PK;
    // deduped events skip this path entirely, their refs already exist).
    const refs = input.objectRefs ?? [];
    if (refs.length > 0) {
      const { error: refErr } = await supabase.from("project_event_objects").upsert(
        refs.map((r) => ({
          event_id: inserted.event_id,
          object_type: r.objectType,
          object_id: r.objectId,
          role: r.role,
        })),
        { onConflict: "event_id,object_type,object_id,role", ignoreDuplicates: true },
      );
      if (refErr) console.error("[events] object_refs insert failed:", refErr.message);
    }

    // P2-T2 derived response trail: a LIVE (non-backfill) task event may derive
    // a risk response event when the task is linked to a risk and the pilot
    // flag is on. Fire-and-forget; dynamic import avoids a static cycle.
    if (
      DERIVABLE_TASK_EVENT_TYPES.has(input.eventType) &&
      row.event_lifecycle_class !== "SYNTHETIC_BACKFILL_EVENT"
    ) {
      import("./risk-derived-bridge")
        .then(({ deriveRiskEventsForTaskEvent }) =>
          deriveRiskEventsForTaskEvent({
            eventId: inserted.event_id,
            eventType: input.eventType,
            organizationId: row.organization_id,
            projectId: row.project_id,
            taskId: row.subject_id,
            toState: row.to_state,
            occurredAt: row.occurred_at,
          }),
        )
        .catch((err) => console.error("[events] derived-risk bridge error:", err));
    }

    return { ok: true, eventId: inserted.event_id };
  } catch (err) {
    console.error("[events] emitProjectEvent exception:", err);
    return { ok: false, error: "exception" };
  }
}

/** Emit several events (best-effort, per-event result). */
export async function emitProjectEvents(batch: EmitEventInput[]): Promise<EmitResult[]> {
  const out: EmitResult[] = [];
  for (const input of batch) out.push(await emitProjectEvent(input));
  return out;
}

/** Emit a compensating event that corrects a prior event (never an edit). */
export async function emitCompensatingEvent(
  input: Omit<EmitEventInput, "isCompensatingEvent"> & { compensatesEventId: string },
): Promise<EmitResult> {
  return emitProjectEvent({ ...input, isCompensatingEvent: true });
}

/**
 * Fire-and-forget wrapper: never throws, always logs. Critical events log at
 * error level so they are observable and not silently lost during early rollout.
 */
export function emitProjectEventSafe(input: EmitEventInput): void {
  emitProjectEvent(input)
    .then((res) => {
      if (!res.ok) {
        const importance = resolveImportance(input);
        const level = importance === "CRITICAL" || importance === "HIGH" ? "error" : "warn";
        console[level]("[events] emit failed:", input.eventType, res.error, res.errors ?? "");
      }
    })
    .catch((err) => console.error("[events] emit crashed:", input.eventType, err));
}
