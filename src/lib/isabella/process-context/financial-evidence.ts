import "server-only";

import { getFinancialFeatureStateFromProcess } from "@/lib/financial/flags";
import {
  buildFinancialIntelligenceContext,
  type FinancialIntelligenceContext,
} from "@/lib/financial/intelligence";
import { getFinancialCockpitSummary } from "@/lib/financial/read-model.server";
import type {
  IsabellaCitation,
  IsabellaEvidencePacket,
} from "@/lib/isabella/process-intelligence/types";
import {
  buildIsabellaCitation,
  buildIsabellaEvidencePacket,
  safeRef,
} from "./evidence-builder";
import type { IsabellaProjectScope } from "./types";

export type IsabellaFinancialEvidenceOutcome =
  | {
      ok: true;
      context: FinancialIntelligenceContext;
      packets: IsabellaEvidencePacket[];
      citations: IsabellaCitation[];
      limitations: string[];
    }
  | {
      ok: false;
      reason: "feature_disabled" | "unavailable";
      limitations: string[];
    };

export async function getIsabellaFinancialEvidence(
  scope: IsabellaProjectScope,
): Promise<IsabellaFinancialEvidenceOutcome> {
  if (!getFinancialFeatureStateFromProcess(scope.projectId).isabella) {
    return {
      ok: false,
      reason: "feature_disabled",
      limitations: ["financial_intelligence_feature_disabled"],
    };
  }

  const summary = await getFinancialCockpitSummary(scope.organizationId, scope.projectId);
  if (!summary) {
    return {
      ok: false,
      reason: "unavailable",
      limitations: ["financial_cockpit_projection_unavailable"],
    };
  }

  const context = buildFinancialIntelligenceContext(summary);
  const reference = safeRef("financial", scope.projectId);
  const summaryText = [
    `Currency ${summary.currency}`,
    `current baseline ${summary.currentBaseline ?? "not available"}`,
    `authorized funding ${summary.authorizedFunding}`,
    `current commitment ${summary.currentCommitment}`,
    `actual cost ${summary.actualCost}`,
    `open accrual ${summary.openAccrual}`,
    `settled payments ${summary.settledPayments}`,
    `quality ${summary.qualityStatus}`,
  ].join("; ");

  return {
    ok: true,
    context,
    packets: [
      buildIsabellaEvidencePacket({
        evidenceId: `financial-summary:${scope.projectId}:${summary.dataDate ?? "current"}`,
        evidenceType: "status_report",
        sourceKind: "deterministic_project_data",
        sourceId: reference,
        projectId: scope.projectId,
        organizationId: scope.organizationId,
        title: "Financial control summary",
        summary: summaryText,
        citationLabel: "Canonical financial projections",
        citationRef: reference,
        occurredAt: summary.dataDate,
        confidence: "verified",
        allowedClaims: ["factual_project_data", "status_summary"],
        disallowedClaims: ["root_cause_claim", "recommendation_claim"],
        limitations: context.limitations,
      }),
    ],
    citations: [
      buildIsabellaCitation({
        sourceLabel: "Canonical financial projections",
        entityType: "status_report",
        entityTitle: "Financial control summary",
        safeRef: reference,
        occurredAt: summary.dataDate,
        confidence: "verified",
      }),
    ],
    limitations: context.limitations,
  };
}
