import { createHash } from "node:crypto";
import type { ExplanationContract, ExplanationContractInput, ExplanationEvidence } from "./types";

const CLASSIFICATION_LABELS = {
  fact: "Fact",
  inference: "Inference",
  recommendation: "Recommendation",
  prediction: "Prediction",
  uncertainty: "Uncertainty",
} as const;

function parseTimestamp(value: string, errorCode: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(errorCode);
  return timestamp;
}

function normalizeEvidence(evidence: readonly ExplanationEvidence[]): ExplanationEvidence[] {
  const refs = new Set<string>();
  return evidence.map((item) => {
    const normalized = {
      ...item,
      ref: item.ref.trim(),
      description: item.description.trim(),
    };
    if (!normalized.ref || !normalized.description) throw new Error("explanation_evidence_invalid");
    if (refs.has(normalized.ref)) throw new Error("explanation_evidence_duplicate");
    refs.add(normalized.ref);
    parseTimestamp(normalized.observedAt, "explanation_evidence_timestamp_invalid");
    return normalized;
  });
}

export function buildExplanationContract(input: ExplanationContractInput): ExplanationContract {
  const claim = input.claim.trim();
  const reasoningSummary = input.reasoningSummary.trim();
  if (!input.organizationId.trim() || !input.projectId.trim()) throw new Error("explanation_scope_required");
  if (!claim || !reasoningSummary) throw new Error("explanation_claim_and_reasoning_required");
  if (!Number.isFinite(input.confidence.value) || input.confidence.value < 0 || input.confidence.value > 1) {
    throw new Error("explanation_confidence_invalid");
  }
  const confidenceBasis = input.confidence.basis.trim();
  if (!confidenceBasis) throw new Error("explanation_confidence_basis_required");
  const evidence = normalizeEvidence(input.evidence);
  if (input.classification !== "uncertainty" && evidence.length === 0) throw new Error("explanation_evidence_required");
  const limitations = [...new Set(input.limitations.map((item) => item.trim()).filter(Boolean))];
  if (["inference", "recommendation", "prediction", "uncertainty"].includes(input.classification) && limitations.length === 0) {
    throw new Error("explanation_limitations_required");
  }
  if (input.classification === "prediction" && (!input.prediction?.horizon.trim() || !input.prediction.calibrationRef.trim())) {
    throw new Error("explanation_prediction_calibration_required");
  }
  if (input.classification !== "prediction" && input.prediction) throw new Error("explanation_prediction_details_not_allowed");
  if (!Number.isFinite(input.freshnessWindowHours) || input.freshnessWindowHours <= 0) {
    throw new Error("explanation_freshness_window_invalid");
  }
  const generatedAt = parseTimestamp(input.generatedAt, "explanation_generated_timestamp_invalid");
  const newestEvidenceAt = evidence.length
    ? evidence.reduce((latest, item) => Math.max(latest, parseTimestamp(item.observedAt, "explanation_evidence_timestamp_invalid")), 0)
    : generatedAt;
  if (newestEvidenceAt > generatedAt) throw new Error("explanation_evidence_from_future");
  const ageHours = Number(((generatedAt - newestEvidenceAt) / 3_600_000).toFixed(2));
  const freshnessStatus = ageHours <= input.freshnessWindowHours ? "current" : "stale";
  const humanApprovalRequired = input.classification === "recommendation" || input.classification === "prediction"
    ? true
    : Boolean(input.humanApprovalRequired);
  const canonical = JSON.stringify({
    organizationId: input.organizationId,
    projectId: input.projectId,
    classification: input.classification,
    claim,
    evidence,
    confidence: input.confidence.value,
    generatedAt: input.generatedAt,
  });
  const id = createHash("sha256").update(canonical).digest("hex").slice(0, 24);
  return {
    contractVersion: "1.0.0",
    id: `explanation:${id}`,
    organizationId: input.organizationId,
    projectId: input.projectId,
    classification: input.classification,
    claim,
    reasoningSummary,
    evidence,
    confidence: { value: input.confidence.value, basis: confidenceBasis },
    limitations,
    generatedAt: input.generatedAt,
    freshness: {
      status: freshnessStatus,
      newestEvidenceAt: new Date(newestEvidenceAt).toISOString(),
      ageHours,
      windowHours: input.freshnessWindowHours,
    },
    humanApprovalRequired,
    executableNow: false,
    prediction: input.prediction ? { ...input.prediction } : undefined,
    visualHooks: {
      classificationLabel: CLASSIFICATION_LABELS[input.classification],
      confidencePercent: Math.round(input.confidence.value * 100),
      evidenceCount: evidence.length,
      freshnessLabel: freshnessStatus === "current" ? "Current" : "Stale",
      approvalLabel: humanApprovalRequired ? "Human approval required" : "Informational only",
    },
  };
}
