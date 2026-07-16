import { describe, expect, it } from "vitest";
import { evaluateMemoryRetention, retrieveGovernedMemory } from "../policy";
import type { GovernedMemoryItem } from "../types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const memories: GovernedMemoryItem[] = [
  {
    id: "charter-v3",
    organizationId,
    projectId,
    boundary: "project_record",
    sensitivity: "internal",
    sourceType: "approved_charter",
    sourceRef: "charter:denver-dc:v3",
    safeSummary: "Commissioning exceptions require Owner and Safety Lead approval.",
    rawContentAvailable: true,
    evidenceRefs: ["charter:version-3"],
    capturedAt: "2026-07-14T18:00:00Z",
    expiresAt: null,
    legalHold: false,
    humanValidated: true,
    consentRecorded: true,
  },
  {
    id: "meeting-summary",
    organizationId,
    projectId,
    interactionId: "meeting-2026-07-15",
    boundary: "interaction",
    sensitivity: "confidential",
    sourceType: "meeting_summary",
    sourceRef: "rhythm:commissioning-2026-07-15",
    safeSummary: "Owner requested BMS alarm verification evidence before integrated systems testing.",
    rawContentAvailable: true,
    evidenceRefs: ["meeting:commissioning", "task:bms-verification"],
    capturedAt: "2026-07-15T14:00:00Z",
    expiresAt: "2026-08-14T14:00:00Z",
    legalHold: false,
    humanValidated: true,
    consentRecorded: true,
  },
  {
    id: "raw-transcript",
    organizationId,
    projectId,
    interactionId: "meeting-2026-07-15",
    boundary: "interaction",
    sensitivity: "restricted",
    sourceType: "meeting_transcript",
    sourceRef: "transcript:commissioning-private",
    safeSummary: "Restricted transcript retained for authorized human audit only.",
    rawContentAvailable: true,
    evidenceRefs: ["audio:commissioning"],
    capturedAt: "2026-07-15T14:00:00Z",
    expiresAt: "2026-08-14T14:00:00Z",
    legalHold: false,
    humanValidated: false,
    consentRecorded: true,
  },
  {
    id: "expired-scratchpad",
    organizationId,
    projectId,
    boundary: "working",
    sensitivity: "internal",
    sourceType: "agent_working_note",
    sourceRef: "working:old-risk-draft",
    safeSummary: "Outdated draft risk note.",
    rawContentAvailable: false,
    evidenceRefs: [],
    capturedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2026-01-08T00:00:00Z",
    legalHold: false,
    humanValidated: false,
    consentRecorded: true,
  },
];

describe("P8-T1B memory boundaries and retention", () => {
  it("retrieves project memory without exposing raw content", () => {
    const result = retrieveGovernedMemory({
      organizationId,
      projectId,
      interactionId: "meeting-2026-07-15",
      actorType: "ai",
      purpose: "Build sanitized commissioning context.",
      asOf: "2026-07-15T16:00:00Z",
      includeBoundaries: ["project_record", "interaction", "working"],
    }, memories);
    expect(result.items.map((item) => item.id)).toEqual(["meeting-summary", "charter-v3"]);
    expect(result.items.every((item) => item.rawContentIncluded === false)).toBe(true);
    expect(result.excludedItemIds).toEqual(expect.arrayContaining(["raw-transcript", "expired-scratchpad"]));
    expect(result.limitations).toEqual(expect.arrayContaining([
      "raw_memory_content_never_returned",
      "restricted_memory_excluded:raw-transcript",
    ]));
  });

  it("rejects project-bound raw memory promoted as organizational learning", () => {
    const decision = evaluateMemoryRetention({
      ...memories[0],
      id: "invalid-org-memory",
      boundary: "organizational_learning",
      humanValidated: true,
    }, "2026-07-15T16:00:00Z");
    expect(decision.status).toBe("reject");
    expect(decision.reasons).toContain("organizational_memory_requires_validated_deidentified_learning");
  });

  it("preserves legal-hold memory regardless of expiry", () => {
    const decision = evaluateMemoryRetention({ ...memories[3], legalHold: true }, "2026-07-15T16:00:00Z");
    expect(decision).toEqual({ itemId: "expired-scratchpad", status: "legal_hold", reasons: ["legal_hold"], expiresAt: null });
  });
});
