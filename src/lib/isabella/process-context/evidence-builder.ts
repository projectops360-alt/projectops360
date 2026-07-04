// ============================================================================
// ProjectOps360° — Isabella Process Context · evidence + citation builders
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// PURE, safe constructors for IsabellaEvidencePacket / IsabellaCitation. They
// sanitize (strip newlines/pipes, cap length), stamp org+project scope, and
// carry allowed/disallowed claims from the Task 1 contract. No raw payloads,
// no secrets, no DB access.
// ============================================================================

import type {
  IsabellaCitation,
  IsabellaClaimType,
  IsabellaConfidence,
  IsabellaEvidencePacket,
  IsabellaEvidenceType,
  IsabellaEvidenceVisibility,
  IsabellaSourceKind,
} from "@/lib/isabella/process-intelligence/types";
import { ISABELLA_EVIDENCE_TYPES } from "@/lib/isabella/process-intelligence/types";

const MAX_SUMMARY = 500;

/** Strip control chars / collapse whitespace / cap length — never a raw payload. */
export function sanitizeText(input: string | null | undefined, max = MAX_SUMMARY): string {
  const s = (input ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface BuildEvidenceInput {
  evidenceId: string;
  evidenceType: IsabellaEvidenceType;
  sourceKind: IsabellaSourceKind;
  sourceId: string;
  projectId: string;
  organizationId: string;
  title: string;
  summary: string;
  citationLabel: string;
  citationRef?: string | null;
  occurredAt?: string | null;
  updatedAt?: string | null;
  confidence: IsabellaConfidence;
  visibility?: IsabellaEvidenceVisibility;
  allowedClaims?: IsabellaClaimType[];
  disallowedClaims?: IsabellaClaimType[];
  claimSupport?: IsabellaClaimType[];
  limitations?: string[];
}

/** Build a sanitized evidence packet. Throws only on an invalid evidence type. */
export function buildIsabellaEvidencePacket(input: BuildEvidenceInput): IsabellaEvidencePacket {
  if (!ISABELLA_EVIDENCE_TYPES.includes(input.evidenceType)) {
    throw new Error(`Invalid evidence type: ${input.evidenceType}`);
  }
  return {
    evidenceId: input.evidenceId,
    evidenceType: input.evidenceType,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    title: sanitizeText(input.title, 200),
    summary: sanitizeText(input.summary),
    citationLabel: sanitizeText(input.citationLabel, 120),
    citationRef: input.citationRef ?? null,
    occurredAt: input.occurredAt ?? null,
    updatedAt: input.updatedAt ?? null,
    confidence: input.confidence,
    visibility: input.visibility ?? "project",
    claimSupport: input.claimSupport,
    allowedClaims: input.allowedClaims,
    disallowedClaims: input.disallowedClaims,
    limitations: input.limitations,
  };
}

export interface BuildCitationInput {
  sourceLabel: string;
  entityType: IsabellaEvidenceType;
  entityTitle: string;
  safeRef?: string | null;
  occurredAt?: string | null;
  confidence: IsabellaConfidence;
}

/** Build a safe citation — no raw JSON, no secrets, display-safe refs only. */
export function buildIsabellaCitation(input: BuildCitationInput): IsabellaCitation {
  return {
    sourceLabel: sanitizeText(input.sourceLabel, 120),
    entityType: input.entityType,
    entityTitle: sanitizeText(input.entityTitle, 200),
    safeRef: input.safeRef ?? null,
    occurredAt: input.occurredAt ?? null,
    confidence: input.confidence,
  };
}

/** A display-safe reference like `task:<id>` (opaque, never a raw payload). */
export function safeRef(kind: string, id: string): string {
  return `${kind}:${id}`;
}
