// ============================================================================
// ProjectOps360° — Backfill quality / replay-readiness / org-memory reports
// ============================================================================
// Pure, deterministic report computations over BackfillReport(s). No DB, no AI.
// Used by the Backfill Administration Console. See historical-backfill-service.md.
// ============================================================================

import type { BackfillReport } from "./backfill";

export interface QualityReport {
  totalEvents: number;
  explicitPct: number;
  inferredPct: number;
  averageConfidence: number;
  lowestConfidence: number;
  highestConfidence: number;
  duplicateSuppression: number;
  unsupportedSources: string[];
  confidenceDistribution: { high: number; medium: number; low: number };
}

export function computeQualityReport(r: BackfillReport): QualityReport {
  const total = r.eventsCreated;
  const s = r.confidenceStats;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    totalEvents: total,
    explicitPct: total ? Math.round((r.explicitEvents / total) * 100) : 0,
    inferredPct: total ? Math.round((r.inferredEvents / total) * 100) : 0,
    averageConfidence: s.count ? round2(s.sum / s.count) : 0,
    lowestConfidence: s.count ? round2(s.min) : 0,
    highestConfidence: s.count ? round2(s.max) : 0,
    duplicateSuppression: r.eventsSkipped,
    unsupportedSources: r.unsupportedSources,
    confidenceDistribution: r.confidenceDistribution,
  };
}

export interface ReplayReadiness {
  score: number; // 0–100
  label: "replay_ready" | "partial" | "insufficient";
  reasons: string[];
}

/** Heuristic, deterministic replay-readiness for a project's reconstructed history. */
export function computeReplayReadiness(r: BackfillReport): ReplayReadiness {
  const reasons: string[] = [];
  const totalInRun = r.eventsCreated + r.eventsSkipped;
  const avg = r.confidenceStats.count ? r.confidenceStats.sum / r.confidenceStats.count : 0;

  let score = 0;
  if (totalInRun > 0) score += 30;
  else reasons.push("No historical events reconstructed");

  const hasTasks = r.sourceModulesProcessed.includes("roadmap_tasks") && (r.byType.TaskCreated ?? 0) > 0;
  const hasMilestones = r.sourceModulesProcessed.includes("milestones") && (r.byType.MilestoneCreated ?? 0) > 0;
  if (hasTasks) score += 25; else reasons.push("Weak task history");
  if (hasMilestones) score += 20; else reasons.push("Missing milestone history");

  score += Math.round(avg * 25);
  if (avg > 0 && avg < 0.7) reasons.push("Low average evidence confidence");
  if (r.unsupportedSources.length) reasons.push(`Unsupported sources: ${r.unsupportedSources.join(", ")}`);

  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? "replay_ready" : score >= 50 ? "partial" : "insufficient";
  if (reasons.length === 0) reasons.push("Good milestone and task history with strong evidence");
  return { score, label, reasons };
}

export interface OrgMemoryReport {
  projectsProcessed: number;
  totalEvents: number;
  averageConfidence: number;
  topContributors: { projectId: string; events: number }[];
  weakEvidence: { projectId: string; averageConfidence: number; events: number }[];
  /** Future — structure only; Organizational DNA is NOT implemented. */
  organizationalDnaReady: boolean;
}

export function computeOrgMemoryReport(reports: BackfillReport[]): OrgMemoryReport {
  const totalEvents = reports.reduce((a, r) => a + r.eventsCreated, 0);
  const confCount = reports.reduce((a, r) => a + r.confidenceStats.count, 0);
  const confSum = reports.reduce((a, r) => a + r.confidenceStats.sum, 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const perProject = reports.map((r) => ({
    projectId: r.projectId,
    events: r.eventsCreated,
    averageConfidence: r.confidenceStats.count ? round2(r.confidenceStats.sum / r.confidenceStats.count) : 0,
  }));
  return {
    projectsProcessed: reports.length,
    totalEvents,
    averageConfidence: confCount ? round2(confSum / confCount) : 0,
    topContributors: [...perProject].sort((a, b) => b.events - a.events).slice(0, 5).map(({ projectId, events }) => ({ projectId, events })),
    weakEvidence: [...perProject].filter((p) => p.events > 0).sort((a, b) => a.averageConfidence - b.averageConfidence).slice(0, 5),
    organizationalDnaReady: false,
  };
}
