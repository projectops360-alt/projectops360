import { describe, expect, it } from "vitest";
import {
  KNOWN_PROCESS_HISTORIES,
  validateAllKnownHistories,
  validateKnownHistory,
} from "..";

describe("P4-T3 known-history validation", () => {
  it.each(KNOWN_PROCESS_HISTORIES)("matches golden mining truth for $id", async (scenario) => {
    const report = await validateKnownHistory(scenario);
    expect(report.passed, JSON.stringify(report.checks.filter((check) => !check.passed), null, 2)).toBe(true);
    expect(report.evidenceRefs).toHaveLength(scenario.events.length);
    expect(report.englishAnswer).toMatch(/does not prove causality/i);
    expect(report.spanishAnswer).toMatch(/no demuestra causalidad/i);
  });

  it("validates the complete known-history corpus without hidden failures", async () => {
    const reports = await validateAllKnownHistories(KNOWN_PROCESS_HISTORIES);
    expect(reports).toHaveLength(4);
    expect(reports.every((report) => report.passed)).toBe(true);
    expect(reports.flatMap((report) => report.checks).every((check) => check.passed)).toBe(true);
  });

  it("detects expectation drift instead of blessing changed output", async () => {
    const scenario = structuredClone(KNOWN_PROCESS_HISTORIES[0]);
    scenario.expected.directFollowCount = 99;
    const report = await validateKnownHistory(scenario);
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "direct_follow_count")).toMatchObject({ passed: false, expected: 99, actual: 2 });
  });
});
