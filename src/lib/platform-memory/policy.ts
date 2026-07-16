import type {
  GovernedMemoryItem,
  MemoryRetentionDecision,
  MemoryRetrievalRequest,
  MemoryRetrievalResult,
} from "./types";

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function evaluateMemoryRetention(item: GovernedMemoryItem, evaluatedAt: string): MemoryRetentionDecision {
  const reasons: string[] = [];
  if (!item.consentRecorded && ["interaction", "working"].includes(item.boundary)) reasons.push("consent_required");
  if (item.boundary === "organizational_learning" && (!item.humanValidated || item.projectId !== null)) {
    reasons.push("organizational_memory_requires_validated_deidentified_learning");
  }
  if (item.legalHold) return { itemId: item.id, status: "legal_hold", reasons: ["legal_hold"], expiresAt: null };
  if (reasons.length > 0) return { itemId: item.id, status: "reject", reasons: unique(reasons), expiresAt: item.expiresAt ?? null };
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= new Date(evaluatedAt).getTime()) {
    return { itemId: item.id, status: "expire", reasons: ["retention_period_elapsed"], expiresAt: item.expiresAt };
  }
  return { itemId: item.id, status: "retain", reasons: ["retention_policy_satisfied"], expiresAt: item.expiresAt ?? null };
}

export function retrieveGovernedMemory(
  request: MemoryRetrievalRequest,
  sourceItems: readonly GovernedMemoryItem[],
): MemoryRetrievalResult {
  if (request.purpose.trim().length < 3) {
    return { status: "denied", items: [], excludedItemIds: [], limitations: ["retrieval_purpose_required"], truncated: false };
  }
  const excludedItemIds: string[] = [];
  const limitations: string[] = [];
  const maximumItems = request.maximumItems ?? 25;
  const eligible = sourceItems.filter((item) => {
    if (item.organizationId !== request.organizationId) {
      excludedItemIds.push(item.id);
      return false;
    }
    if (item.projectId && item.projectId !== request.projectId) {
      excludedItemIds.push(item.id);
      return false;
    }
    if (item.interactionId && item.interactionId !== request.interactionId) {
      excludedItemIds.push(item.id);
      return false;
    }
    if (!request.includeBoundaries.includes(item.boundary)) {
      excludedItemIds.push(item.id);
      return false;
    }
    const retention = evaluateMemoryRetention(item, request.asOf);
    if (retention.status === "expire" || retention.status === "reject") {
      excludedItemIds.push(item.id);
      limitations.push(`${retention.status}:${item.id}`);
      return false;
    }
    if (item.sensitivity === "restricted" && request.actorType === "ai") {
      excludedItemIds.push(item.id);
      limitations.push(`restricted_memory_excluded:${item.id}`);
      return false;
    }
    return true;
  }).sort((left, right) => right.capturedAt.localeCompare(left.capturedAt) || left.id.localeCompare(right.id));

  const selected = eligible.slice(0, maximumItems);
  const truncated = eligible.length > selected.length;
  if (truncated) limitations.push("memory_results_truncated");
  if (sourceItems.some((item) => item.rawContentAvailable)) limitations.push("raw_memory_content_never_returned");

  return {
    status: selected.length === 0 ? limitations.length > 0 ? "partial" : "empty" : limitations.length > 0 ? "partial" : "ready",
    items: selected.map((item) => ({
      id: item.id,
      boundary: item.boundary,
      sourceRef: item.sourceRef,
      safeSummary: item.safeSummary,
      evidenceRefs: unique(item.evidenceRefs),
      capturedAt: item.capturedAt,
      rawContentIncluded: false,
    })),
    excludedItemIds: unique(excludedItemIds),
    limitations: unique(limitations),
    truncated,
  };
}
