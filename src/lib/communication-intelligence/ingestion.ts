import { createHash } from "node:crypto";
import type { CommunicationIngestionInput, NormalizedCommunication } from "./types";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeCommunication(input: CommunicationIngestionInput): NormalizedCommunication {
  if (!input.organizationId.trim() || !input.projectId.trim()) throw new Error("communication_scope_required");
  if (!input.sourceExternalId.trim() || !input.sourceRef.trim()) throw new Error("communication_provenance_required");
  if (!input.consentRecorded) throw new Error("communication_consent_required");
  const normalizedContent = normalizeWhitespace(input.content);
  if (normalizedContent.length < 3) throw new Error("communication_content_required");
  const recipients = [...new Set(input.recipients.map((recipient) => recipient.trim()).filter(Boolean))].sort();
  const contentFingerprint = sha256(normalizedContent);
  const fingerprint = sha256(JSON.stringify({
    organizationId: input.organizationId,
    projectId: input.projectId,
    sourceType: input.sourceType,
    sourceExternalId: input.sourceExternalId,
    contentFingerprint,
  }));
  return {
    contractVersion: "1.0.0",
    id: `communication:${fingerprint.slice(0, 24)}`,
    fingerprint,
    organizationId: input.organizationId,
    projectId: input.projectId,
    sourceType: input.sourceType,
    sourceExternalId: input.sourceExternalId,
    sourceRef: input.sourceRef,
    sender: input.sender?.trim() || null,
    recipients,
    subject: input.subject?.trim() || null,
    normalizedContent,
    occurredAt: input.occurredAt,
    recordedAt: input.recordedAt,
    provenance: { sourceType: input.sourceType, sourceExternalId: input.sourceExternalId, contentFingerprint },
    consentRecorded: true,
  };
}
