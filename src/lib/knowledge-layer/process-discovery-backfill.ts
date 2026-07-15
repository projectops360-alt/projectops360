import { discoverProcess, type DiscoveryEvent } from "@/lib/process-mining/discovery";
import { createKnowledgeObjectSchema } from "./contracts";
import type {
  CreateKnowledgeObjectInput,
  KnowledgeConfidence,
  KnowledgeEvidenceInput,
  KnowledgeObjectType,
} from "./types";

export interface KnowledgeBackfillEvent extends DiscoveryEvent {
  evidenceRef: string;
}

export const PROCESS_DISCOVERY_KNOWLEDGE_BACKFILL_VERSION = "1.0.0";

function evidence(events: readonly KnowledgeBackfillEvent[]): KnowledgeEvidenceInput[] {
  const seen = new Set<string>();
  return [...events].sort((left, right) => left.sequenceNumber - right.sequenceNumber).slice(0, 250).flatMap((event) => {
    if (seen.has(event.evidenceRef)) return [];
    seen.add(event.evidenceRef);
    const confidence: KnowledgeConfidence = event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT" ? "medium" : "high";
    return [{
      type: "project_event",
      ref: event.evidenceRef,
      role: "supports",
      confidence,
      note: `${event.eventType} in canonical case ${event.caseId}, sequence ${event.sequenceNumber}.`,
      metadata: { eventId: event.eventId, eventType: event.eventType, caseId: event.caseId, sequenceNumber: event.sequenceNumber },
    }];
  });
}

function proposal(input: {
  projectId: string;
  maxSequence: number;
  slug: string;
  knowledgeType: KnowledgeObjectType;
  title: string;
  summary: string;
  body: string;
  structuredContent: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  confidenceReason: string;
  evidence: KnowledgeEvidenceInput[];
}): CreateKnowledgeObjectInput {
  const result: CreateKnowledgeObjectInput = {
    projectId: input.projectId,
    knowledgeType: input.knowledgeType,
    idempotencyKey: `process-discovery-backfill:${PROCESS_DISCOVERY_KNOWLEDGE_BACKFILL_VERSION}:${input.slug}:seq-${input.maxSequence}`,
    title: input.title,
    summary: input.summary,
    body: input.body,
    structuredContent: input.structuredContent,
    confidence: input.confidence,
    confidenceReason: input.confidenceReason,
    provenance: {
      captureMethod: "derived",
      sourceKind: "canonical_process_discovery",
      sourceRef: `project:${input.projectId}:through-sequence:${input.maxSequence}`,
      engineName: "process-discovery",
      engineVersion: PROCESS_DISCOVERY_KNOWLEDGE_BACKFILL_VERSION,
      configVersion: "initial-project-snapshot-v1",
      dataQualityFlags: [],
    },
    evidence: input.evidence,
    proposalRationale: "Generated from deterministic canonical event analysis for human review. No validation or activation is implied.",
  };
  return createKnowledgeObjectSchema.parse(result);
}

export function buildProcessDiscoveryKnowledgeProposals(
  events: readonly KnowledgeBackfillEvent[],
  organizationId: string,
  projectId: string,
): CreateKnowledgeObjectInput[] {
  if (events.length === 0) return [];
  const discovery = discoverProcess(events, organizationId, projectId);
  if (discovery.quality.usedEvents === 0) return [];
  const minableEvents = events.filter((event) => event.lifecycleClass === "BUSINESS_EVENT" && !event.isCompensatingEvent);
  const maxSequence = Math.max(...events.map((event) => event.sequenceNumber));
  const eventEvidence = evidence(minableEvents);
  const syntheticCount = events.filter((event) => event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT").length;
  const confidence: KnowledgeConfidence = discovery.quality.unknownActivities === 0
    && discovery.quality.excludedEvents === 0
    && syntheticCount === 0
    ? "high"
    : "medium";
  const confidenceReason = confidence === "high"
    ? "All included events are canonical business events with known activity taxonomy."
    : "The snapshot contains excluded, synthetic, or unknown-taxonomy events; conclusions remain reviewable observations.";
  const measurable = discovery.temporalMetrics.filter((item) => item.cycleTimeMs !== null);
  const explicitWaits = discovery.temporalMetrics.filter((item) => item.explicitWaitingTimeMs !== null);
  const reworkVariants = discovery.variants.filter((variant) => variant.reworkRate > 0);

  const proposals: CreateKnowledgeObjectInput[] = [
    proposal({
      projectId, maxSequence, slug: "baseline", knowledgeType: "finding",
      title: "Canonical process history baseline",
      summary: `${discovery.quality.usedEvents} canonical business events across ${discovery.quality.cases} cases were analyzed through sequence ${maxSequence}.`,
      body: "This baseline records the bounded canonical event window used by Process Discovery. It reports observed history only and does not infer causality, intent, or future outcomes.",
      structuredContent: { quality: discovery.quality, maxSequence, syntheticCount },
      confidence, confidenceReason, evidence: eventEvidence,
    }),
    proposal({
      projectId, maxSequence, slug: "direct-follow", knowledgeType: "pattern",
      title: "Observed direct-follow process map",
      summary: `${discovery.directFollow.length} unique direct-follow relations were observed across ${discovery.quality.cases} cases.`,
      body: "Each relation means one activity was recorded immediately after another within the same canonical case. Direct-follow is temporal succession only; it is not proof that the first activity caused the second.",
      structuredContent: { directFollow: discovery.directFollow },
      confidence, confidenceReason, evidence: eventEvidence,
    }),
    proposal({
      projectId, maxSequence, slug: "variants", knowledgeType: "pattern",
      title: "Observed execution variants",
      summary: `${discovery.variants.length} exact activity-sequence variants were observed across ${discovery.quality.cases} cases.`,
      body: "Variants group cases with the same observed activity sequence. Frequency and repeated-activity rates are descriptive; no variant is labeled best, successful, or causal without an explicit outcome model.",
      structuredContent: { variants: discovery.variants },
      confidence, confidenceReason, evidence: eventEvidence,
    }),
  ];

  if (measurable.length > 0) {
    proposals.push(proposal({
      projectId, maxSequence, slug: "temporal", knowledgeType: "finding",
      title: "Observed process timing baseline",
      summary: `${measurable.length} cases have measurable business cycle time; ${explicitWaits.length} contain matched explicit waiting intervals.`,
      body: "Cycle time uses occurred_at business timestamps. Recording span uses recorded_at separately. Waiting time is included only when explicit wait-start and wait-end events are both present; event gaps are never assumed to be waiting.",
      structuredContent: { temporalMetrics: discovery.temporalMetrics },
      confidence, confidenceReason, evidence: eventEvidence,
    }));
  }

  if (reworkVariants.length > 0) {
    proposals.push(proposal({
      projectId, maxSequence, slug: "rework", knowledgeType: "finding",
      title: "Observed repeated-activity pattern",
      summary: `${reworkVariants.length} variants contain repeated activities and are flagged as observed rework patterns.`,
      body: "Repeated activity is an observed process pattern. It does not identify who caused the repetition or why it occurred; those claims require separate corroborating evidence.",
      structuredContent: { variants: reworkVariants },
      confidence, confidenceReason, evidence: eventEvidence,
    }));
  }

  return proposals;
}
