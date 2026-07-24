// ============================================================================
// PMO Process Intelligence — pure flow projection engine (CAP-047 · M2)
// ============================================================================
// Derives the process map read model (nodes/edges/waiting/rework/bottlenecks/
// dominant path) from PEG event cases. Pure and deterministic: no I/O, no
// mutation of inputs, same inputs → same outputs. Variant discovery is
// delegated to the existing CAP-046 engine — never reimplemented.
// Bottlenecks are CALCULATED from waiting pressure; nothing is decorated.
// ============================================================================

import { analyzeVariants } from "@/lib/process-mining/variants";
import type {
  PmoPiCase,
  PmoPiFlowModel,
  PmoPiProcessEdge,
  PmoPiProcessNode,
  PmoPiScope,
} from "./contracts";
import { PMO_PI_CONTRACT_VERSION } from "./contracts";

/** Only business events feed mining (PD-018 §A.3), never compensating ones. */
function usableEvents(c: PmoPiCase) {
  return [...c.events]
    .filter((e) => e.lifecycleClass === "BUSINESS_EVENT" && !e.isCompensatingEvent)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId));
}

interface NodeAccumulator {
  frequency: number;
  cases: Set<string>;
  incomingWaits: number[];
  reworkOccurrences: number;
}

interface EdgeAccumulator {
  frequency: number;
  cases: Set<string>;
  waits: number[];
  reworkHits: number;
}

/**
 * Build the flow read model for a set of cases.
 * `generatedAt` is injected by the caller so the function stays deterministic.
 */
export function buildFlowModel(
  scope: PmoPiScope,
  cases: readonly PmoPiCase[],
  generatedAt: string,
): PmoPiFlowModel {
  const nodeAcc = new Map<string, NodeAccumulator>();
  const edgeAcc = new Map<string, EdgeAccumulator>();
  let totalEventsSeen = 0;
  let businessEventsUsed = 0;
  let casesWithoutEvents = 0;

  for (const c of cases) {
    totalEventsSeen += c.events.length;
    const events = usableEvents(c);
    businessEventsUsed += events.length;
    if (events.length === 0) {
      casesWithoutEvents++;
      continue;
    }
    const seenActivities = new Set<string>();
    for (let i = 0; i < events.length; i++) {
      const activity = events[i].eventType;
      const node = nodeAcc.get(activity) ?? {
        frequency: 0,
        cases: new Set<string>(),
        incomingWaits: [],
        reworkOccurrences: 0,
      };
      node.frequency++;
      node.cases.add(c.caseId);
      if (seenActivities.has(activity)) node.reworkOccurrences++;
      nodeAcc.set(activity, node);

      if (i > 0) {
        const prev = events[i - 1];
        const waitMs = Date.parse(events[i].occurredAt) - Date.parse(prev.occurredAt);
        const validWait = Number.isFinite(waitMs) && waitMs >= 0 ? waitMs : null;
        if (validWait != null) node.incomingWaits.push(validWait);

        const key = `${prev.eventType}→${activity}`;
        const edge = edgeAcc.get(key) ?? {
          frequency: 0,
          cases: new Set<string>(),
          waits: [],
          reworkHits: 0,
        };
        edge.frequency++;
        edge.cases.add(c.caseId);
        if (validWait != null) edge.waits.push(validWait);
        // Loop: the target activity had already happened earlier in this case.
        if (seenActivities.has(activity)) edge.reworkHits++;
        edgeAcc.set(key, edge);
      }
      seenActivities.add(activity);
    }
  }

  // Variant discovery via the existing CAP-046 engine (cases are compatible
  // by construction: PmoPiEventRecord extends VariantEventRef).
  const variants = analyzeVariants(
    "pmo_process_intelligence",
    cases.map((c) => ({
      caseId: c.caseId,
      caseLabel: c.caseLabel,
      events: c.events,
      outcome: c.outcome,
    })),
  );
  const dominant = variants.variants.length > 0
    ? [...variants.variants].sort((a, b) => b.caseCount - a.caseCount || a.variantId.localeCompare(b.variantId))[0]
    : null;
  const dominantPath = dominant ? [...dominant.signature] : [];
  const dominantEdges = new Set<string>();
  for (let i = 1; i < dominantPath.length; i++) {
    dominantEdges.add(`${dominantPath[i - 1]}→${dominantPath[i]}`);
  }
  const dominantNodes = new Set(dominantPath);

  // Bottleneck score: waiting pressure (avg incoming wait × frequency),
  // normalized to the max observed pressure. Purely computed.
  const avg = (xs: number[]): number | null =>
    xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;
  let maxPressure = 0;
  const pressures = new Map<string, number>();
  for (const [activity, acc] of nodeAcc) {
    const w = avg(acc.incomingWaits);
    const pressure = w == null ? 0 : w * acc.frequency;
    pressures.set(activity, pressure);
    if (pressure > maxPressure) maxPressure = pressure;
  }

  const nodes: PmoPiProcessNode[] = [...nodeAcc.entries()]
    .map(([activity, acc]) => ({
      id: activity,
      activity,
      frequency: acc.frequency,
      caseCount: acc.cases.size,
      avgIncomingWaitingMs: avg(acc.incomingWaits),
      reworkOccurrences: acc.reworkOccurrences,
      bottleneckScore: maxPressure > 0 ? (pressures.get(activity) ?? 0) / maxPressure : 0,
      onDominantPath: dominantNodes.has(activity),
    }))
    .sort((a, b) => b.frequency - a.frequency || a.id.localeCompare(b.id));

  const edges: PmoPiProcessEdge[] = [...edgeAcc.entries()]
    .map(([key, acc]) => {
      const [from, to] = key.split("→");
      return {
        from,
        to,
        frequency: acc.frequency,
        caseCount: acc.cases.size,
        avgWaitingMs: avg(acc.waits),
        isRework: acc.reworkHits > 0,
        onDominantPath: dominantEdges.has(key),
      };
    })
    .sort((a, b) => b.frequency - a.frequency || `${a.from}→${a.to}`.localeCompare(`${b.from}→${b.to}`));

  const dataQualityScore =
    totalEventsSeen === 0
      ? 0
      : Math.round(((businessEventsUsed / totalEventsSeen) * (cases.length > 0 ? (cases.length - casesWithoutEvents) / cases.length : 0)) * 100) / 100;

  return {
    contractVersion: PMO_PI_CONTRACT_VERSION,
    scope,
    nodes,
    edges,
    variants,
    dominantPath,
    quality: {
      totalEventsSeen,
      businessEventsUsed,
      excludedEvents: totalEventsSeen - businessEventsUsed,
      casesWithoutEvents,
      dataQualityScore,
    },
    generatedAt,
  };
}
