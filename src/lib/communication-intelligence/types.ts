export type CommunicationSourceType =
  | "email"
  | "meeting"
  | "phone"
  | "teams"
  | "slack"
  | "in_person"
  | "document"
  | "manual_note"
  | "other";

export interface CommunicationIngestionInput {
  organizationId: string;
  projectId: string;
  sourceType: CommunicationSourceType;
  sourceExternalId: string;
  sourceRef: string;
  sender: string | null;
  recipients: readonly string[];
  subject: string | null;
  content: string;
  occurredAt: string;
  recordedAt: string;
  consentRecorded: boolean;
}

export interface NormalizedCommunication {
  contractVersion: "1.0.0";
  id: string;
  fingerprint: string;
  organizationId: string;
  projectId: string;
  sourceType: CommunicationSourceType;
  sourceExternalId: string;
  sourceRef: string;
  sender: string | null;
  recipients: string[];
  subject: string | null;
  normalizedContent: string;
  occurredAt: string;
  recordedAt: string;
  provenance: {
    sourceType: CommunicationSourceType;
    sourceExternalId: string;
    contentFingerprint: string;
  };
  consentRecorded: true;
}

export type CommunicationKnowledgeCandidateType = "decision" | "action" | "risk" | "lesson" | "commitment" | "question";

export interface ProposedCommunicationKnowledge {
  type: CommunicationKnowledgeCandidateType;
  statement: string;
  sourceExcerpt: string;
  confidence: number;
  structuredContent?: Record<string, unknown>;
}

export interface CommunicationKnowledgeCandidate extends ProposedCommunicationKnowledge {
  id: string;
  communicationId: string;
  organizationId: string;
  projectId: string;
  evidenceRefs: string[];
  status: "needs_review";
  humanValidationRequired: true;
  executableNow: false;
}

export interface CommunicationKnowledgeReview {
  candidateId: string;
  decision: "accepted" | "rejected";
  actorId: string;
  actorRole: "owner" | "admin";
  actorType: "human";
  rationale: string;
  reviewedAt: string;
  createsKnowledgeAutomatically: false;
}
