"use server";

// ============================================================================
// ProjectOps360° — Realtime Living Graph · Polling sync actions
// ============================================================================
// The delivery path for the realtime consumer while the live Supabase channel
// is being wired: the LGRE "polling" fallback (Task 1 delivery ladder). The
// client polls a CHEAP signature; when it changes (e.g. a task moved to Done),
// it refetches the approved snapshot delta and rebuilds. Both actions are
// RBAC-scoped (fail closed) via the loader's org+project check. The UI never
// queries project_event_log or raw realtime payloads — it consumes only the
// approved Task 4 delta shape returned here.
// ============================================================================

import {
  loadRealtimeGraphSnapshot,
  loadRealtimeGraphSignature,
  type RealtimeGraphSnapshot,
} from "@/lib/living-graph-realtime-ui/load-snapshot";

/** Cheap poll: returns the current content signature, or null when unauthorized. */
export async function getRealtimeGraphSignatureAction(projectId: string): Promise<{ signature: string | null }> {
  try {
    const signature = await loadRealtimeGraphSignature(projectId);
    return { signature };
  } catch {
    return { signature: null };
  }
}

/** Refetch the full approved snapshot delta (called only when the signature changes). */
export async function getRealtimeGraphSnapshotAction(
  projectId: string,
): Promise<{ snapshot: RealtimeGraphSnapshot | null }> {
  try {
    const snapshot = await loadRealtimeGraphSnapshot(projectId);
    return { snapshot };
  } catch {
    return { snapshot: null };
  }
}
