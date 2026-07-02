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
  VALID_ACTOR_TYPES,
  VALID_VISIBILITY,
  VALID_IMPORTANCE,
  type ActorType,
  type EventImportance,
} from "./registry";

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
  isCompensatingEvent?: boolean;
  compensatesEventId?: string | null;
  eventSchemaVersion?: number;
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

/** Stable idempotency key. Compensating events are never deduped (dedupKey=null). */
export function computeDedupKey(input: EmitEventInput): string | null {
  if (input.isCompensatingEvent) return null;
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
    payloadHash,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
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
  else if (!isRegisteredEvent(eventType)) errors.push(`event_type ${eventType} is not in the Canonical Event Taxonomy registry`);
  else if (!isPastTenseName(eventType)) errors.push(`event_type ${eventType} must be a past-tense name`);

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

interface NormalizedRow {
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
    event_lifecycle_class: def.lifecycleClass,
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
