import { describe, expect, it } from "vitest";
import { assemblePlatformContext } from "../assembler";
import type { ContextFragment } from "../types";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  portfolioId: "portfolio-west",
  projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  workItemId: "commissioning-readiness",
  interactionId: "meeting-2026-07-15",
};

const fragments: ContextFragment[] = [
  {
    id: "org-policy",
    level: "organization",
    scope: { organizationId: scope.organizationId },
    key: "approval_threshold",
    value: "owner",
    summary: "Organization policy requires owner approval for commissioning readiness exceptions.",
    sourceRef: "policy:governance-2026",
    evidenceRefs: ["document:governance-policy"],
    observedAt: "2026-07-01T00:00:00Z",
    expiresAt: "2027-01-01T00:00:00Z",
    authorized: true,
    sanitized: true,
  },
  {
    id: "project-exception",
    level: "project",
    scope: { organizationId: scope.organizationId, projectId: scope.projectId },
    key: "approval_threshold",
    value: "owner_and_safety_lead",
    summary: "The project charter additionally requires Safety Lead approval for commissioning exceptions.",
    sourceRef: "charter:denver-dc:v3",
    evidenceRefs: ["charter:version-3"],
    observedAt: "2026-07-14T18:00:00Z",
    expiresAt: "2026-12-31T00:00:00Z",
    authorized: true,
    sanitized: true,
  },
  {
    id: "active-blocker",
    level: "work_item",
    scope: { organizationId: scope.organizationId, projectId: scope.projectId, workItemId: scope.workItemId },
    key: "active_blocker",
    value: "BMS alarm verification incomplete",
    summary: "BMS alarm verification remains incomplete and blocks integrated systems testing.",
    sourceRef: "task:commissioning-readiness",
    evidenceRefs: ["event:blocker-registered-42", "task:commissioning-readiness"],
    observedAt: "2026-07-15T13:45:00Z",
    expiresAt: "2026-07-16T13:45:00Z",
    authorized: true,
    sanitized: true,
  },
  {
    id: "expired-status",
    level: "project",
    scope: { organizationId: scope.organizationId, projectId: scope.projectId },
    key: "project_status",
    value: "on_track",
    summary: "An old report marked the project on track.",
    sourceRef: "status-report:2026-01",
    evidenceRefs: ["report:january"],
    observedAt: "2026-01-15T00:00:00Z",
    expiresAt: "2026-02-01T00:00:00Z",
    authorized: true,
    sanitized: true,
  },
  {
    id: "foreign-project",
    level: "project",
    scope: { organizationId: scope.organizationId, projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    key: "budget",
    value: 9000000,
    summary: "A different project's budget.",
    sourceRef: "project:foreign",
    evidenceRefs: ["budget:foreign"],
    observedAt: "2026-07-15T00:00:00Z",
    authorized: true,
    sanitized: true,
  },
];

describe("P8-T1A context hierarchy and assembly", () => {
  it("assembles scoped context and resolves conflicts by specificity", () => {
    const result = assemblePlatformContext({ scope, assembledAt: "2026-07-15T14:00:00Z" }, fragments);
    expect(result.status).toBe("partial");
    expect(result.fragments.map((fragment) => fragment.id)).toEqual(["active-blocker", "project-exception"]);
    expect(result.conflicts).toEqual([{
      key: "approval_threshold",
      selectedFragmentId: "project-exception",
      rejectedFragmentIds: ["org-policy"],
      resolution: "most_specific_then_freshest",
    }]);
    expect(result.excludedFragmentIds).toEqual(expect.arrayContaining(["expired-status", "foreign-project"]));
    expect(result.evidenceRefs).toEqual(expect.arrayContaining(["event:blocker-registered-42", "charter:version-3"]));
  });

  it("enforces deterministic context budgets", () => {
    const result = assemblePlatformContext({
      scope,
      assembledAt: "2026-07-15T14:00:00Z",
      maximumFragments: 1,
      maximumSummaryCharacters: 500,
    }, fragments);
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].id).toBe("active-blocker");
    expect(result.truncated).toBe(true);
    expect(result.limitations).toContain("context_budget_truncated");
  });

  it("returns denied when all matching context is unauthorized", () => {
    const result = assemblePlatformContext({ scope, assembledAt: "2026-07-15T14:00:00Z" }, [{
      ...fragments[2], id: "raw-meeting", authorized: false, sanitized: false,
    }]);
    expect(result.status).toBe("denied");
    expect(result.fragments).toEqual([]);
  });
});
