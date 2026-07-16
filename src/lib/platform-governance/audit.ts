import { createHash } from "node:crypto";
import type {
  GovernanceAuditInput,
  GovernanceAuditRecord,
  GovernanceAuditValidation,
} from "./types";

const FORBIDDEN_METADATA_KEYS = new Set([
  "access_token",
  "authorization",
  "body",
  "content",
  "password",
  "payload",
  "raw_payload",
  "secret",
  "transcript",
]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FORBIDDEN_METADATA_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitizeMetadata(item)]),
  );
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashRecord(record: Omit<GovernanceAuditRecord, "recordHash">): string {
  return createHash("sha256").update(canonicalize(record)).digest("hex");
}

export function createGovernanceAuditRecord(
  input: GovernanceAuditInput,
  sequence: number,
  previousHash: string | null,
): GovernanceAuditRecord {
  if (!input.eventId.trim()) throw new Error("governance_event_id_required");
  if (!input.actorId.trim()) throw new Error("governance_actor_required");
  if (input.purpose.trim().length < 3) throw new Error("governance_purpose_required");
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("governance_sequence_invalid");

  const recordWithoutHash: Omit<GovernanceAuditRecord, "recordHash"> = {
    ...input,
    projectId: input.projectId ?? null,
    reasonCodes: unique(input.reasonCodes),
    evidenceRefs: unique(input.evidenceRefs),
    metadata: sanitizeMetadata(input.metadata ?? {}) as Record<string, unknown>,
    sequence,
    previousHash,
  };
  return { ...recordWithoutHash, recordHash: hashRecord(recordWithoutHash) };
}

export function validateGovernanceAuditChain(records: readonly GovernanceAuditRecord[]): GovernanceAuditValidation {
  const violations: string[] = [];
  const ordered = [...records].sort((left, right) => left.sequence - right.sequence);
  for (let index = 0; index < ordered.length; index += 1) {
    const record = ordered[index];
    const previous = ordered[index - 1];
    if (record.sequence !== index + 1) violations.push(`sequence_gap:${record.sequence}`);
    if (record.previousHash !== (previous?.recordHash ?? null)) violations.push(`previous_hash_mismatch:${record.eventId}`);
    const { recordHash, ...withoutHash } = record;
    if (recordHash !== hashRecord(withoutHash)) violations.push(`record_hash_mismatch:${record.eventId}`);
    if (index > 0 && record.organizationId !== ordered[0].organizationId) violations.push(`cross_organization_chain:${record.eventId}`);
  }
  return { valid: violations.length === 0, violations: unique(violations), checkedRecords: ordered.length };
}
