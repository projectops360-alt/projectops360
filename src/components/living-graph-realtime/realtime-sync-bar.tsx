"use client";

// ============================================================================
// ProjectOps360° — Realtime Living Graph · Sync status bar
// ============================================================================
// Honest realtime status from the pure sync-state (Task 4 sync contract): live
// / recovering / stale / resync-required / unauthorized, plus the version and
// last-synced time. Never fabricates liveness.
// ============================================================================

import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { RealtimeSyncState } from "@/lib/living-graph-realtime-ui";

const FRESHNESS_STYLE: Record<string, { cls: string; icon: React.ReactNode }> = {
  live: { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: <Wifi className="h-3.5 w-3.5" aria-hidden /> },
  recovering: { cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> },
  stale: { cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> },
  resync_required: { cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden /> },
  unknown: { cls: "border-border bg-muted text-muted-foreground", icon: <WifiOff className="h-3.5 w-3.5" aria-hidden /> },
};

export function RealtimeSyncBar({ state }: { state: RealtimeSyncState }) {
  const t = useTranslations("realtimeGraph");
  const style = FRESHNESS_STYLE[state.freshness] ?? FRESHNESS_STYLE.unknown;
  return (
    <div
      role="status"
      data-testid="rt-sync-bar"
      data-freshness={state.freshness}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${style.cls}`}
    >
      {style.icon}
      <span>{t(`sync.${state.freshness}`)}</span>
      {state.version != null && <span className="tabular-nums opacity-70">v{state.version}</span>}
      {state.lastSyncedAt && (
        <span className="opacity-70">· {t("sync.at", { time: state.lastSyncedAt.slice(11, 19) })}</span>
      )}
    </div>
  );
}
