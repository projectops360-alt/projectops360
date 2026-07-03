// ============================================================================
// ProjectOps360° — LGRE · Supabase Realtime Transport Adapter (Phase 4, Task 2)
// ============================================================================
// The ONLY file in the realtime layer that knows about Supabase. It adapts a
// Supabase client's Realtime channels to the LivingGraphRealtimeTransport
// abstraction: postgres_changes **INSERT-only** on project_event_log, filtered
// by project, under the table's RLS ("Members read project_event_log").
//
// STRICTLY A LISTENER. This adapter performs no query, no insert/update/delete,
// no rpc — it only opens/closes channels. Canonical truth boundaries stay
// intact (guarded by LGRE-SUBSCRIPTION). Deliberately NOT exported from the
// package barrel: consumers wire it explicitly at the call site with an
// authenticated client (e.g. createClient() from lib/supabase/client), so the
// pure core never gains a transitive Supabase dependency.
//
// Operational prerequisite: project_event_log must be in the supabase_realtime
// publication (migration 20260833000000_project_event_log_realtime.sql).
// ============================================================================

import type {
  LivingGraphRealtimeTransport,
  LivingGraphTransportChannel,
  LivingGraphTransportChannelParams,
  LivingGraphTransportStatus,
  ProjectEventLogRowLike,
} from "./subscription-types";

// Minimal structural typing of the Supabase Realtime surface we use, so this
// module stays testable and does not couple the LGRE to a client library
// version. Any @supabase/supabase-js client satisfies it.

interface RealtimeChannelLike {
  on(
    type: "postgres_changes",
    filter: { event: "INSERT"; schema: string; table: string; filter: string },
    callback: (payload: { new: Record<string, unknown> }) => void,
  ): RealtimeChannelLike;
  subscribe(callback?: (status: string) => void): RealtimeChannelLike;
}

export interface SupabaseRealtimeClientLike {
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): unknown;
}

/** Map Supabase channel statuses onto the normalized transport statuses. */
export function mapSupabaseChannelStatus(status: string): LivingGraphTransportStatus {
  switch (status) {
    case "SUBSCRIBED":
      return "connected";
    case "TIMED_OUT":
      return "reconnecting";
    case "CHANNEL_ERROR":
      return "channel_error";
    case "CLOSED":
      return "closed";
    default:
      return "reconnecting";
  }
}

export function createSupabaseLivingGraphTransport(
  client: SupabaseRealtimeClientLike,
): LivingGraphRealtimeTransport {
  return {
    openChannel(params: LivingGraphTransportChannelParams): LivingGraphTransportChannel {
      const channel = client
        .channel(params.channelKey)
        .on(
          "postgres_changes",
          {
            // Append-only ledger: INSERT is the only change that can exist
            // (UPDATE/DELETE are blocked by trigger). We never listen wider.
            event: "INSERT",
            schema: "public",
            table: "project_event_log",
            filter: `project_id=eq.${params.projectId}`,
          },
          (payload) => params.onEventRow(payload.new as ProjectEventLogRowLike),
        )
        .subscribe((status) => params.onStatus(mapSupabaseChannelStatus(status)));

      return {
        channelKey: params.channelKey,
        close() {
          client.removeChannel(channel);
        },
      };
    },
  };
}
