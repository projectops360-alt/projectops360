// ============================================================================
// PMO Intelligence Center — the layer the graph shell accepts (CAP-048 P2)
// ============================================================================
// The Phase 1 canvas knows nothing about lenses, scopes or read models, and it
// stays that way. Phase 2 hands it ONE optional prop shaped like this, so the
// two milestones compose without the graph growing a dependency on the
// orchestration layer.
//
// Everything here is already-computed. The shell renders it; it does not derive
// anything from it (ADR-012).
// ============================================================================

import type { PmoDashboardSlice } from "@/lib/pmo-intelligence/dashboard-model";
import type { LensProjectionInput } from "@/lib/pmo-intelligence/lens-projection";
import type { PmoScope } from "@/lib/pmo-intelligence/scope";
import type { PmoProjectOption } from "./global-filters";

export interface PmoIntelligenceLayerProps {
  /** Scope parsed from the URL on the server, so the first paint matches it. */
  initialScope: PmoScope;
  /**
   * Everything the lenses read, already normalised by the read model.
   *
   * The graph half (`nodes`, `edges`, `criticalNodeIds`) is filled in by the
   * shell from the props it already has — sending it twice would let the two
   * copies drift.
   */
  lensData: Omit<LensProjectionInput, "nodes" | "edges" | "criticalNodeIds">;
  /**
   * KPIs, health, focus, critical path, insights and what-if inputs
   * (Milestones 5 and 6), already flattened for the server-action boundary.
   *
   * Flat because a `Map` does not survive a server action: sending the raw read
   * model would work on the server render and silently degrade after the first
   * client reload — the failure that only appears once someone touches a filter.
   */
  dashboard: PmoDashboardSlice;
  /** Options for the project multi-select. */
  projects: PmoProjectOption[];
  organizationName: string;
  /** Sources the read model could not reach, named so the UI can say which. */
  unavailableSources: string[];
}
