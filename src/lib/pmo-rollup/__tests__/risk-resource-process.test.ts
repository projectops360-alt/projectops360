import { describe, expect, it } from "vitest";
import { getPmoAggregateSnapshot } from "../engine";
import {
  BASE_REQUEST,
  processFixture,
  resourceFixture,
  sharedRiskFixture,
} from "../__fixtures__/canonical-fixtures";

describe("PMO risk, resource, and process roll-up", () => {
  it("deduplicates one shared risk across three affected projects", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, sharedRiskFixture());
    expect(snapshot.metrics.unique_risks.value).toBe(1);
    expect(snapshot.metrics.projects_with_critical_risks.value).toBe(3);
    expect(snapshot.metrics.gross_schedule_risk_days.value).toBe(20);
    expect(snapshot.metrics.expected_risk_delay_days.value).toBe(10);
    expect(snapshot.metrics.expected_risk_cost.value).toBe(500);
  });

  it("deduplicates resource capacity by person-period before over-allocation", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, resourceFixture());
    expect(snapshot.metrics.total_resource_capacity.value).toBe(80);
    expect(snapshot.metrics.allocated_capacity.value).toBe(80);
    expect(snapshot.metrics.overallocated_hours.value).toBe(20);
    expect(snapshot.metrics.overallocated_people.value).toBe(1);
    expect(snapshot.metrics.shared_resources.value).toBe(1);
  });

  it("defines rework rate from completed cases, not repeated events or projects", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, processFixture());
    expect(snapshot.metrics.total_cases.value).toBe(3);
    expect(snapshot.metrics.completed_cases.value).toBe(2);
    expect(snapshot.metrics.rework_cases.value).toBe(1);
    expect(snapshot.metrics.rework_rate.value).toBe(50);
    expect(snapshot.metrics.repeated_activities.value).toBe(2);
  });

  it("keeps actual delay, risk exposure, and process waiting as separate metrics", () => {
    const input = processFixture();
    input.riskFacts = sharedRiskFixture().riskFacts?.map((risk) => ({
      ...risk,
      affectedProjectIds: ["p-a"],
    }));
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, input);
    expect(snapshot.metrics.accumulated_delay_days.metricId).toBe("accumulated_delay_days");
    expect(snapshot.metrics.expected_risk_delay_days.value).toBe(10);
    expect(snapshot.metrics.average_waiting_time_days.value).toBe(2);
    expect(snapshot.metrics.average_waiting_time_days.explanation).toContain("separate");
  });

  it("separates current project state from process activity by stage", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, processFixture());
    const execute = snapshot.stageAggregates.find((stage) => stage.stageId === "execute");
    const unmapped = snapshot.stageAggregates.find((stage) => stage.stageId === "unmapped");
    expect(execute?.currentProjectCount).toBe(1);
    expect(execute?.projectsActiveInPeriod).toBe(1);
    expect(unmapped?.currentProjectCount).toBe(0);
    expect(unmapped?.projectsActiveInPeriod).toBe(1);
    expect(unmapped?.warnings).toContain("stage_mapping_required");
  });
});
