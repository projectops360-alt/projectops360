import { describe, expect, it } from "vitest";
import type { MilestoneFlowDetectionFinding } from "@/lib/milestone-flow/delay-detector-types";
import { mapMpfFindingToKnowledgeProposal } from "../mpf-proposal";

describe("MPF knowledge proposal mapping", () => {
  it("creates a deterministic proposal without approving it", () => {
    const finding = {
      findingId: "finding-1", transitionId: "transition-1", projectId: "11111111-1111-4111-8111-111111111111",
      organizationId: "22222222-2222-4222-8222-222222222222", findingType: "blocker", status: "open", severity: "high",
      confidence: "high", startedAt: null, endedAt: null, durationMs: 100, isOpen: true, sourceSegmentIds: [],
      sourceEventIds: ["33333333-3333-4333-8333-333333333333"], evidenceRefs: [], metricRefs: ["metrics.waiting"],
      semanticCategories: [], calculationNotes: [], warnings: [],
    } satisfies MilestoneFlowDetectionFinding;
    const first = mapMpfFindingToKnowledgeProposal(finding);
    const retry = mapMpfFindingToKnowledgeProposal(finding);
    expect(retry).toEqual(first);
    expect(first).toMatchObject({ knowledgeType: "finding", idempotencyKey: "mpf-finding:finding-1", provenance: { captureMethod: "derived" } });
    expect(first.evidence.map((item) => item.type)).toEqual(["engine_finding", "project_event", "metric"]);
    expect(first).not.toHaveProperty("status");
  });
});
