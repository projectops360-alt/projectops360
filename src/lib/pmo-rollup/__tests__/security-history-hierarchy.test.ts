import { describe, expect, it } from "vitest";
import { getPmoAggregateSnapshot, PmoRollupAccessError } from "../engine";
import {
  BASE_REQUEST,
  ORG_A,
  ORG_B,
  PMO_ACCESS,
  hierarchyFixture,
  project,
} from "../__fixtures__/canonical-fixtures";

describe("PMO security, history, and hierarchy", () => {
  it("filters cross-tenant project and realtime/process facts from metrics and lineage", () => {
    const foreignProject = project("foreign", {
      factId: "foreign-project-fact",
      organizationId: ORG_B,
    });
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, {
      access: {
        ...PMO_ACCESS,
        authorizedProjectIds: ["p-a", "foreign"],
      },
      projects: [project("p-a"), foreignProject],
      processCases: [{
        factId: "foreign-realtime-fact",
        organizationId: ORG_B,
        projectId: "foreign",
        caseId: "foreign-case",
        status: "active",
        eventCount: 1,
        hasRework: false,
        startedAt: "2026-03-01T00:00:00.000Z",
        lastEventAt: "2026-03-01T00:00:00.000Z",
      }],
    });
    expect(snapshot.metrics.total_projects.value).toBe(1);
    expect(snapshot.lineage.sourceFactIds).not.toContain("foreign-project-fact");
    expect(snapshot.lineage.sourceFactIds).not.toContain("foreign-realtime-fact");
    expect(snapshot.lineage.excludedFactIds).not.toContain("foreign-project-fact");
  });

  it("denies cross-organization and unauthorized project detail requests", () => {
    expect(() => getPmoAggregateSnapshot(
      { ...BASE_REQUEST, organizationId: ORG_B },
      { access: PMO_ACCESS, projects: [project("p-a")] },
    )).toThrow(PmoRollupAccessError);

    expect(() => getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "project", entityId: "p-z" },
      { access: PMO_ACCESS, projects: [project("p-a")] },
    )).toThrow(PmoRollupAccessError);
  });

  it("withholds financial facts when financial.view is absent", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, {
      access: {
        ...PMO_ACCESS,
        authorizedProjectIds: ["p-a"],
        capabilities: [],
      },
      projects: [project("p-a")],
      financialFacts: [{
        factId: "restricted-financial",
        organizationId: ORG_A,
        projectId: "p-a",
        dataDate: "2026-03-01",
        actualCost: { amount: 999, currency: "USD", sourceId: "secret" },
        formulaVersion: "restricted",
      }],
    });
    expect(snapshot.metrics.actual_cost.value).toBeNull();
    expect(snapshot.metrics.actual_cost.sourceEntityIds).toEqual([]);
    expect(snapshot.metrics.actual_cost.explanation).toContain("lacks financial.view");
  });

  it("reconstructs reproducible historical snapshots without future facts", () => {
    const input = {
      access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a"] },
      projects: [
        project("p-a", {
          factId: "p-a:jan",
          status: "planning" as const,
          effectiveAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        project("p-a", {
          factId: "p-a:mar",
          status: "active" as const,
          effectiveAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        }),
      ],
    };
    const januaryRequest = {
      ...BASE_REQUEST,
      periodEnd: "2026-01-31",
      asOf: "2026-01-31T23:59:59.000Z",
    };
    const january = getPmoAggregateSnapshot(januaryRequest, input);
    const januaryAgain = getPmoAggregateSnapshot(januaryRequest, input);
    const march = getPmoAggregateSnapshot(BASE_REQUEST, input);
    expect(january.metrics.planned_projects.value).toBe(1);
    expect(january.metrics.active_projects.value).toBe(0);
    expect(march.metrics.planned_projects.value).toBe(0);
    expect(march.metrics.active_projects.value).toBe(1);
    expect(january.snapshotId).toBe(januaryAgain.snapshotId);
    expect(january.formulaVersions.total_projects).toBeTruthy();
    expect(january.lineage.sourceFactIds).not.toContain("p-a:mar");
  });

  it("reconciles project to program to portfolio to organization for additive metrics", () => {
    const input = hierarchyFixture();
    const organization = getPmoAggregateSnapshot(BASE_REQUEST, input);
    const portfolio1 = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "portfolio", entityId: "portfolio-1" },
      input,
    );
    const portfolio2 = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "portfolio", entityId: "portfolio-2" },
      input,
    );
    const program1 = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "program", entityId: "program-1" },
      input,
    );
    const program2 = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "program", entityId: "program-2" },
      input,
    );

    expect(organization.metrics.approved_budget.value).toBe(600);
    expect((portfolio1.metrics.approved_budget.value ?? 0) + (portfolio2.metrics.approved_budget.value ?? 0))
      .toBe(organization.metrics.approved_budget.value);
    expect((program1.metrics.approved_budget.value ?? 0) + (program2.metrics.approved_budget.value ?? 0))
      .toBe(organization.metrics.approved_budget.value);
    expect(organization.metrics.total_projects.value).toBe(3);
    expect(organization.metrics.portfolios.value).toBe(2);
    expect(organization.metrics.programs.value).toBe(2);
  });

  it("explains why deduplicated shared entities are not a blind child sum", () => {
    const input = hierarchyFixture();
    const organization = getPmoAggregateSnapshot(BASE_REQUEST, input);
    const portfolio1 = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "portfolio", entityId: "portfolio-1" },
      input,
    );
    const portfolio2 = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, hierarchyLevel: "portfolio", entityId: "portfolio-2" },
      input,
    );
    expect(organization.metrics.unique_risks.value).toBe(1);
    expect((portfolio1.metrics.unique_risks.value ?? 0) + (portfolio2.metrics.unique_risks.value ?? 0))
      .toBe(2);
    expect(organization.metrics.unique_risks.explanation).toContain("deduplicated");
    expect(organization.lineage.deduplicationRules).toContain("risk_id");
  });
});
