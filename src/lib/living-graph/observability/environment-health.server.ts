// ============================================================================
// ProjectOps360° — Living Graph Observability · environment health (SERVER-ONLY)
// ============================================================================
// Fetches SAFE, aggregate realtime-infrastructure health for the admin panel:
// realtime publication membership + RLS status (via a read-only RPC that returns
// no tenant data) and an org-scoped AGGREGATE count of recent ledger activity
// (count only — never rows, never payloads). Kept OUT of the pure LGRE realtime
// barrel so that core stays client-free; this file is server-only.
// ============================================================================

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnvironmentHealth } from "@/lib/living-graph/realtime/observability-summary";

const RECENT_WINDOW_MINUTES = 15;

/**
 * Read-only realtime environment health for an organization. Never returns
 * payloads or per-entity data — only infra booleans and an aggregate count.
 */
export async function getLivingGraphEnvironmentHealth(
  organizationId: string,
): Promise<EnvironmentHealth> {
  const supabase = createAdminClient();

  let realtimePublicationOk = false;
  let rlsEnabled = false;
  let rlsPolicyCount = 0;
  try {
    const { data } = await supabase.rpc("living_graph_realtime_health");
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      realtimePublicationOk = Boolean(row.realtime_publication_ok);
      rlsEnabled = Boolean(row.rls_enabled);
      rlsPolicyCount = Number(row.rls_policy_count ?? 0);
    }
  } catch {
    // Leave defaults (panel renders publication/RLS as unhealthy → visible).
  }

  // Aggregate ledger activity in the recent window — COUNT only, org-scoped.
  let recentEventCount: number | null = null;
  try {
    const sinceIso = new Date(Date.now() - RECENT_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabase
      .from("project_event_log")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", sinceIso);
    recentEventCount = count ?? 0;
  } catch {
    recentEventCount = null; // honestly "unavailable", not a fake zero
  }

  return {
    realtimePublicationOk,
    rlsEnabled,
    rlsPolicyCount,
    recentEventCount,
    recentWindowMinutes: RECENT_WINDOW_MINUTES,
  };
}
