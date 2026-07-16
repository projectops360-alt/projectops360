export type ExplanationClassification = "fact" | "inference" | "recommendation" | "prediction" | "uncertainty";

export interface ExplanationEvidence {
  ref: string;
  sourceType: "communication" | "project_record" | "metric" | "decision" | "forecast" | "other";
  description: string;
  observedAt: string;
}

export interface ExplanationConfidence {
  value: number;
  basis: string;
}

export interface PredictionExplanationDetails {
  horizon: string;
  calibrationRef: string;
}

export interface ExplanationContractInput {
  organizationId: string;
  projectId: string;
  classification: ExplanationClassification;
  claim: string;
  reasoningSummary: string;
  evidence: readonly ExplanationEvidence[];
  confidence: ExplanationConfidence;
  limitations: readonly string[];
  generatedAt: string;
  freshnessWindowHours: number;
  humanApprovalRequired?: boolean;
  prediction?: PredictionExplanationDetails;
}

export interface ExplanationContract {
  contractVersion: "1.0.0";
  id: string;
  organizationId: string;
  projectId: string;
  classification: ExplanationClassification;
  claim: string;
  reasoningSummary: string;
  evidence: ExplanationEvidence[];
  confidence: ExplanationConfidence;
  limitations: string[];
  generatedAt: string;
  freshness: {
    status: "current" | "stale";
    newestEvidenceAt: string;
    ageHours: number;
    windowHours: number;
  };
  humanApprovalRequired: boolean;
  executableNow: false;
  prediction?: PredictionExplanationDetails;
  visualHooks: {
    classificationLabel: string;
    confidencePercent: number;
    evidenceCount: number;
    freshnessLabel: "Current" | "Stale";
    approvalLabel: "Human approval required" | "Informational only";
  };
}
