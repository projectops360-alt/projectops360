import { scoreFrictionSignal } from "./scoring";
import type {
  FrictionCategory,
  FrictionConfidence,
  FrictionSeverity,
  FrictionSignal,
} from "./types";

export type FrictionSignalScope = "top20" | "all";
export type FrictionSignalSort = "score" | "newest" | "oldest";

export interface FrictionSignalFilters {
  query: string;
  category: FrictionCategory | "all";
  severity: FrictionSeverity | "all";
  confidence: FrictionConfidence | "all";
  milestoneId: string | "all";
  taskId: string | "all";
  scope: FrictionSignalScope;
  sort: FrictionSignalSort;
}

export const DEFAULT_FRICTION_SIGNAL_FILTERS: FrictionSignalFilters = {
  query: "",
  category: "all",
  severity: "all",
  confidence: "all",
  milestoneId: "all",
  taskId: "all",
  scope: "top20",
  sort: "score",
};

function timestamp(signal: FrictionSignal): number {
  const raw = signal.evidenceTimestampEnd ?? signal.evidenceTimestampStart ?? signal.occurredAt;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesQuery(signal: FrictionSignal, query: string, taskTitle?: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = [
    signal.signalType,
    signal.category,
    signal.severity,
    signal.confidence,
    signal.evidenceDescription,
    signal.taskId,
    signal.milestoneId,
    signal.entityId,
    taskTitle,
    ...signal.evidenceRefs.flatMap((ref) => [ref.kind, ref.id, ref.label]),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(needle);
}

/**
 * Pure UI projection. It never changes scores, evidence or signal promotion;
 * it only filters and orders the already validated read model.
 */
export function filterAndSortFrictionSignals(input: {
  signals: readonly FrictionSignal[];
  topSignalIds: readonly string[];
  filters: FrictionSignalFilters;
  taskTitles?: Readonly<Record<string, string>>;
}): FrictionSignal[] {
  const top = new Set(input.topSignalIds);
  const filtered = input.signals.filter((signal) => {
    if (input.filters.scope === "top20" && !top.has(signal.signalId)) return false;
    if (input.filters.category !== "all" && signal.category !== input.filters.category) return false;
    if (input.filters.severity !== "all" && signal.severity !== input.filters.severity) return false;
    if (input.filters.confidence !== "all" && signal.confidence !== input.filters.confidence) return false;
    if (input.filters.milestoneId !== "all" && signal.milestoneId !== input.filters.milestoneId) return false;
    if (input.filters.taskId !== "all" && signal.taskId !== input.filters.taskId) return false;
    return matchesQuery(
      signal,
      input.filters.query,
      signal.taskId ? input.taskTitles?.[signal.taskId] : undefined,
    );
  });

  return [...filtered].sort((a, b) => {
    if (input.filters.sort === "newest") {
      return timestamp(b) - timestamp(a) || a.signalId.localeCompare(b.signalId);
    }
    if (input.filters.sort === "oldest") {
      return timestamp(a) - timestamp(b) || a.signalId.localeCompare(b.signalId);
    }
    return scoreFrictionSignal(b) - scoreFrictionSignal(a) || a.signalId.localeCompare(b.signalId);
  });
}

/** Route to the closest existing, authorized project surface for the entity. */
export function frictionSignalEntityHref(
  projectId: string,
  signal: FrictionSignal,
): string {
  const root = `/projects/${projectId}`;
  if (signal.taskId) return `${root}/workboard?task=${encodeURIComponent(signal.taskId)}`;
  if (signal.milestoneId) {
    return `${root}/execution-map?milestone=${encodeURIComponent(signal.milestoneId)}`;
  }
  if (signal.category === "cost") return `${root}/budget`;
  if (signal.category === "resource") return `${root}/resource-capacity`;
  if (signal.category === "decision") return `${root}/decisions`;
  if (signal.category === "risk" || signal.category === "schedule") return `${root}/status`;
  return `${root}/execution-map`;
}

export function affectedTaskCount(signals: readonly FrictionSignal[]): number {
  return new Set(signals.map((signal) => signal.taskId).filter(Boolean)).size;
}
