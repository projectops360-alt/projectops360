import { describe, expect, it } from "vitest";
import { adaptCanonicalEventsForDiscovery, analyzeConformance, buildProcessTaxonomy, calculateTemporalMetrics, discoverCaseVariants, discoverDirectFollow, discoverProcess, type DeclaredProcessModel, type DiscoveryEvent } from "..";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";

const org = "org-1"; const project = "project-1";
function event(caseId: string, sequenceNumber: number, eventType: string, hour: number): DiscoveryEvent {
  return { eventId: `${caseId}-${sequenceNumber}`, organizationId: org, projectId: project, caseId, eventType, eventCategory: "task", occurredAt: `2026-01-01T${String(hour).padStart(2, "0")}:00:00Z`, recordedAt: `2026-01-01T${String(hour + 1).padStart(2, "0")}:00:00Z`, sequenceNumber, lifecycleClass: "BUSINESS_EVENT", isCompensatingEvent: false };
}
const events = [event("a", 1, "TaskCreated", 0), event("a", 2, "TaskBlocked", 1), event("a", 3, "TaskUnblocked", 3), event("a", 4, "TaskCompleted", 5), event("b", 5, "TaskCreated", 0), event("b", 6, "TaskCompleted", 4)];
const model: DeclaredProcessModel = { modelId: "task", allowedStarts: ["TaskCreated"], allowedEnds: ["TaskCompleted"], allowedTransitions: [["TaskCreated", "TaskBlocked"], ["TaskBlocked", "TaskUnblocked"], ["TaskUnblocked", "TaskCompleted"], ["TaskCreated", "TaskCompleted"]], requiredActivities: ["TaskCreated", "TaskCompleted"] };

describe("P4-T1 modular process discovery", () => {
  it("classifies canonical activities and retains unknowns honestly", () => {
    expect(buildProcessTaxonomy(["TaskCreated", "CustomSignal"])).toEqual([
      { eventType: "CustomSignal", family: "other", temporalRole: "neutral", canonical: false },
      { eventType: "TaskCreated", family: "task", temporalRole: "start", canonical: true },
    ]);
  });
  it("builds deterministic direct-follow relations and variants by case", () => {
    expect(discoverDirectFollow(events)).toHaveLength(4);
    expect(discoverCaseVariants(events)).toMatchObject([{ caseCount: 1 }, { caseCount: 1 }]);
    expect(discoverCaseVariants(events)).toEqual(discoverCaseVariants([...events].reverse()));
  });
  it("reports conformance deviations instead of inventing a successful path", () => {
    expect(analyzeConformance(events, model).every((item) => item.conformant)).toBe(true);
    const invalid = analyzeConformance([event("x", 1, "TaskStarted", 0)], model)[0];
    expect(invalid.conformant).toBe(false); expect(invalid.deviations.map((item) => item.type)).toEqual(expect.arrayContaining(["invalid_start", "invalid_end", "missing_required_activity"]));
  });
  it("separates business cycle, recording span and explicit waiting", () => {
    const metrics = calculateTemporalMetrics(events).find((item) => item.caseId === "a")!;
    expect(metrics.cycleTimeMs).toBe(5 * 60 * 60 * 1000); expect(metrics.explicitWaitingTimeMs).toBe(2 * 60 * 60 * 1000); expect(metrics.touchTimeMs).toBe(3 * 60 * 60 * 1000);
  });
  it("orchestrates all modules and rejects cross-project input", () => {
    expect(discoverProcess(events, org, project, model)).toMatchObject({ quality: { cases: 2, usedEvents: 6 }, conformance: [{ conformant: true }, { conformant: true }] });
    expect(() => discoverProcess([{ ...events[0], projectId: "other" }], org, project, model)).toThrow("process_discovery_scope_mismatch");
  });
  it("adapts only complete canonical event records", () => {
    const canonical = {
      ...events[0],
      objectRefs: [],
      dataQualityFlags: [],
    } as unknown as LivingGraphCanonicalEvent;
    const result = adaptCanonicalEventsForDiscovery([canonical, { ...canonical, eventId: "missing", recordedAt: null }]);
    expect(result.events).toHaveLength(1);
    expect(result.excludedEventIds).toEqual(["missing"]);
  });
});
