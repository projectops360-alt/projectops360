import type { PlatformActorType, PlatformDataSensitivity } from "@/lib/platform-governance/types";

export type MemoryBoundary = "interaction" | "working" | "project_record" | "organizational_learning";
export type MemoryRetentionStatus = "retain" | "expire" | "legal_hold" | "reject";

export interface GovernedMemoryItem {
  id: string;
  organizationId: string;
  projectId?: string | null;
  interactionId?: string | null;
  boundary: MemoryBoundary;
  sensitivity: PlatformDataSensitivity;
  sourceType: string;
  sourceRef: string;
  safeSummary: string;
  rawContentAvailable: boolean;
  evidenceRefs: readonly string[];
  capturedAt: string;
  expiresAt?: string | null;
  legalHold: boolean;
  humanValidated: boolean;
  consentRecorded: boolean;
}

export interface MemoryRetentionDecision {
  itemId: string;
  status: MemoryRetentionStatus;
  reasons: string[];
  expiresAt: string | null;
}

export interface MemoryRetrievalRequest {
  organizationId: string;
  projectId?: string | null;
  interactionId?: string | null;
  actorType: PlatformActorType;
  purpose: string;
  asOf: string;
  includeBoundaries: readonly MemoryBoundary[];
  maximumItems?: number;
}

export interface RetrievedMemoryItem {
  id: string;
  boundary: MemoryBoundary;
  sourceRef: string;
  safeSummary: string;
  evidenceRefs: string[];
  capturedAt: string;
  rawContentIncluded: false;
}

export interface MemoryRetrievalResult {
  status: "ready" | "partial" | "empty" | "denied";
  items: RetrievedMemoryItem[];
  excludedItemIds: string[];
  limitations: string[];
  truncated: boolean;
}
