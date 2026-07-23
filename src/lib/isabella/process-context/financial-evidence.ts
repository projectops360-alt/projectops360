import "server-only";

import { getFinancialFeatureStateFromProcess } from "@/lib/financial/flags";
import {
  buildFinancialSetupIntelligence,
  buildFinancialIntelligenceContext,
  type FinancialIntelligenceContext,
} from "@/lib/financial/intelligence";
import { getFinancialCockpitSummary } from "@/lib/financial/read-model.server";
import { getFinancialSetupDraft } from "@/lib/financial/setup-read-model.server";
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

function setupSummaryText(setup: FinancialIntelligenceContext["setup"]): string {
  if (!setup || setup.status === "not_configured") {
    return "PMO financial setup not configured; no estimate, rate model, planned hours, BOE, or baseline package is recorded by this setup flow.";
  }
  return [
    `setup status ${setup.status}`,
    `estimate ${setup.title ?? "untitled"}`,
    `AACE class ${setup.estimateClass ?? "not specified"}`,
    `currency ${setup.currency}`,
    `lines ${setup.lineCount}`,
    `total ${setup.totalAmount ?? "not available"}`,
    `planned hours ${setup.totalPlannedHours ?? "not entered"}`,
    `BOE ${setup.boeStatus ?? "not available"}`,
    `baselines ${Object.entries(setup.baselineStatuses).map(([type, status]) => `${type}:${status}`).join(", ") || "not available"}`,
    `line model ${setup.lines.slice(0, 12).map((line) => `${line.name}=${line.amount} ${setup.currency}; rate ${line.rate}/${line.rateUnit}; ${line.periodBasis} x ${line.periodCount}; hours ${line.plannedHours ?? "n/a"}`).join(" | ") || "none"}`,
  ].join("; ");
}

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

  const setup = buildFinancialSetupIntelligence(await getFinancialSetupDraft(scope.organizationId, scope.projectId));
  const setupReference = safeRef("financial_setup", scope.projectId);
  const setupText = setupSummaryText(setup);
  const summary = await getFinancialCockpitSummary(scope.organizationId, scope.projectId);
  if (!summary) {
    const limitations = ["financial_cockpit_projection_unavailable", "financial_context_is_read_only"];
    return {
      ok: true,
      context: {
        projectId: scope.projectId,
        asOfDate: null,
        facts: [],
        setup,
        limitations,
        allowedOperations: ["explain", "compare", "trace"],
        prohibitedOperations: ["approve", "post", "release", "reopen", "execute"],
      },
      packets: [
        buildIsabellaEvidencePacket({
          evidenceId: `financial-setup:${scope.projectId}:${setup.estimateId ?? "none"}`,
          evidenceType: "status_report",
          sourceKind: "deterministic_project_data",
          sourceId: setupReference,
          projectId: scope.projectId,
          organizationId: scope.organizationId,
          title: "Financial setup and rate model",
          summary: setupText,
          citationLabel: "PMO financial setup",
          citationRef: setupReference,
          confidence: "verified",
          allowedClaims: ["factual_project_data", "status_summary"],
          disallowedClaims: ["root_cause_claim", "recommendation_claim"],
          limitations,
        }),
      ],
      citations: [
        buildIsabellaCitation({
          sourceLabel: "PMO financial setup",
          entityType: "status_report",
          entityTitle: "Financial setup and rate model",
          safeRef: setupReference,
          confidence: "verified",
        }),
      ],
      limitations,
    };
  }

  const context = buildFinancialIntelligenceContext(summary, setup);
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
      buildIsabellaEvidencePacket({
        evidenceId: `financial-setup:${scope.projectId}:${setup.estimateId ?? "none"}`,
        evidenceType: "status_report",
        sourceKind: "deterministic_project_data",
        sourceId: setupReference,
        projectId: scope.projectId,
        organizationId: scope.organizationId,
        title: "Financial setup and rate model",
        summary: setupText,
        citationLabel: "PMO financial setup",
        citationRef: setupReference,
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
      buildIsabellaCitation({
        sourceLabel: "PMO financial setup",
        entityType: "status_report",
        entityTitle: "Financial setup and rate model",
        safeRef: setupReference,
        confidence: "verified",
      }),
    ],
    limitations: context.limitations,
  };
}
