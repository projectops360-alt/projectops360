import { classifyProcessActivity } from "./taxonomy";
import { orderedCaseEvents } from "./direct-follow";
import type { CaseTemporalMetrics, DiscoveryEvent } from "./types";

export function calculateTemporalMetrics(events: readonly DiscoveryEvent[]): CaseTemporalMetrics[] {
  return [...orderedCaseEvents(events)].map(([caseId, rows]) => {
    const limitations: string[] = []; const occurred = rows.map((row) => row.occurredAt ? Date.parse(row.occurredAt) : NaN); const recorded = rows.map((row) => Date.parse(row.recordedAt));
    const validOccurred = occurred.filter(Number.isFinite); const validRecorded = recorded.filter(Number.isFinite);
    const cycleTimeMs = validOccurred.length >= 2 ? Math.max(...validOccurred) - Math.min(...validOccurred) : null; if (cycleTimeMs === null) limitations.push("insufficient_business_timestamps");
    const recordingSpanMs = validRecorded.length >= 2 ? Math.max(...validRecorded) - Math.min(...validRecorded) : null;
    let waiting = 0; let waitStart: number | null = null; let matchedWait = false;
    rows.forEach((row) => { const at = row.occurredAt ? Date.parse(row.occurredAt) : NaN; const role = classifyProcessActivity(row.eventType).temporalRole; if (!Number.isFinite(at)) return; if (role === "wait_start") waitStart = at; if (role === "wait_end" && waitStart !== null && at >= waitStart) { waiting += at - waitStart; waitStart = null; matchedWait = true; } });
    if (waitStart !== null) limitations.push("open_wait_interval");
    const explicitWaitingTimeMs = matchedWait ? waiting : null; if (!matchedWait) limitations.push("no_explicit_wait_intervals");
    return { caseId, cycleTimeMs, recordingSpanMs, explicitWaitingTimeMs, touchTimeMs: cycleTimeMs !== null && explicitWaitingTimeMs !== null ? Math.max(0, cycleTimeMs - explicitWaitingTimeMs) : null, eventCount: rows.length, limitations };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
}
