import { variantIdFor } from "@/lib/process-mining/variants";
import type { DirectFollowRelation, DiscoveryEvent, DiscoveredVariant } from "./types";

export function orderedCaseEvents(events: readonly DiscoveryEvent[]): Map<string, DiscoveryEvent[]> {
  const cases = new Map<string, DiscoveryEvent[]>();
  for (const event of events) cases.set(event.caseId, [...(cases.get(event.caseId) ?? []), event]);
  for (const [caseId, rows] of cases) cases.set(caseId, rows.sort((a, b) => a.sequenceNumber - b.sequenceNumber || a.eventId.localeCompare(b.eventId)));
  return cases;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

export function discoverDirectFollow(events: readonly DiscoveryEvent[]): DirectFollowRelation[] {
  const cases = orderedCaseEvents(events); const map = new Map<string, { source: string; target: string; count: number; cases: Set<string>; elapsed: number[] }>();
  for (const [caseId, rows] of cases) rows.forEach((event, index) => {
    const next = rows[index + 1]; if (!next) return; const key = `${event.eventType}\0${next.eventType}`;
    const item = map.get(key) ?? { source: event.eventType, target: next.eventType, count: 0, cases: new Set<string>(), elapsed: [] };
    item.count += 1; item.cases.add(caseId); const from = event.occurredAt ? Date.parse(event.occurredAt) : NaN; const to = next.occurredAt ? Date.parse(next.occurredAt) : NaN;
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) item.elapsed.push(to - from); map.set(key, item);
  });
  return [...map.values()].map((item) => ({ id: `df:${variantIdFor([item.source, item.target])}`, sourceActivity: item.source, targetActivity: item.target, occurrenceCount: item.count, caseCount: item.cases.size, caseCoveragePct: cases.size ? Math.round(item.cases.size / cases.size * 10000) / 100 : 0, medianElapsedMs: percentile(item.elapsed, .5), p90ElapsedMs: percentile(item.elapsed, .9) })).sort((a, b) => b.caseCount - a.caseCount || a.id.localeCompare(b.id));
}

export function discoverCaseVariants(events: readonly DiscoveryEvent[]): DiscoveredVariant[] {
  const cases = orderedCaseEvents(events); const groups = new Map<string, { signature: string[]; caseIds: string[] }>();
  for (const [caseId, rows] of cases) { const signature = rows.map((row) => row.eventType); const id = variantIdFor(signature); const group = groups.get(id) ?? { signature, caseIds: [] }; group.caseIds.push(caseId); groups.set(id, group); }
  return [...groups.entries()].map(([id, group]) => ({ id, signature: group.signature, caseIds: group.caseIds.sort(), caseCount: group.caseIds.length, frequencyPct: cases.size ? Math.round(group.caseIds.length / cases.size * 10000) / 100 : 0, reworkRate: group.signature.length ? Math.round((group.signature.length - new Set(group.signature).size) / group.signature.length * 10000) / 10000 : 0 })).sort((a, b) => b.caseCount - a.caseCount || a.id.localeCompare(b.id));
}
