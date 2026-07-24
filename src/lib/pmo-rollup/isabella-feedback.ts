import type {
  IsabellaPmoAggregateContext,
  IsabellaPmoAggregateFeedbackDecision,
  IsabellaPmoAggregateFeedbackRecord,
} from "./contracts";
import type { IsabellaPmoAggregateAnswer } from "./isabella-context";
import { stableHash } from "./math";

export interface BuildIsabellaPmoAggregateFeedbackInput {
  context: IsabellaPmoAggregateContext;
  answer: IsabellaPmoAggregateAnswer;
  question: string;
  decision: IsabellaPmoAggregateFeedbackDecision;
  recordedAt: string;
  knowledgeVersion: string;
  correction?: string;
  outcome?: string;
}

export function buildIsabellaPmoAggregateFeedbackRecord(
  input: BuildIsabellaPmoAggregateFeedbackInput,
): IsabellaPmoAggregateFeedbackRecord {
  if (input.answer.snapshotId !== input.context.snapshotId) {
    throw new Error("Isabella feedback snapshot does not match the aggregate context.");
  }
  const contextMetricIds = new Set(Object.keys(input.context.metrics));
  if (input.answer.metricIds.some((metricId) => !contextMetricIds.has(metricId))) {
    throw new Error("Isabella feedback contains a metric outside the authorized snapshot.");
  }
  if (!input.knowledgeVersion.trim()) {
    throw new Error("Isabella feedback requires a knowledge version.");
  }
  const seed = JSON.stringify({
    organizationId: input.context.organizationId,
    snapshotId: input.context.snapshotId,
    metricIds: input.answer.metricIds,
    question: input.question,
    decision: input.decision,
    recordedAt: input.recordedAt,
    knowledgeVersion: input.knowledgeVersion,
  });
  return {
    feedbackId: `pmo-feedback-${stableHash(seed)}`,
    organizationId: input.context.organizationId,
    snapshotId: input.context.snapshotId,
    metricIds: [...input.answer.metricIds],
    formulaVersions: { ...input.context.formulaVersions },
    question: input.question,
    answer: input.answer.text,
    evidence: input.answer.evidence.map((item) => ({ ...item })),
    confidence: input.answer.confidenceScore,
    decision: input.decision,
    correction: input.correction,
    outcome: input.outcome,
    recordedAt: input.recordedAt,
    knowledgeVersion: input.knowledgeVersion,
  };
}
