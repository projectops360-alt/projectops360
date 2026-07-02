// ============================================================================
// ProjectOps360° — MPF Engine · Flow Segment Builder (Phase 3, Task 3)
// ============================================================================
// Builds ordered flow segments inside a milestone transition corridor from the
// Task 2 event semantics. Pure + deterministic: it never re-derives event
// meanings (it calls classifyMilestoneFlowEvent), never mutates events, and
// never touches the DB / project_event_log / process_nodes / process_edges.
//
// It does NOT compute durations or metrics (durationMs stays null — that is the
// Metrics Calculator's job in a later task). Segment types reuse the Task 1
// vocabulary. Unknown events yield unknown segments; nothing is silently dropped.
// ============================================================================

import { classifyMilestoneFlowEvent, buildMilestoneFlowEvidenceRefFromEvent } from "./event-semantics";
import { aggregateConfidence } from "./evidence";
import { MPF_DEFAULT_CONFIDENCE } from "./constants";
import type { MilestoneFlowEventRef, MilestoneFlowEvidenceRef, MilestoneFlowSegmentType } from "./types";
import type { MilestoneFlowSemanticCategory } from "./event-semantics-types";
import type { BuiltMilestoneFlowSegment } from "./transition-builder-types";

/** Parse an ISO timestamp to epoch ms; invalid/missing → +Infinity (sorts last). */
function isoTime(s: string | null | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function isValidIso(s: string | null | undefined): boolean {
  return !!s && Number.isFinite(Date.parse(s));
}

/**
 * (9) Sort events deterministically by occurrence time, with eventId as a stable
 * secondary key. Events with missing/invalid timestamps sort last (still stable).
 */
export function normalizeMilestoneFlowEventOrder(events: readonly MilestoneFlowEventRef[]): MilestoneFlowEventRef[] {
  return [...events].sort((a, b) => {
    const ta = isoTime(a.occurredAt);
    const tb = isoTime(b.occurredAt);
    if (ta !== tb) return ta - tb;
    return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
  });
}

/** (8) Deterministic segment id — stable for replay. */
export function createMilestoneFlowSegmentId(
  transitionId: string,
  segmentIndex: number,
  segmentType: MilestoneFlowSegmentType,
  sourceEventId: string | null,
): string {
  return `${transitionId}__seg${segmentIndex}_${segmentType}_${sourceEventId ?? "na"}`;
}

interface OpenSegment {
  type: MilestoneFlowSegmentType;
  events: MilestoneFlowEventRef[];
  frictionType: string | null;
  startedAt: string | null;
}

/**
 * (4) Build ordered flow segments for one transition from its assigned events.
 * A new segment begins whenever the semantic flow-segment type changes (this
 * naturally opens blocked/decision/approval/rework segments and closes them on
 * the resolving event, which classifies as active_work). Nothing is dropped.
 *
 * @param closesAt When the transition completed — closes the final segment.
 */
export function buildFlowSegmentsForTransition(
  transitionId: string,
  events: readonly MilestoneFlowEventRef[],
  options: { closesAt?: string | null } = {},
): BuiltMilestoneFlowSegment[] {
  const ordered = normalizeMilestoneFlowEventOrder(events);
  const segments: BuiltMilestoneFlowSegment[] = [];
  let open: OpenSegment | null = null;
  let index = 0;

  const finalize = (closingEvent: MilestoneFlowEventRef | null): void => {
    if (!open) return;
    const evidence: MilestoneFlowEvidenceRef[] = [];
    const categories = new Set<MilestoneFlowSemanticCategory>();
    for (const ev of open.events) {
      const ref = buildMilestoneFlowEvidenceRefFromEvent(ev);
      if (ref) evidence.push(ref);
      categories.add(classifyMilestoneFlowEvent(ev).semanticCategory);
    }
    const sourceEventId = open.events[0]?.eventId ?? null;
    const endedAt = closingEvent
      ? closingEvent.occurredAt
      : options.closesAt ?? null;
    segments.push({
      segmentId: createMilestoneFlowSegmentId(transitionId, index, open.type, sourceEventId),
      transitionId,
      type: open.type,
      startedAt: isValidIso(open.startedAt) ? open.startedAt : null,
      endedAt: isValidIso(endedAt) ? endedAt : null,
      durationMs: null, // deferred to the Metrics Calculator (later task)
      frictionType: (open.frictionType as BuiltMilestoneFlowSegment["frictionType"]) ?? null,
      evidence,
      sourceEventId,
      closingEventId: closingEvent?.eventId ?? null,
      semanticCategories: [...categories],
      confidence: evidence.length ? aggregateConfidence(evidence) : MPF_DEFAULT_CONFIDENCE,
      notes: `segment:${open.type} opened_by:${open.events[0]?.eventType ?? "unknown"} events:${open.events.length}`,
      isOpenEnded: closingEvent === null && !isValidIso(options.closesAt),
    });
    index += 1;
    open = null;
  };

  for (const ev of ordered) {
    const cls = classifyMilestoneFlowEvent(ev);
    const type = cls.flowSegmentType;
    if (open && open.type === type) {
      open.events.push(ev);
      continue;
    }
    // Type changed → the boundary event closes the previous segment and opens a new one.
    finalize(ev);
    open = {
      type,
      events: [ev],
      frictionType: cls.frictionType ?? null,
      startedAt: ev.occurredAt,
    };
  }
  finalize(null); // close the last (open-ended unless closesAt provided)

  return segments;
}
