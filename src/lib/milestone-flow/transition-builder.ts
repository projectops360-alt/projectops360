// ============================================================================
// ProjectOps360° — MPF Engine · Milestone Transition Builder (Phase 3, Task 3)
// ============================================================================
// Turns read-only milestone refs + Project Event Graph event refs (+ Task 2
// semantics) into milestone transition corridors and their flow segments. Pure +
// deterministic + replay-stable: same inputs + same engine/config version →
// identical output. It CONSUMES Task 2 semantics (never re-derives event
// meanings), never mutates inputs, and never touches project_event_log /
// process_nodes / process_edges.
//
// It builds STRUCTURE only. It does NOT compute final metrics, final transition
// health, bottlenecks, or constraint propagation — those are later Phase 3 tasks.
// Missing/ambiguous evidence yields warnings + unknown, never fabricated certainty.
// ============================================================================

import {
  MPF_ENGINE_VERSION,
  MPF_CONFIG_VERSION,
  MPF_DEFAULT_CONFIDENCE,
} from "./constants";
import {
  MpfMissingOrganizationScopeError,
  MpfMissingProjectScopeError,
  MpfInvalidEventInputError,
  MpfInvalidMilestoneInputError,
} from "./errors";
import { aggregateConfidence } from "./evidence";
import {
  isMilestoneTransitionClosingEvent,
  isMilestoneFlowReworkEvent,
  getMilestoneFlowEventSemantics,
} from "./event-semantics";
import {
  buildFlowSegmentsForTransition,
  normalizeMilestoneFlowEventOrder,
} from "./flow-segment-builder";
import type {
  MilestoneFlowProjectScope,
  MilestoneFlowMilestoneRef,
  MilestoneFlowEventRef,
  MilestoneTransitionState,
  MilestoneTransitionStatus,
  MilestoneFlowEvidenceRef,
  MilestoneFlowEngineWarning,
} from "./types";
import type { MilestoneFlowEngineConfig } from "./contracts";
import type {
  BuiltMilestoneTransition,
  BuiltMilestoneFlowSegment,
  MilestoneFlowEventAssignment,
  UnassignedMilestoneFlowEvent,
  MilestoneTransitionBuildResult,
} from "./transition-builder-types";

// ── Input ─────────────────────────────────────────────────────────────────────

export interface MilestoneTransitionBuilderInput {
  scope: MilestoneFlowProjectScope;
  milestones: MilestoneFlowMilestoneRef[];
  events: MilestoneFlowEventRef[];
  config: MilestoneFlowEngineConfig;
}

// ── Small pure helpers ────────────────────────────────────────────────────────

