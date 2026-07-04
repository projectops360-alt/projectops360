"use client";

// ============================================================================
// ProjectOps360° — Realtime Living Graph · Live subscription hook (push)
// ============================================================================
// Wires the LGRE Task 2 subscription layer to the browser: the Supabase
// transport (postgres_changes INSERT on project_event_log, project-filtered,
// under RLS) → the subscription manager → TYPED LivingGraphChangeNotices. The
// UI consumes TYPED NOTICES, never raw Supabase payloads. On a notice for this
// project it fires a coalesced onChange so the consumer refetches the approved
// snapshot delta (never a fabricated delta). Channel status drives the honest
// live/degraded state; failure falls back to the caller's polling (LGRE ladder:
// realtime → polling → manual_refresh). Deny-by-default access is enforced by
// the manager; RLS is the outer wall.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createLivingGraphSubscriptionManager,
  isCriticalNotice,
  type LivingGraphRealtimeConnectionState,
} from "@/lib/living-graph/realtime";
// The DB transport adapter is intentionally not exported from the barrel (keeps
// the pure core client-free) — import it directly where a client is wired.
import { createSupabaseLivingGraphTransport } from "@/lib/living-graph/realtime/supabase-transport";

export interface UseLiveGraphSyncArgs {
  projectId: string;
  organizationId: string;
  userId: string;
  /** Fired (coalesced) when a project event notice arrives — refetch here. */
  onChange: () => void;
  /** Fired on connection-state changes so the UI can disclose freshness. */
  onConnectionChange?: (state: LivingGraphRealtimeConnectionState) => void;
  /** Coalesce burst notices into one refetch. */
  coalesceMs?: number;
}

export interface LiveGraphSyncStatus {
  /** True once the realtime channel is live (push delivery active). */
  connected: boolean;
}

export function useLiveGraphSync(args: UseLiveGraphSyncArgs): LiveGraphSyncStatus {
  const [connected, setConnected] = useState(false);
  const onChangeRef = useRef(args.onChange);
  const onConnRef = useRef(args.onConnectionChange);

  // Keep the latest callbacks in refs — updated AFTER render (never during it),
  // so the subscription effect below never re-attaches just because a parent
  // passed a new closure identity. This is what prevents duplicate channels.
  useEffect(() => {
    onChangeRef.current = args.onChange;
    onConnRef.current = args.onConnectionChange;
  });

  useEffect(() => {
    const coalesceMs = args.coalesceMs ?? 350;
    let disposed = false;
    let coalesceTimer: number | null = null;
    let releaseNotice: (() => void) | null = null;
    let releaseObs: (() => void) | null = null;
    let subscriptionId: string | null = null;

    let manager: ReturnType<typeof createLivingGraphSubscriptionManager> | null = null;
    try {
      const supabase = createClient();
      const transport = createSupabaseLivingGraphTransport(
        supabase as unknown as Parameters<typeof createSupabaseLivingGraphTransport>[0],
      );
      manager = createLivingGraphSubscriptionManager({ transport });

      releaseNotice = manager.onNotice((delivery) => {
        if (disposed) return;
        // Only this project's notices matter (the manager already scope-checks).
        if (delivery.notice.projectId !== args.projectId) return;
        // Priority-aware coalescing (Task 6 critical-update policy): a critical
        // notice (status / progress / topology / delete / unknown) flushes
        // IMMEDIATELY, bypassing the debounce, so task-status changes are never
        // delayed. Cosmetic notices are debounced into one refetch. The final
        // state always wins because the consumer re-checks the content signature.
        if (isCriticalNotice(delivery.notice)) {
          if (coalesceTimer != null) {
            window.clearTimeout(coalesceTimer);
            coalesceTimer = null;
          }
          onChangeRef.current();
          return;
        }
        if (coalesceTimer != null) window.clearTimeout(coalesceTimer);
        coalesceTimer = window.setTimeout(() => {
          if (!disposed) onChangeRef.current();
        }, coalesceMs);
      });

      releaseObs = manager.onObservability((event) => {
        if (disposed) return;
        if (event.kind === "transport_status_changed") {
          const state = event.detail.state as LivingGraphRealtimeConnectionState | undefined;
          if (state) {
            setConnected(state === "live");
            onConnRef.current?.(state);
          }
        } else if (event.kind === "fallback_mode_changed" || event.kind === "stale_subscription_detected") {
          setConnected(false);
        }
      });

      const handle = manager.subscribe({
        consumerId: "realtime-living-graph",
        scope: { organizationId: args.organizationId, projectId: args.projectId },
        topics: ["project_events"],
        access: {
          userId: args.userId,
          organizationId: args.organizationId,
          scope: "pm",
          authorizedProjectIds: [args.projectId],
        },
      });
      subscriptionId = handle.subscriptionId;
    } catch {
      // Subscription failed (unauthorized / no realtime) — stay on the caller's
      // polling fallback; never claim live. `connected` is already false (initial
      // state, and reset in cleanup on scope change), so no synchronous setState
      // is needed in the effect body here.
    }

    return () => {
      disposed = true;
      // Reset freshness on unmount / scope change so a slow or failing
      // re-subscribe never leaves a stale "live" from the previous scope.
      setConnected(false);
      if (coalesceTimer != null) window.clearTimeout(coalesceTimer);
      releaseNotice?.();
      releaseObs?.();
      if (manager && subscriptionId) {
        try {
          manager.unsubscribe(subscriptionId);
        } catch {
          /* best-effort teardown */
        }
      }
    };
  }, [args.projectId, args.organizationId, args.userId, args.coalesceMs]);

  return { connected };
}
