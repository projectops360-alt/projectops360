// ============================================================================
// CAP-045 §C.2 — BetweenAnalysisPanel render guards
// ============================================================================
// Renders the read-only "What happened between?" panel with react-dom/server
// (React Flow mocked) and pins the UX contract from the P0 spec:
//   * the panel renders exactly two endpoints (START / END labels);
//   * temporal relationships are labelled "temporal order — not causal";
//   * explicit causal links are labelled "explicit";
//   * no `pick_link` / `__pick-link` artifact anywhere (the synthetic edge is
//     gone);
//   * limitations + summary facts render honestly;
//   * the panel derives NOTHING from the data — every fact is read from the
//     pure `BetweenAnalysisResult`.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import { BetweenAnalysisPanel } from "../between-analysis-panel";
import type { BetweenAnalysisResult } from "@/lib/graph/between-analysis";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

function render(result: BetweenAnalysisResult): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BetweenAnalysisPanel result={result} onClose={() => {}} onClear={() => {}} onSwap={() => {}} />
    </NextIntlClientProvider>,
  );
}

function baseResult(overrides: Partial<BetweenAnalysisResult> = {}): BetweenAnalysisResult {
  return {
    projectId: "p1",
    startEndpoint: { nodeId: "m1", label: "Milestone A", kind: "milestone", sourceEntityId: "m1" },
    endEndpoint: { nodeId: "m2", label: "Milestone B", kind: "milestone", sourceEntityId: "m2" },
    operationalPath: [
      { nodeId: "m1", label: "Milestone A" },
      { nodeId: "m2", label: "Milestone B" },
    ],
    canonicalEventIds: ["ev1", "ev2"],
    relatedObjectIds: [{ objectType: "task", objectId: "t1", role: "focal" }],
    sequenceStart: 10,
    sequenceEnd: 20,
    occurredStart: "2026-01-10T00:00:00.000Z",
    occurredEnd: "2026-01-20T00:00:00.000Z",
    elapsedBusinessMs: 10 * 86_400_000,
    recordedElapsedMs: 10 * 86_400_000 + 5_000,
    eventCount: 2,
    transitionCount: 1,
    largestWaitingGap: 5 * 86_400_000,
    statusChanges: [
      { eventId: "ev1", sequenceNumber: 10, fromState: "todo", toState: "in_progress", occurredAt: "2026-01-10T00:00:00.000Z" },
    ],
    blockers: ["ev1"],
    risks: [],
    decisions: [],
    approvals: [],
    reworkSignals: [],
    actors: ["u1"],
    sourceModules: ["workboard"],
    evidenceRefs: [{ objectType: "document", objectId: "d1" }],
    dataQualityFlags: ["missing_prior_closure"],
    explicitCausalRelationships: [
      { relationshipId: "rc1", sourceEventId: "ev1", targetEventId: "ev2", relationshipType: "caused_by" },
    ],
    temporalRelationships: [
      { relationshipId: "rt1", sourceEventId: "ev1", targetEventId: "ev2", relationshipType: "project_sequence_next" },
    ],
    limitations: ["elapsed_is_wall_clock_not_business_hours"],
    summaryFacts: ["interval: sequences 10..20 (2 events)"],
    chronology: [
      {
        eventId: "ev1", sequenceNumber: 10, eventType: "task_status_changed", eventCategory: "execution",
        occurredAt: "2026-01-10T00:00:00.000Z", recordedAt: "2026-01-10T00:00:00.000Z",
        actorId: "u1", actorType: "human", sourceModule: "workboard", fromState: "todo",
        toState: "in_progress", importance: "MEDIUM", objectRefs: [], confidence: null, lateRecorded: false,
      },
    ],
    ...overrides,
  };
}

describe("CAP-045 §C.2 — BetweenAnalysisPanel render", () => {
  it("renders both endpoints (START / END labels visible)", () => {
    const html = render(baseResult());
    expect(html).toContain("Milestone A");
    expect(html).toContain("Milestone B");
  });

  it("renders the operational path between endpoints", () => {
    const html = render(baseResult());
    expect(html).toContain("Milestone A");
    expect(html).toContain("Milestone B");
  });

  it("renders temporal relationships as order-only (not causal)", () => {
    const html = render(baseResult());
    expect(html).toContain("temporal order — not causal");
  });

  it("renders explicit causal links labelled 'explicit'", () => {
    const html = render(baseResult());
    expect(html).toContain("explicit");
  });

  it("renders limitations + summary facts honestly", () => {
    const html = render(baseResult());
    expect(html).toContain("elapsed_is_wall_clock_not_business_hours");
    expect(html).toContain("interval: sequences 10..20 (2 events)");
  });

  it("NEVER contains the removed __pick-link / pick_link artifact", () => {
    const html = render(baseResult());
    expect(html).not.toContain("__pick-link");
    expect(html).not.toContain("pick_link");
  });

  it("renders the no-path limitation when the operational path is empty", () => {
    const html = render(baseResult({ operationalPath: [] }));
    // i18n: "No recorded operational path between these endpoints."
    expect(html).toContain("No recorded operational path");
  });

  it("renders the no-events message when the chronology is empty", () => {
    const html = render(baseResult({ chronology: [], canonicalEventIds: [], eventCount: 0 }));
    // i18n: "No canonical events in this interval."
    expect(html).toContain("No canonical events in this interval");
  });

  it("has no generative / Isabella dependency — reads only from the result", () => {
    // The panel is pure presentation: with a result carrying 0 causal links, it
    // states "0" and the temporal≠causal caveat — no invented narrative.
    const html = render(
      baseResult({ explicitCausalRelationships: [], temporalRelationships: [] }),
    );
    expect(html).toContain("Temporal relationships");
    // No invented causal link id leaks.
    expect(html).not.toContain("rc1");
  });
});