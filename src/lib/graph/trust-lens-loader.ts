import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toControlViews } from "@/lib/eki-trust-context/assembler";
import { loadTrustContext } from "@/lib/eki-trust-context/loader";
import { isEkiRolloutOrganization } from "@/lib/eki-evidence/rollout";
import { assertSingleTenant, projectTrustLens, type TrustLensProjection } from "./trust-lens-projection";

/**
 * Loads the Enterprise Trust lens for the Living Graph.
 *
 * Reads through the CALLER's client so RLS decides visibility, then projects.
 * Using the service-role client here would render a graph that crosses tenants
 * and looks entirely normal while doing it.
 */

export type TrustLensStatus = "disabled" | "empty" | "ready" | "error";

export interface TrustLensLoadResult {
  status: TrustLensStatus;
  projection?: TrustLensProjection;
}

export async function loadTrustLens(
  client: SupabaseClient,
  organizationId: string,
): Promise<TrustLensLoadResult> {
  // Controlled rollout: an organization outside the approved scope sees the lens
  // as disabled, identical to the flag being off. No query runs.
  if (!isEkiRolloutOrganization(organizationId)) return { status: "disabled" };
  try {
    const { context } = await loadTrustContext(client, organizationId, new Date().toISOString());
    const views = toControlViews(context);
    const projection = projectTrustLens(views, organizationId);
    // Defence in depth. The reads are scoped; this proves the projection is too.
    assertSingleTenant(projection);
    // `empty` is a real state, distinct from `error`. An organization with no
    // controls has nothing to show; an organization whose context failed to load
    // has something to show and could not. Collapsing them would report a broken
    // read as a clean bill of health.
    return { status: projection.nodes.length === 0 ? "empty" : "ready", projection };
  } catch {
    return { status: "error" };
  }
}

/**
 * Feature gate for the lens.
 *
 * Default OFF. With the flag unset the selector does not offer the lens and the
 * existing views are untouched; rollback is unsetting the variable, with no
 * migration.
 */
export function isTrustLensEnabled(): boolean {
  return (process.env.LIVING_GRAPH_TRUST_LENS_ENABLED ?? "").toLowerCase() === "true";
}
