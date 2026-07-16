import { describe, expect, it } from "vitest";
import { normalizeCommunication } from "../ingestion";
import { buildCommunicationKnowledgeCandidates, reviewCommunicationKnowledgeCandidate } from "../knowledge-extraction";

const ownerEmail = normalizeCommunication({
  organizationId: "11111111-1111-4111-8111-111111111111",
  projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sourceType: "email",
  sourceExternalId: "outlook:AAMkAGI2-commissioning-20260715",
  sourceRef: "communication:owner-commissioning-email",
  sender: "Owner Commissioning Lead",
  recipients: ["Project Manager", "Safety Lead", "Project Manager"],
  subject: "Integrated systems testing readiness",
  content: `Team,

Do not start integrated systems testing until the BMS alarm verification report is approved by the Safety Lead.
Diego will submit the report by July 18. The owner will decide whether the test may proceed after reviewing that evidence.

Regards,
Owner Commissioning Lead`,
  occurredAt: "2026-07-15T13:30:00Z",
  recordedAt: "2026-07-15T13:31:12Z",
  consentRecorded: true,
});

describe("P8-T2A communication ingestion", () => {
  it("normalizes and deduplicates a real project communication deterministically", () => {
    expect(ownerEmail.recipients).toEqual(["Project Manager", "Safety Lead"]);
    expect(ownerEmail.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(ownerEmail.provenance.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(normalizeCommunication({
      organizationId: ownerEmail.organizationId,
      projectId: ownerEmail.projectId,
      sourceType: ownerEmail.sourceType,
      sourceExternalId: ownerEmail.sourceExternalId,
      sourceRef: ownerEmail.sourceRef,
      sender: ownerEmail.sender,
      recipients: ownerEmail.recipients,
      subject: ownerEmail.subject,
      content: ownerEmail.normalizedContent,
      occurredAt: ownerEmail.occurredAt,
      recordedAt: ownerEmail.recordedAt,
      consentRecorded: true,
    }).fingerprint).toBe(ownerEmail.fingerprint);
  });
});

describe("P8-T2B communication knowledge candidates", () => {
  it("creates traceable candidates that remain pending human validation", () => {
    const candidates = buildCommunicationKnowledgeCandidates(ownerEmail, [
      {
        type: "commitment",
        statement: "Diego will submit the BMS alarm verification report by July 18.",
        sourceExcerpt: "Diego will submit the report by July 18.",
        confidence: 0.98,
        structuredContent: { owner: "Diego", dueDate: "2026-07-18" },
      },
      {
        type: "decision",
        statement: "The owner retains the decision to authorize integrated systems testing.",
        sourceExcerpt: "The owner will decide whether the test may proceed after reviewing that evidence.",
        confidence: 0.96,
      },
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.status === "needs_review")).toBe(true);
    expect(candidates.every((candidate) => candidate.executableNow === false)).toBe(true);
    expect(candidates[0].evidenceRefs).toContain(ownerEmail.sourceRef);
    const review = reviewCommunicationKnowledgeCandidate(candidates[0], {
      decision: "accepted",
      actorId: "33333333-3333-4333-8333-333333333333",
      actorRole: "admin",
      rationale: "Verified verbatim against the owner email and project schedule.",
      reviewedAt: "2026-07-15T15:00:00Z",
    });
    expect(review).toMatchObject({ actorType: "human", createsKnowledgeAutomatically: false });
  });

  it("rejects hallucinated candidates without a verbatim source excerpt", () => {
    expect(() => buildCommunicationKnowledgeCandidates(ownerEmail, [{
      type: "risk",
      statement: "The owner approved an August 1 completion delay.",
      sourceExcerpt: "Approved delay until August 1",
      confidence: 0.9,
    }])).toThrow("communication_candidate_excerpt_not_verbatim");
  });
});
