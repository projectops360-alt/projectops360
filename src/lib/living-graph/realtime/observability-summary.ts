// ============================================================================
// ProjectOps360° — LGRE Phase 4B / Task 3
// Living Graph Observability SUMMARY (pure display model)
// ============================================================================
// Turns the Task-6 in-memory perf counters (a partial RealtimePerfSnapshot) +
// a connection state + optional server-side environment health into a safe,
// display-ready panel model organized into cards. It is PURE and privacy-safe:
// it accepts ONLY numeric counters / booleans / a connection-state string — it
// can never carry a raw event payload, a task/user/team detail, or a secret.
//
// Honesty contract: a metric whose value is absent (not tracked by the calling
// source — Task-6 counters are in-memory per consumer) renders as
// `unavailable` / "not instrumented", NEVER a fake zero.
// ============================================================================

import type { RealtimePerfSnapshot } from "./perf-observability";

export type MetricStatus = "ok" | "warn" | "error" | "unavailable";

export interface MetricRow {
  key: string;
  /** Internal technical label (English ops term). */
  label: string;
  /** null → not instrumented in this source. */
  value: number | string | null;
  status: MetricStatus;
  instrumented: boolean;
}

export interface ObservabilityCard {
  key: string;
  rows: MetricRow[];
}

export type PanelFreshness = "fresh" | "stale" | "degraded" | "unknown";

export interface EnvironmentHealth {
  /** project_event_log present in the supabase_realtime publication. */
  realtimePublicationOk: boolean;
  /** RLS enabled on project_event_log. */
  rlsEnabled: boolean;
  rlsPolicyCount: number;
  /** Aggregate count of ledger rows in the recent window (NO payloads). */
  recentEventCount: number | null;
  recentWindowMinutes: number;
}

export interface ObservabilityPanelInput {
  /** Live connection state of THIS session's scoped subscription. */
  connectionState: string; // live | degraded_polling | stale | reconnecting | offline | unknown
  freshness: PanelFreshness;
  /** Whatever counters the caller actually tracks; absent keys → unavailable. */
  snapshot: Partial<RealtimePerfSnapshot> | null;
  environment: EnvironmentHealth | null;
  lastEventAt: string | null;
  generatedAt: string;
}

export interface ObservabilityPanelModel {
  connectionState: string;
  freshness: PanelFreshness;
  cards: ObservabilityCard[];
  lastEventAt: string | null;
  generatedAt: string;
  /** True when no counter at all was instrumented (honest empty state). */
  hasAnyInstrumented: boolean;
}

// ── Metric catalog (fixed rows so the panel is stable + honest) ───────────────

interface MetricDef {
  key: keyof RealtimePerfSnapshot;
  label: string;
  /** Higher-is-worse counters warn/err when > 0. Neutral counters are always ok. */
  severity?: "neutral" | "warn_if_positive" | "error_if_positive";
}

const CONNECTION_METRICS: MetricDef[] = [
  { key: "subscriptionCount", label: "Subscriptions" },
  { key: "activeChannelCount", label: "Active channels" },
  { key: "reconnectCount", label: "Reconnects", severity: "warn_if_positive" },
  { key: "duplicateSubscriptionPrevented", label: "Duplicate subs prevented" },
  { key: "permissionLossCount", label: "Permission losses", severity: "error_if_positive" },
  { key: "staleCount", label: "Stale transitions", severity: "warn_if_positive" },
  { key: "freshRecoveryCount", label: "Fresh recoveries" },
];

const NOTICE_RECALC_METRICS: MetricDef[] = [
  { key: "noticeCount", label: "Notices received" },
  { key: "dedupedNoticeCount", label: "Deduped notices" },
  { key: "rejectedNoticeCount", label: "Rejected notices", severity: "warn_if_positive" },
  { key: "recalcRequestCount", label: "Recalc requests" },
  { key: "avgRecalcDurationMs", label: "Avg recalc (ms)" },
  { key: "recalcFallbackCount", label: "Recalc fallbacks", severity: "warn_if_positive" },
];

const DELTA_METRICS: MetricDef[] = [
  { key: "deltaCount", label: "Deltas applied" },
  { key: "fullResyncCount", label: "Full resyncs", severity: "warn_if_positive" },
  { key: "maxDeltaSizeFallbackCount", label: "Oversized-delta fallbacks", severity: "warn_if_positive" },
  { key: "criticalPreservedCount", label: "Critical updates preserved" },
  { key: "skippedNonCriticalCount", label: "Skipped non-critical" },
];

const RENDER_METRICS: MetricDef[] = [
  { key: "avgRenderLatencyMs", label: "Avg render latency (ms)" },
  { key: "avgRenderBatchSize", label: "Avg render batch" },
  { key: "renderUpdateCount", label: "Render updates" },
  { key: "largeGraphWarningCount", label: "Large-graph warnings", severity: "warn_if_positive" },
];

const ERROR_METRICS: MetricDef[] = [
  { key: "errorCount", label: "Errors", severity: "error_if_positive" },
  { key: "recoverableErrorCount", label: "Recoverable errors", severity: "warn_if_positive" },
  { key: "warningCount", label: "Warnings", severity: "warn_if_positive" },
];

function toRow(def: MetricDef, snapshot: Partial<RealtimePerfSnapshot> | null): MetricRow {
  const raw = snapshot ? snapshot[def.key] : undefined;
  if (raw == null || typeof raw !== "number") {
    return { key: def.key, label: def.label, value: null, status: "unavailable", instrumented: false };
  }
  const value = Number.isInteger(raw) ? raw : Math.round(raw * 10) / 10;
  let status: MetricStatus = "ok";
  if (value > 0 && def.severity === "warn_if_positive") status = "warn";
  if (value > 0 && def.severity === "error_if_positive") status = "error";
  return { key: def.key, label: def.label, value, status, instrumented: true };
}

/** Build the safe, honest observability panel model. Pure. */
export function buildObservabilitySummary(input: ObservabilityPanelInput): ObservabilityPanelModel {
  const section = (defs: MetricDef[]) => defs.map((d) => toRow(d, input.snapshot));

  const cards: ObservabilityCard[] = [];

  if (input.environment) {
    const env = input.environment;
    cards.push({
      key: "environment",
      rows: [
        {
          key: "realtimePublicationOk",
          label: "Realtime publication",
          value: env.realtimePublicationOk ? "healthy" : "missing",
          status: env.realtimePublicationOk ? "ok" : "error",
          instrumented: true,
        },
        {
          key: "rlsEnabled",
          label: "RLS on event log",
          value: env.rlsEnabled ? `enabled (${env.rlsPolicyCount})` : "disabled",
          status: env.rlsEnabled ? "ok" : "error",
          instrumented: true,
        },
        {
          key: "recentEventCount",
          label: `Ledger activity (${env.recentWindowMinutes}m)`,
          value: env.recentEventCount,
          status: "ok",
          instrumented: env.recentEventCount != null,
        },
      ],
    });
  }

  cards.push(
    { key: "connection", rows: section(CONNECTION_METRICS) },
    { key: "notice_recalc", rows: section(NOTICE_RECALC_METRICS) },
    { key: "delta_sync", rows: section(DELTA_METRICS) },
    { key: "rendering", rows: section(RENDER_METRICS) },
    { key: "errors", rows: section(ERROR_METRICS) },
  );

  const hasAnyInstrumented = cards.some((c) => c.rows.some((r) => r.instrumented));

  return {
    connectionState: input.connectionState,
    freshness: input.freshness,
    cards,
    lastEventAt: input.lastEventAt,
    generatedAt: input.generatedAt,
    hasAnyInstrumented,
  };
}
