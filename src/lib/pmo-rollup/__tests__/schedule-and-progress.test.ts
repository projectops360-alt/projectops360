import { describe, expect, it } from "vitest";
import { getPmoAggregateSnapshot } from "../engine";
import {
  BASE_REQUEST,
  missingDataFixture,
  scheduleFixture,
  weightedProgressFixture,
} from "../__fixtures__/canonical-fixtures";

describe("PMO schedule and progress roll-up", () => {
  it("implements accumulated, average, maximum, and net delay exactly", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, scheduleFixture());
    expect(snapshot.metrics.accumulated_delay_days.value).toBe(30);
    expect(snapshot.metrics.late_project_count.value).toBe(2);
    expect(snapshot.metrics.average_delay_late_projects.value).toBe(15);
    expect(snapshot.metrics.maximum_project_delay_days.value).toBe(20);
    expect(snapshot.metrics.net_schedule_variance_days.value).toBe(25);
  });

  it("uses BAC-weighted progress instead of a simple average", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, weightedProgressFixture());
    expect(snapshot.metrics.portfolio_completion.value).toBe(27);
    expect(snapshot.metrics.portfolio_completion.value).not.toBe(55);
    expect(snapshot.metrics.portfolio_completion.aggregationMethod).toBe("weighted-average");
    expect(snapshot.metrics.portfolio_completion.explanation).toContain("BAC");
  });

  it("excludes missing baselines while preserving project population and confidence", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, missingDataFixture());
    const delay = snapshot.metrics.accumulated_delay_days;
    expect(snapshot.metrics.total_projects.value).toBe(2);
    expect(delay.eligibleCount).toBe(1);
    expect(delay.excludedCount).toBe(1);
    expect(delay.coveragePercent).toBe(50);
    expect(delay.status).toBe("partial");
    expect(delay.confidenceScore).toBeLessThan(1);
    expect(snapshot.dataQuality.warnings).toContain("schedule_baseline_or_forecast_missing");
  });

  it("returns formula, cutoff, coverage, and contributions on every calculated metric", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, scheduleFixture());
    for (const metric of Object.values(snapshot.metrics)) {
      expect(metric.formulaVersion).toBeTruthy();
      expect(metric.asOf).toBe(BASE_REQUEST.asOf);
      expect(metric.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(metric.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(metric.explanation).toBeTruthy();
    }
  });
});
