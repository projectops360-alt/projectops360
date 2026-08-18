import { scoreFrictionSignal } from "./scoring";
import type { FrictionSignal } from "./types";

const CONFIDENCE_RANK: Record<FrictionSignal["confidence"], number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function signalFamily(signalType: string): string {
  if (signalType === "completed_then_reopened" || signalType.startsWith("rework:")) {
    return "rework";
  }
  return signalType;
}

function explicitEventFingerprint(signal: FrictionSignal): string | null {
  const ids = signal.evidenceRefs
    .filter((ref) => ref.kind === "project_event_log")
    .map((ref) => ref.id)
    .sort();
  return ids.length > 0
    ? `${signal.projectId}:${signal.category}:${signalFamily(signal.signalType)}:${ids.join(",")}`
    : null;
}

function preferredSignal(a: FrictionSignal, b: FrictionSignal): FrictionSignal {
  const rankA = CONFIDENCE_RANK[a.confidence];
  const rankB = CONFIDENCE_RANK[b.confidence];
  if (rankA !== rankB) return rankA > rankB ? a : b;
  const taskA = a.taskId ? 1 : 0;
  const taskB = b.taskId ? 1 : 0;
  if (taskA !== taskB) return taskA > taskB ? a : b;
  const evidenceA = a.evidenceRefs.length;
  const evidenceB = b.evidenceRefs.length;
  if (evidenceA !== evidenceB) return evidenceA > evidenceB ? a : b;
  return a.signalId.localeCompare(b.signalId) <= 0 ? a : b;
}

/**
 * Deterministic union across engines. Exact ids are unique, while findings in
 * the same semantic family and category backed by the exact same canonical
 * event set collapse to the most specific/high-confidence signal. Independent
 * signal types remain separate. Temporal proximity is never used.
 */
export function mergeFrictionSignals(
  ...groups: readonly (readonly FrictionSignal[])[]
): FrictionSignal[] {
  const bySignalId = new Map<string, FrictionSignal>();
  for (const signal of groups.flat()) {
    const existing = bySignalId.get(signal.signalId);
    bySignalId.set(
      signal.signalId,
      existing ? preferredSignal(existing, signal) : signal,
    );
  }

  const byEvidence = new Map<string, FrictionSignal>();
  const withoutFingerprint: FrictionSignal[] = [];
  for (const signal of bySignalId.values()) {
    const fingerprint = explicitEventFingerprint(signal);
    if (!fingerprint) {
      withoutFingerprint.push(signal);
      continue;
    }
    const existing = byEvidence.get(fingerprint);
    byEvidence.set(
      fingerprint,
      existing ? preferredSignal(existing, signal) : signal,
    );
  }

  return [...byEvidence.values(), ...withoutFingerprint].sort(
    (a, b) =>
      scoreFrictionSignal(b) - scoreFrictionSignal(a) ||
      a.signalId.localeCompare(b.signalId),
  );
}
