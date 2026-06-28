import { describe, it, expect } from "vitest";
import {
  resolveCloseoutState,
  primaryCtaFor,
  activeStepIndex,
  readinessCtaRoute,
  type CloseoutStateInput,
} from "../closeout-workflow";

// UX-010 — guided closeout workflow state machine.

function input(p: Partial<CloseoutStateInput>): CloseoutStateInput {
  return { hasAnyData: true, readinessReady: false, closingMeeting: "none", hasNarrative: false, ...p };
}

describe("UX-010 — resolveCloseoutState", () => {
  it("no data → not_started", () => {
    expect(resolveCloseoutState(input({ hasAnyData: false }))).toBe("not_started");
  });
  it("data but requirements pending → readiness_incomplete", () => {
    expect(resolveCloseoutState(input({ readinessReady: false }))).toBe("readiness_incomplete");
  });
  it("requirements met, no meeting → ready_for_closing_meeting", () => {
    expect(resolveCloseoutState(input({ readinessReady: true, closingMeeting: "none" }))).toBe("ready_for_closing_meeting");
  });
  it("closing meeting scheduled → meeting_scheduled", () => {
    expect(resolveCloseoutState(input({ closingMeeting: "scheduled" }))).toBe("meeting_scheduled");
  });
  it("closing meeting completed, no narrative → meeting_completed", () => {
    expect(resolveCloseoutState(input({ closingMeeting: "completed" }))).toBe("meeting_completed");
  });
  it("narrative present → report_ready (even if a meeting is also completed)", () => {
    expect(resolveCloseoutState(input({ closingMeeting: "completed", hasNarrative: true }))).toBe("report_ready");
  });
  it("exported + narrative → exported (workflow complete, not stalled on review)", () => {
    expect(resolveCloseoutState(input({ hasNarrative: true, exported: true }))).toBe("exported");
  });
  it("exported flag is ignored until a report exists", () => {
    expect(resolveCloseoutState(input({ hasNarrative: false, exported: true }))).not.toBe("exported");
  });
});

describe("UX-010 — primaryCtaFor (state-appropriate primary action)", () => {
  it("no meeting → Create Closing Project Meeting", () => {
    expect(primaryCtaFor("readiness_incomplete")).toBe("create_meeting");
    expect(primaryCtaFor("ready_for_closing_meeting")).toBe("create_meeting");
    expect(primaryCtaFor("not_started")).toBe("create_meeting");
  });
  it("meeting scheduled → Open Closing Project Meeting", () => {
    expect(primaryCtaFor("meeting_scheduled")).toBe("open_meeting");
  });
  it("meeting completed but no narrative → Generate Executive Summary", () => {
    expect(primaryCtaFor("meeting_completed")).toBe("generate_summary");
  });
  it("report ready → Download PDF", () => {
    expect(primaryCtaFor("report_ready")).toBe("download_pdf");
    expect(primaryCtaFor("exported")).toBe("download_pdf");
  });
});

describe("UX-010 — activeStepIndex advances with state", () => {
  it("monotonic across the happy path", () => {
    const order = [
      activeStepIndex("readiness_incomplete"),
      activeStepIndex("ready_for_closing_meeting"),
      activeStepIndex("meeting_completed"),
      activeStepIndex("report_ready"),
    ];
    expect(order).toEqual([1, 2, 3, 4]);
  });
  it("exported marks every step complete (index past the last step → all checked)", () => {
    // 6 steps (0..5); returning 6 means none is 'current', all are 'done'.
    expect(activeStepIndex("exported")).toBe(6);
    expect(activeStepIndex("exported")).toBeGreaterThan(activeStepIndex("report_ready"));
  });
});

describe("UX-010 — readinessCtaRoute maps to REAL routes only (no dead links)", () => {
  it("maps known checks to per-project routes", () => {
    expect(readinessCtaRoute("open_tasks")).toBe("/workboard");
    expect(readinessCtaRoute("blockers")).toBe("/workboard");
    expect(readinessCtaRoute("milestones")).toBe("/execution-map");
    expect(readinessCtaRoute("decisions")).toBe("/decisions");
    expect(readinessCtaRoute("budget")).toBe("/budget");
    expect(readinessCtaRoute("follow_ups")).toBe("/communications");
  });
  it("REG-017 — open_risks has NO route (inline disclosure, /execution-map showed no risks)", () => {
    expect(readinessCtaRoute("open_risks")).toBeNull();
  });
  it("returns null where there is no dedicated route (detail-only, no dead CTA)", () => {
    expect(readinessCtaRoute("open_rfis")).toBeNull();
    expect(readinessCtaRoute("submittals")).toBeNull();
    expect(readinessCtaRoute("unknown_key")).toBeNull();
  });
});
