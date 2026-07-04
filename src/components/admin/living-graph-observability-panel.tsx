"use client";

// ============================================================================
// ProjectOps360° — Living Graph Observability Panel (internal/admin)
// ============================================================================
// Safe realtime diagnostics for the LGRE. It NEVER shows raw event payloads,
// raw Supabase messages, or tenant task/user/team detail — only aggregate
// counters, infra health booleans, and connection state. Server-side env health
// is passed in; SESSION runtime counters come from ONE scoped subscription this
// panel owns (no duplicate consumer channels, no recalculation triggered).
// Metrics this panel does not track (delta/recalc/render — in-memory per graph
// consumer) render honestly as "not instrumented", never fake zeros.
// ============================================================================

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Activity, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  buildObservabilitySummary,
  type EnvironmentHealth,
  type MetricRow,
  type PanelFreshness,
  type RealtimePerfSnapshot,
} from "@/lib/living-graph/realtime";
import { useLiveGraphSync } from "@/components/living-graph-realtime/use-live-graph-sync";

interface ProjectOption {
  id: string;
  title: string;
}

// Counters this panel genuinely instruments from its own subscription. Anything
// NOT here is reported as "not instrumented" (honest, never a fake zero).
const TRACKED: (keyof RealtimePerfSnapshot)[] = [
  "subscriptionCount",
  "activeChannelCount",
  "reconnectCount",
  "staleCount",
  "freshRecoveryCount",
  "permissionLossCount",
  "noticeCount",
  "errorCount",
  "warningCount",
];

const CARD_TITLES: Record<string, string> = {
  environment: "environmentTitle",
  connection: "connectionTitle",
  notice_recalc: "noticeTitle",
  delta_sync: "deltaTitle",
  rendering: "renderingTitle",
  errors: "errorsTitle",
};

export function LivingGraphObservabilityPanel({
  organizationId,
  userId,
  environment,
  projects,
}: {
  organizationId: string;
  userId: string;
  environment: EnvironmentHealth | null;
  projects: ProjectOption[];
}) {
  const t = useTranslations("livingGraphObservability");
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="lg-observability-panel">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Activity className="h-5 w-5 text-primary" aria-hidden />
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <select
          data-testid="lg-observability-project"
          aria-label={t("selectProject")}
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">{t("selectProject")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <button
          type="button"
          data-testid="lg-observability-refresh"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t("refresh")}
        </button>
      </header>

      <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
        {t("inMemoryNote")}
      </p>

      {selectedProjectId ? (
        <SessionDiagnostics
          key={selectedProjectId}
          projectId={selectedProjectId}
          organizationId={organizationId}
          userId={userId}
          environment={environment}
        />
      ) : (
        <StaticDiagnostics environment={environment} />
      )}
    </div>
  );
}

/** Env-only view (no project selected): infra health, everything else pending. */
function StaticDiagnostics({ environment }: { environment: EnvironmentHealth | null }) {
  const t = useTranslations("livingGraphObservability");
  const model = useMemo(
    () =>
      buildObservabilitySummary({
        connectionState: "unknown",
        freshness: "unknown",
        snapshot: null,
        environment,
        lastEventAt: null,
        generatedAt: new Date().toISOString(),
      }),
    [environment],
  );
  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground" data-testid="lg-observability-noproject">
        {t("noProjectSelected")}
      </p>
      <ConnectionBadge state="unknown" freshness="unknown" />
      <Cards cards={model.cards} />
    </>
  );
}

/** Live view for a selected project: one scoped subscription + session counters. */
function SessionDiagnostics({
  projectId,
  organizationId,
  userId,
  environment,
}: {
  projectId: string;
  organizationId: string;
  userId: string;
  environment: EnvironmentHealth | null;
}) {
  // Session counters live in STATE (read during render), never a ref — so the
  // panel re-renders on change and never reads a ref during render (Phase 4B
  // Task 1 hook hygiene). `wasConnectedRef` is only touched in event callbacks.
  const wasConnectedRef = useRef(false);
  const [counters, setCounters] = useState<Partial<RealtimePerfSnapshot>>(() =>
    Object.fromEntries(TRACKED.map((k) => [k, k === "subscriptionCount" || k === "activeChannelCount" ? 1 : 0])),
  );
  const [state, setState] = useState<string>("reconnecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  const onChange = useCallback(() => {
    setCounters((c) => ({ ...c, noticeCount: (c.noticeCount ?? 0) + 1 }));
    setLastEventAt(new Date().toISOString());
  }, []);

  const onConnectionChange = useCallback((s: string) => {
    setCounters((c) => {
      const next = { ...c };
      if (s === "live") {
        if (!wasConnectedRef.current) next.freshRecoveryCount = (c.freshRecoveryCount ?? 0) + 1;
      } else {
        if (wasConnectedRef.current) next.reconnectCount = (c.reconnectCount ?? 0) + 1;
        if (s === "stale" || s === "degraded_polling") next.staleCount = (c.staleCount ?? 0) + 1;
      }
      return next;
    });
    wasConnectedRef.current = s === "live";
    setState(s);
  }, []);

  const { connected } = useLiveGraphSync({ projectId, organizationId, userId, onChange, onConnectionChange });

  const model = useMemo(
    () =>
      buildObservabilitySummary({
        connectionState: connected ? "live" : state,
        freshness: connected ? "fresh" : "degraded",
        snapshot: counters,
        environment,
        lastEventAt,
        generatedAt: new Date().toISOString(),
      }),
    [counters, connected, state, environment, lastEventAt],
  );

  return (
    <>
      <ConnectionBadge state={model.connectionState} freshness={model.freshness} />
      <Cards cards={model.cards} />
    </>
  );
}

function ConnectionBadge({ state, freshness }: { state: string; freshness: PanelFreshness }) {
  const t = useTranslations("livingGraphObservability");
  const live = freshness === "fresh";
  return (
    <div
      data-testid="lg-observability-connection"
      data-connection-state={state}
      data-freshness={freshness}
      className={`mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
        live
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {live ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
      {t(`state.${freshness}`)} · {state}
    </div>
  );
}

function Cards({ cards }: { cards: { key: string; rows: MetricRow[] }[] }) {
  const t = useTranslations("livingGraphObservability");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.key} data-testid={`lg-observability-card-${card.key}`} className="rounded-xl border border-border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(CARD_TITLES[card.key] ?? "connectionTitle")}
          </h2>
          <dl className="space-y-1">
            {card.rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd
                  data-metric={row.key}
                  data-instrumented={row.instrumented}
                  className={`font-medium tabular-nums ${
                    !row.instrumented
                      ? "text-muted-foreground/60 italic"
                      : row.status === "error"
                        ? "text-red-600 dark:text-red-400"
                        : row.status === "warn"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                  }`}
                >
                  {row.instrumented ? String(row.value) : t("notInstrumented")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
