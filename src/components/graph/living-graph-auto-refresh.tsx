"use client";

// ============================================================================
// ProjectOps360° — Living Graph auto-refresh (classic SSR view)
// ============================================================================
// Makes the classic SSR Living Graph auto-update when a task status/progress
// changes — no manual browser refresh, and cross-browser. It consumes the SAME
// approved realtime path as the /execution-map/realtime view: the LGRE Task 2
// live subscription (typed notices, never raw payloads) for INSTANT updates,
// with a cheap signature poll as the honest fallback (LGRE ladder). On a real
// content change it calls router.refresh() so the server component re-reads the
// canonical graph (roadmap_tasks / process_nodes) and re-renders. It never
// queries project_event_log, never writes anything, never recalculates truth.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, Wifi } from "lucide-react";
import { getRealtimeGraphSignatureAction } from "@/app/[locale]/(app)/projects/[projectId]/execution-map/realtime/actions";
import { useLiveGraphSync } from "@/components/living-graph-realtime/use-live-graph-sync";

const POLL_MS = 8_000;

export function LivingGraphAutoRefresh({
  projectId,
  organizationId,
  userId,
  initialSignature,
}: {
  projectId: string;
  organizationId: string;
  userId: string;
  initialSignature: string;
}) {
  const t = useTranslations("livingGraph");
  const router = useRouter();
  const sigRef = useRef(initialSignature);
  const refreshingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  // Re-check the content signature; refresh the SSR graph only when it changed.
  const checkAndRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    try {
      const { signature } = await getRealtimeGraphSignatureAction(projectId);
      if (signature == null || signature === sigRef.current) return;
      sigRef.current = signature;
      refreshingRef.current = true;
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
      }, 1500);
    } catch {
      // Best-effort; the next poll retries.
    }
  }, [projectId, router]);

  // Instant push via the approved Task 2 subscription (typed notices).
  const { connected } = useLiveGraphSync({
    projectId,
    organizationId,
    userId,
    onChange: () => void checkAndRefresh(),
  });

  // Polling fallback — primary when the live socket isn't connected.
  useEffect(() => {
    const timer = window.setInterval(() => void checkAndRefresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [checkAndRefresh]);

  return (
    <span
      role="status"
      data-testid="living-graph-auto-refresh"
      data-connected={connected}
      title={connected ? t("autoSync.live") : t("autoSync.polling")}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        connected
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {refreshing ? <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> : <Wifi className="h-3 w-3" aria-hidden />}
      {connected ? t("autoSync.live") : t("autoSync.polling")}
    </span>
  );
}