function isoTime(s: string | null | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function isValidIso(s: string | null | undefined): boolean {
  return !!s && Number.isFinite(Date.parse(s));
}

/** The best-known date for ordering a milestone: actual → forecast → planned. */
function milestoneDateKey(m: MilestoneFlowMilestoneRef): string | null {
  return m.actualDate ?? m.forecastDate ?? m.plannedDate ?? null;
}

/** The milestone this event pertains to, when explicit (payload or milestone subject). */
function eventMilestoneId(ev: MilestoneFlowEventRef): string | null {
  if (ev.milestoneId) return ev.milestoneId;
  if (ev.subjectType === "milestone" && ev.subjectId) return ev.subjectId;
  return null;
}

// ── (7/2) Transition id + pairing ─────────────────────────────────────────────

/** (7) Deterministic transition id — stable across runs for replay comparison. */
export function createMilestoneTransitionId(
  sourceMilestoneId: string | null,
  targetMilestoneId: string,
  projectId: string,
): string {
  return `mpf_tr_${projectId}_${sourceMilestoneId ?? "start"}_to_${targetMilestoneId}`;
}

/** Order milestones deterministically; returns whether a real ordering signal existed. */
export function orderMilestonesDeterministically(
  milestones: readonly MilestoneFlowMilestoneRef[],
): { ordered: MilestoneFlowMilestoneRef[]; canOrder: boolean } {
  if (milestones.length <= 1) return { ordered: [...milestones], canOrder: true };

  const someDates = milestones.some((m) => milestoneDateKey(m) != null);
  const somePredecessors = milestones.some((m) => !!m.predecessorMilestoneId);

  if (!someDates && !somePredecessors) {
    // No date and no predecessor link → order is genuinely unknown. Do not invent.
    return { ordered: [], canOrder: false };
  }

  if (someDates) {
    const ordered = [...milestones].sort((a, b) => {
      const ta = isoTime(milestoneDateKey(a));
      const tb = isoTime(milestoneDateKey(b));
      if (ta !== tb) return ta - tb;
      return a.milestoneId < b.milestoneId ? -1 : a.milestoneId > b.milestoneId ? 1 : 0;
    });
    return { ordered, canOrder: true };
  }

  // No dates but a predecessor chain exists → topological order (pred before succ).
  return { ordered: orderByPredecessorChain(milestones), canOrder: true };
}

function orderByPredecessorChain(
  milestones: readonly MilestoneFlowMilestoneRef[],
): MilestoneFlowMilestoneRef[] {
  const byId = new Map(milestones.map((m) => [m.milestoneId, m]));
  const indegree = new Map<string, number>();
  for (const m of milestones) indegree.set(m.milestoneId, 0);
  for (const m of milestones) {
    if (m.predecessorMilestoneId && byId.has(m.predecessorMilestoneId)) {
      indegree.set(m.milestoneId, (indegree.get(m.milestoneId) ?? 0) + 1);
    }
  }
  const byIdSort = (a: MilestoneFlowMilestoneRef, b: MilestoneFlowMilestoneRef) =>
    a.milestoneId < b.milestoneId ? -1 : a.milestoneId > b.milestoneId ? 1 : 0;
  const queue = milestones.filter((m) => (indegree.get(m.milestoneId) ?? 0) === 0).sort(byIdSort);
  const result: MilestoneFlowMilestoneRef[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const m = queue.shift()!;
    if (seen.has(m.milestoneId)) continue;
    seen.add(m.milestoneId);
    result.push(m);
    const successors = milestones
      .filter((s) => s.predecessorMilestoneId === m.milestoneId && !seen.has(s.milestoneId))
      .sort(byIdSort);
    for (const s of successors) {
      const d = (indegree.get(s.milestoneId) ?? 1) - 1;
      indegree.set(s.milestoneId, d);
      if (d <= 0) queue.push(s);
    }
    queue.sort(byIdSort);
  }
  // Any milestones left (cycle/orphan) appended deterministically by id.
  for (const m of [...milestones].sort(byIdSort)) {
    if (!seen.has(m.milestoneId)) result.push(m);
  }
  return result;
}

export interface MilestoneTransitionPair {
  transitionId: string;
  sourceMilestoneId: string;
  targetMilestoneId: string;
}

/** (2) Consecutive source → target pairs from ordered milestones. */
export function buildMilestoneTransitionPairs(
  milestones: readonly MilestoneFlowMilestoneRef[],
  projectId: string,
): { pairs: MilestoneTransitionPair[]; warnings: MilestoneFlowEngineWarning[] } {
  const warnings: MilestoneFlowEngineWarning[] = [];
  const { ordered, canOrder } = orderMilestonesDeterministically(milestones);

  if (!canOrder) {
    warnings.push({
      code: "MISSING_MILESTONE_ORDER",
      message: "Milestone order cannot be determined (no dates or predecessor links); no transitions built.",
    });
    return { pairs: [], warnings };
  }
  if (ordered.length <= 1) {
    if (ordered.length === 1) {
      warnings.push({
        code: "SINGLE_MILESTONE_NO_TRANSITION",
        message: "Only one milestone; no source → target corridor exists.",
      });
    }
    return { pairs: [], warnings };
  }

  const pairs: MilestoneTransitionPair[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const source = ordered[i].milestoneId;
    const target = ordered[i + 1].milestoneId;
    pairs.push({
      transitionId: createMilestoneTransitionId(source, target, projectId),
      sourceMilestoneId: source,
      targetMilestoneId: target,
    });
  }
  return { pairs, warnings };
}

// ── (10) Event assignment ─────────────────────────────────────────────────────

/** Time at which a milestone was achieved (closing event, then actualDate). */
function milestoneAchievedTime(
  milestoneId: string,
  milestones: Map<string, MilestoneFlowMilestoneRef>,
  events: readonly MilestoneFlowEventRef[],
): string | null {
  let best: string | null = null;
  for (const ev of events) {
    if (eventMilestoneId(ev) === milestoneId && isMilestoneTransitionClosingEvent(ev)) {
      if (best == null || isoTime(ev.occurredAt) < isoTime(best)) best = ev.occurredAt;
    }
  }
  if (best) return best;
  return milestones.get(milestoneId)?.actualDate ?? null;
}

interface CorridorWindow {
  pair: MilestoneTransitionPair;
  start: number; // epoch or -Inf
  end: number; // epoch or +Inf
}

/** (10) Machine-readable reason a given event belongs (or not) to a transition. */
export function explainMilestoneFlowEventAssignment(
  event: MilestoneFlowEventRef,
  transition: MilestoneTransitionPair,
): string {
  const mid = eventMilestoneId(event);
  if (mid && mid === transition.targetMilestoneId) return "explicit_milestone_target";
  if (mid && mid === transition.sourceMilestoneId) return "explicit_milestone_source";
  return "no_explicit_milestone_match";
}

/** (3) Assign events to corridors with explicit reasons. */
export function assignEventsToMilestoneTransitions(
  events: readonly MilestoneFlowEventRef[],
  pairs: readonly MilestoneTransitionPair[],
  milestones: Map<string, MilestoneFlowMilestoneRef>,
): {
  assignments: MilestoneFlowEventAssignment[];
  byTransition: Map<string, MilestoneFlowEventRef[]>;
  unassigned: UnassignedMilestoneFlowEvent[];
} {
  const assignments: MilestoneFlowEventAssignment[] = [];
  const byTransition = new Map<string, MilestoneFlowEventRef[]>();
  const unassigned: UnassignedMilestoneFlowEvent[] = [];
  for (const p of pairs) byTransition.set(p.transitionId, []);

  // Precompute corridor time windows (source achieved → target achieved).
  const windows: CorridorWindow[] = pairs.map((p) => {
    const startIso = milestoneAchievedTime(p.sourceMilestoneId, milestones, events);
    const endIso = milestoneAchievedTime(p.targetMilestoneId, milestones, events);
    return {
      pair: p,
      start: startIso ? isoTime(startIso) : Number.NEGATIVE_INFINITY,
      end: endIso ? isoTime(endIso) : Number.POSITIVE_INFINITY,
    };
  });

  const targetIndex = new Map(pairs.map((p) => [p.targetMilestoneId, p]));
  const sourceIndex = new Map(pairs.map((p) => [p.sourceMilestoneId, p]));

  const assign = (ev: MilestoneFlowEventRef, transitionId: string, reason: string) => {
    byTransition.get(transitionId)!.push(ev);
    assignments.push({ eventId: ev.eventId, transitionId, reason });
  };

  for (const ev of events) {
    // 1. Explicit milestone — prefer target match, then source match.
    const mid = eventMilestoneId(ev);
    if (mid) {
      const t = targetIndex.get(mid);
      if (t) { assign(ev, t.transitionId, "explicit_milestone_target"); continue; }
      const s = sourceIndex.get(mid);
      if (s) { assign(ev, s.transitionId, "explicit_milestone_source"); continue; }
      unassigned.push({
        eventId: ev.eventId,
        reason: "UNASSIGNED_EVENT",
        detail: `milestone ${mid} is not part of any transition corridor`,
      });
      continue;
    }

    // 2. Timestamp within a corridor window.
    if (!isValidIso(ev.occurredAt)) {
      unassigned.push({
        eventId: ev.eventId,
        reason: "MISSING_EVENT_TIMESTAMP",
        detail: "event has no valid timestamp and no explicit milestone",
      });
      continue;
    }
    const t = isoTime(ev.occurredAt);
    const matches = windows.filter((w) => t >= w.start && t < w.end);
    if (matches.length === 1) {
      assign(ev, matches[0].pair.transitionId, "timestamp_within_corridor");
      continue;
    }
    if (matches.length > 1) {
      // Ambiguous — pick the narrowest window (most specific), stable by transitionId.
      const chosen = matches
        .slice()
        .sort((a, b) => (a.end - a.start) - (b.end - b.start) ||
          (a.pair.transitionId < b.pair.transitionId ? -1 : 1))[0];
      assign(ev, chosen.pair.transitionId, "timestamp_ambiguous_narrowest_window");
      continue;
    }
    unassigned.push({
      eventId: ev.eventId,
      reason: "UNASSIGNED_EVENT",
      detail: "no corridor window contains the event timestamp",
    });
  }

  return { assignments, byTransition, unassigned };
}

/** (11) Return unassigned events + reasons for a set of events vs corridors. */
export function collectUnassignedMilestoneFlowEvents(
  events: readonly MilestoneFlowEventRef[],
  pairs: readonly MilestoneTransitionPair[],
  milestones: Map<string, MilestoneFlowMilestoneRef>,
): UnassignedMilestoneFlowEvent[] {
  return assignEventsToMilestoneTransitions(events, pairs, milestones).unassigned;
}

// ── (6) Preliminary transition state (NOT final health) ───────────────────────

/**
 * (6) Derive a PRELIMINARY transition state from segments + completion flags.
 * This is structural state only — final health classification is a later task.
 */
export function classifyTransitionStateFromSegments(
  segments: readonly BuiltMilestoneFlowSegment[],
  flags: { completed: boolean; regressed: boolean },
): MilestoneTransitionState {
  const last = segments[segments.length - 1] ?? null;
  const currentSegmentType = last?.type ?? null;
  const isBlocked = !!last && last.type === "blocked" && last.isOpenEnded;
  const lastEventAt = last?.endedAt ?? last?.startedAt ?? null;

  let status: MilestoneTransitionStatus;
  if (flags.regressed) status = "regressed";
  else if (flags.completed) status = "completed";
  else if (segments.length === 0) status = "pending";
  else if (segments.every((s) => s.type === "unknown")) status = "unknown";
  else status = "active";

  return { status, currentSegmentType, isBlocked, lastEventAt };
}

// ── (5) Segments for all transitions ──────────────────────────────────────────

export function buildFlowSegmentsForTransitions(
  transitionsWithEvents: readonly { transitionId: string; events: MilestoneFlowEventRef[]; closesAt: string | null }[],
): Map<string, BuiltMilestoneFlowSegment[]> {
  const out = new Map<string, BuiltMilestoneFlowSegment[]>();
  for (const t of transitionsWithEvents) {
    out.set(t.transitionId, buildFlowSegmentsForTransition(t.transitionId, t.events, { closesAt: t.closesAt }));
  }
  return out;
}

// ── (12) Input validation ─────────────────────────────────────────────────────

/** (12) Validate builder input structure (throws typed MpfError on hard failure). */
export function validateMilestoneTransitionBuilderInput(input: MilestoneTransitionBuilderInput): void {
  if (!input.scope || !input.scope.organizationId) throw new MpfMissingOrganizationScopeError();
  if (!input.scope.projectId) throw new MpfMissingProjectScopeError();
  if (!Array.isArray(input.events)) {
    throw new MpfInvalidEventInputError("events must be an array of read-only event refs.");
  }
  for (const e of input.events) {
    if (!e || typeof e.eventId !== "string" || typeof e.eventType !== "string") {
      throw new MpfInvalidEventInputError("each event ref requires eventId and eventType.");
    }
  }
  if (!Array.isArray(input.milestones)) {
    throw new MpfInvalidMilestoneInputError("milestones must be an array of read-only milestone refs.");
  }
  for (const m of input.milestones) {
    if (!m || typeof m.milestoneId !== "string") {
      throw new MpfInvalidMilestoneInputError("each milestone ref requires milestoneId.");
    }
  }
}

// ── (1) Main builder ──────────────────────────────────────────────────────────

/** (1) Build transition corridors + flow segments from milestones + events. */
export function buildMilestoneTransitions(
  input: MilestoneTransitionBuilderInput,
): MilestoneTransitionBuildResult {
  validateMilestoneTransitionBuilderInput(input);

  const projectId = input.scope.projectId;
  const milestoneMap = new Map(input.milestones.map((m) => [m.milestoneId, m]));
  const warnings: MilestoneFlowEngineWarning[] = [];

  const { pairs, warnings: pairWarnings } = buildMilestoneTransitionPairs(input.milestones, projectId);
  warnings.push(...pairWarnings);

  const { assignments, byTransition, unassigned } = assignEventsToMilestoneTransitions(
    input.events,
    pairs,
    milestoneMap,
  );

  // Surface each unassigned event + unknown-semantics events as warnings.
  for (const u of unassigned) {
    warnings.push({ code: u.reason, message: `event ${u.eventId}: ${u.detail}` });
  }
  for (const ev of input.events) {
    if (getMilestoneFlowEventSemantics(ev).semanticCategory === "unknown") {
      warnings.push({ code: "UNKNOWN_EVENT_SEMANTICS", message: `event ${ev.eventType} has no flow semantics (handled as unknown)` });
    }
  }

  const transitions: BuiltMilestoneTransition[] = [];
  let segmentCount = 0;
  let unknownSegmentCount = 0;
  let openTransitionCount = 0;
  let completedTransitionCount = 0;

  for (const pair of pairs) {
    const assigned = normalizeMilestoneFlowEventOrder(byTransition.get(pair.transitionId) ?? []);

    // Completion + regression from evidence (never fabricated).
    const completedAtIso = milestoneAchievedTime(pair.targetMilestoneId, milestoneMap, assigned);
    const completed = completedAtIso != null;
    const regressed =
      completed &&
      assigned.some(
        (ev) => isMilestoneFlowReworkEvent(ev) && isoTime(ev.occurredAt) > isoTime(completedAtIso),
      );
    if (!completed) {
      warnings.push({
        code: "TRANSITION_BOUNDARY_INCOMPLETE",
        message: `transition ${pair.transitionId} has no target-achieved evidence (kept open)`,
        transitionId: pair.transitionId,
      });
    }

    const segments = buildFlowSegmentsForTransition(pair.transitionId, assigned, {
      closesAt: regressed ? null : completedAtIso,
    });
    segmentCount += segments.length;
    unknownSegmentCount += segments.filter((s) => s.type === "unknown").length;

    const startedAtIso =
      milestoneAchievedTime(pair.sourceMilestoneId, milestoneMap, assigned) ??
      (assigned.find((e) => isValidIso(e.occurredAt))?.occurredAt ?? null);

    const state = classifyTransitionStateFromSegments(segments, { completed, regressed });
    if (state.status === "completed") completedTransitionCount += 1;
    else openTransitionCount += 1;

    const allEvidence: MilestoneFlowEvidenceRef[] = segments.flatMap((s) => s.evidence);
    const confidence = allEvidence.length ? aggregateConfidence(allEvidence) : MPF_DEFAULT_CONFIDENCE;
    const evidenceEventIds = assigned.map((e) => e.eventId);

    transitions.push({
      transitionId: pair.transitionId,
      scope: input.scope,
      sourceMilestoneId: pair.sourceMilestoneId,
      targetMilestoneId: pair.targetMilestoneId,
      startedAt: isValidIso(startedAtIso) ? startedAtIso : null,
      completedAt: completed && !regressed && isValidIso(completedAtIso) ? completedAtIso : null,
      state,
      segments,
      evidenceEventIds,
      orderedEventIds: evidenceEventIds,
      confidence,
      createdByEngineVersion: MPF_ENGINE_VERSION,
      configVersion: input.config?.configVersion ?? MPF_CONFIG_VERSION,
    });
  }

  return {
    transitions,
    assignments,
    unassignedEvents: unassigned,
    warnings,
    stats: {
      transitionCount: transitions.length,
      segmentCount,
      unassignedEventCount: unassigned.length,
      unknownSegmentCount,
      openTransitionCount,
      completedTransitionCount,
    },
  };
}
