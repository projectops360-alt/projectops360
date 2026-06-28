// ============================================================================
// ProjectOps360° — Closeout workflow state (UX-010) — pure, client-safe
// ============================================================================
// Turns the closeout inputs (readiness, closing-meeting status, narrative
// presence) into a single state + the right primary CTA, so the Closeout Report
// page GUIDES the PM instead of only saying what is missing. Pure & unit-tested.
// ============================================================================

export type CloseoutMeetingStatus = "none" | "scheduled" | "completed";

export type CloseoutState =
  | "not_started"
  | "readiness_incomplete"
  | "ready_for_closing_meeting"
  | "meeting_scheduled"
  | "meeting_completed"
  | "report_ready"
  | "exported";

export type CloseoutCta =
  | "create_meeting"
  | "open_meeting"
  | "generate_summary"
  | "download_pdf";

export interface CloseoutStateInput {
  /** The project has any closeout-relevant data (tasks/milestones/etc.). */
  hasAnyData: boolean;
  /** Readiness gate passed (no blocking failures). */
  readinessReady: boolean;
  /** Latest closing-meeting status. */
  closingMeeting: CloseoutMeetingStatus;
  /** An AI executive summary / narrative already exists on the closing meeting. */
  hasNarrative: boolean;
  /** The report has been exported (PDF downloaded) at least once. */
  exported?: boolean;
}

/** Resolve the single closeout workflow state (precedence: exported → narrative → meeting → readiness). */
export function resolveCloseoutState(i: CloseoutStateInput): CloseoutState {
  if (i.exported && i.hasNarrative) return "exported";
  if (i.hasNarrative) return "report_ready";
  if (i.closingMeeting === "completed") return "meeting_completed";
  if (i.closingMeeting === "scheduled") return "meeting_scheduled";
  if (i.readinessReady) return "ready_for_closing_meeting";
  if (i.hasAnyData) return "readiness_incomplete";
  return "not_started";
}

/** The single primary CTA appropriate to the current state. */
export function primaryCtaFor(state: CloseoutState): CloseoutCta {
  switch (state) {
    case "report_ready":
    case "exported":
      return "download_pdf";
    case "meeting_completed":
      return "generate_summary";
    case "meeting_scheduled":
      return "open_meeting";
    default:
      return "create_meeting"; // not_started / readiness_incomplete / ready_for_closing_meeting
  }
}

/** The six workflow steps, with which are complete given the state. */
export const CLOSEOUT_STEP_KEYS = [
  "check_readiness",
  "resolve_requirements",
  "closing_meeting",
  "generate_summary",
  "review_report",
  "download_pdf",
] as const;
export type CloseoutStepKey = (typeof CLOSEOUT_STEP_KEYS)[number];

/** Index (0-based) of the current/active step for the given state. */
export function activeStepIndex(state: CloseoutState): number {
  switch (state) {
    case "not_started":
    case "readiness_incomplete":
      return 1; // resolve requirements
    case "ready_for_closing_meeting":
    case "meeting_scheduled":
      return 2; // closing meeting
    case "meeting_completed":
      return 3; // generate summary
    case "report_ready":
      return 4; // review
    case "exported":
      return 6; // all six steps complete (past the last index → every step checked)
    default:
      return 0;
  }
}

/**
 * Project-relative route to resolve a failing readiness check, or null when there
 * is no dedicated route (then the UI shows the detail without a dead CTA).
 * Routes are real per-project pages only — never fabricated.
 */
export function readinessCtaRoute(key: string): string | null {
  switch (key) {
    case "open_tasks":
    case "blockers":
      return "/workboard";
    case "milestones":
      return "/execution-map";
    // REG-017 — open_risks intentionally has NO route: there is no risk-register
    // page, and /execution-map never showed risks, so routing there was a dead
    // end (count said "2 open risks" but the destination showed none). The
    // Closeout page now discloses the exact open-risk records inline instead.
    case "open_risks":
      return null;
    case "open_actions":
      return "/meetings";
    case "follow_ups":
      return "/communications";
    case "decisions":
      return "/decisions";
    case "budget":
      return "/budget";
    // open_rfis, submittals — no dedicated per-project route; detail only.
    default:
      return null;
  }
}
