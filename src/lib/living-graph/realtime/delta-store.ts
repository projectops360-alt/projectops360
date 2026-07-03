// ============================================================================
// ProjectOps360° — LGRE · Delta Store & Sync Contract (Phase 4, Task 4)
// ============================================================================
// A replay-safe DELIVERY store — NOT canonical truth. It ingests Task 3
// recalculation results (via the hierarchy-safe builder), assigns a monotonic
// version per scope, retains a bounded window of recent deltas for missed-
// update recovery, deduplicates, and answers sync requests: noop (fresh) /
// ordered deltas (safe replay) / full_resync (gap / mismatch / too stale) /
// unauthorized (RBAC deny-by-default). It never mutates canonical data, never
// writes project_event_log / process_nodes / process_edges, and builds no UI.
// ============================================================================

import { LGRE_ENGINE_VERSION, LGRE_CONFIG_VERSION, LGRE_DELTA_STORE_DEFAULTS } from "./constants";
import { resolveLivingGraphRealtimeAccess } from "./security";
import { LgreUnauthorizedAccessError, LgreMissingProjectScopeError } from "./errors";
import { buildHierarchicalDelta } from "./delta-builder";
import type {
  HierarchicalGraphDelta,
  GraphSnapshotDescriptor,
  GraphSyncRequest,
  GraphSyncResponse,
  LivingGraphRootScope,
  DeltaStoreObservability,
} from "./delta-types";
import type { LivingGraphRecalculationResult } from "./recalculation-types";
import type {
  LivingGraphRealtimeProjectScope,
  LivingGraphRealtimeAccessContext,
} from "./types";

const DEFAULT_ROOT_SCOPE: LivingGraphRootScope = { type: "project", id: null };

interface StoreCounters {
  deltasCreated: number;
  nodesAdded: number;
  nodesChanged: number;
  nodesRemoved: number;
  edgesAdded: number;
  edgesChanged: number;
  edgesRemoved: number;
  emptyDeltas: number;
  duplicateDeltasIgnored: number;
  missedUpdateRecoveries: number;
  fullResyncDecisions: number;
  staleClients: number;
  freshClients: number;
  unauthorizedRequests: number;
  versionMismatches: number;
  evidenceLayerDeltas: number;
  hierarchyLayerDeltas: number;
  dependencyLayerDeltas: number;
}

function zeroCounters(): StoreCounters {
  return {
    deltasCreated: 0,
    nodesAdded: 0,
    nodesChanged: 0,
    nodesRemoved: 0,
    edgesAdded: 0,
    edgesChanged: 0,
    edgesRemoved: 0,
    emptyDeltas: 0,
    duplicateDeltasIgnored: 0,
    missedUpdateRecoveries: 0,
    fullResyncDecisions: 0,
    staleClients: 0,
    freshClients: 0,
    unauthorizedRequests: 0,
    versionMismatches: 0,
    evidenceLayerDeltas: 0,
    hierarchyLayerDeltas: 0,
    dependencyLayerDeltas: 0,
  };
}

export interface CreateLivingGraphDeltaStoreOptions {
  now?: () => Date;
  idSeed?: string;
  /** Retained delta window for missed-update recovery. */
  retainedDeltaWindow?: number;
  /** Node/edge counts for the current snapshot (for the descriptor). */
  snapshotCounts?: () => { nodeCount: number; edgeCount: number };
}

export interface IngestResult {
  delta: HierarchicalGraphDelta;
  version: number;
}

export interface LivingGraphDeltaStore {
  /** Convert a recalc result into a versioned hierarchy-safe delta + retain it. */
  ingestRecalculation(args: {
    result: LivingGraphRecalculationResult;
    rootScope?: LivingGraphRootScope;
    evidenceLayerIncluded?: boolean;
  }): IngestResult;
  /** Current snapshot descriptor (version + recoverable window). */
  getSnapshotDescriptor(rootScope?: LivingGraphRootScope): GraphSnapshotDescriptor;
  /** RBAC-gated sync: noop / deltas / full_resync / unauthorized. */
  requestSync(request: GraphSyncRequest): GraphSyncResponse;
  /** Immutable observability summary (never exposes unauthorized data). */
  observability(rootScope?: LivingGraphRootScope): DeltaStoreObservability;
}

/**
 * Create an in-memory delta store for ONE project scope. The store is a
 * delivery mechanism; a durable log (e.g. a Supabase table) is the documented
 * upgrade path but is out of scope for this task.
 */
export function createLivingGraphDeltaStore(
  scope: LivingGraphRealtimeProjectScope,
  options: CreateLivingGraphDeltaStoreOptions = {},
): LivingGraphDeltaStore {
  if (!scope.organizationId) throw new LgreMissingProjectScopeError("organizationId required");
  if (!scope.projectId) throw new LgreMissingProjectScopeError();

  const now = options.now ?? (() => new Date());
  const window = options.retainedDeltaWindow ?? LGRE_DELTA_STORE_DEFAULTS.retainedDeltaWindow;
  let counter = 0;
  let currentVersion = 0;
  const retained: HierarchicalGraphDelta[] = []; // ordered by producedVersion asc
  const seenDeltaIds = new Set<string>();
  const counters = zeroCounters();
  const warnings: string[] = [];

  function newDeltaId(): string {
    counter += 1;
    return options.idSeed ? `lgre-hdelta-${options.idSeed}-${counter}` : `lgre-hdelta-${counter}`;
  }

  function authorized(access: LivingGraphRealtimeAccessContext): boolean {
    return resolveLivingGraphRealtimeAccess(access, scope).allowed;
  }

  function countLayers(delta: HierarchicalGraphDelta): void {
    for (const kind of delta.scope.affectedLayerKinds) {
      if (kind === "evidence") counters.evidenceLayerDeltas += 1;
      else if (kind === "dependency") counters.dependencyLayerDeltas += 1;
      else if (kind === "hierarchy") counters.hierarchyLayerDeltas += 1;
    }
  }

  function countEntities(delta: HierarchicalGraphDelta): void {
    for (const n of delta.nodeDeltas) {
      if (n.change === "added") counters.nodesAdded += 1;
      else if (n.change === "updated") counters.nodesChanged += 1;
      else counters.nodesRemoved += 1;
    }
    for (const e of delta.edgeDeltas) {
      if (e.change === "added") counters.edgesAdded += 1;
      else if (e.change === "updated") counters.edgesChanged += 1;
      else counters.edgesRemoved += 1;
    }
  }

  function oldestRecoverableVersion(): number {
    // The oldest CLIENT version we can still recover: the base of the oldest
    // retained delta (a client at that version can replay forward from it).
    return retained.length > 0 ? retained[0].basedOnVersion : currentVersion;
  }

  return {
    ingestRecalculation({ result, rootScope = DEFAULT_ROOT_SCOPE, evidenceLayerIncluded = false }) {
      const basedOnVersion = currentVersion;
      const producedVersion = currentVersion + 1;
      const delta = buildHierarchicalDelta({
        recalcResult: result,
        rootScope,
        producedVersion,
        basedOnVersion,
        evidenceLayerIncluded,
        deltaId: newDeltaId(),
        now,
      });

      // Idempotent: a delta id already ingested is ignored (dedup).
      if (seenDeltaIds.has(delta.deltaId)) {
        counters.duplicateDeltasIgnored += 1;
        return { delta, version: currentVersion };
      }
      seenDeltaIds.add(delta.deltaId);

      currentVersion = producedVersion;
      counters.deltasCreated += 1;
      if (delta.isEmpty) counters.emptyDeltas += 1;
      countEntities(delta);
      countLayers(delta);

      retained.push(delta);
      while (retained.length > window) {
        const evicted = retained.shift();
        if (evicted) seenDeltaIds.delete(evicted.deltaId);
      }
      return { delta, version: currentVersion };
    },

    getSnapshotDescriptor(rootScope = DEFAULT_ROOT_SCOPE) {
      const counts = options.snapshotCounts?.() ?? { nodeCount: 0, edgeCount: 0 };
      return {
        scope,
        rootScope,
        snapshotVersion: currentVersion,
        generatedAt: now().toISOString(),
        nodeCount: counts.nodeCount,
        edgeCount: counts.edgeCount,
        oldestRecoverableVersion: oldestRecoverableVersion(),
        engineVersion: LGRE_ENGINE_VERSION,
        configVersion: LGRE_CONFIG_VERSION,
      };
    },

    requestSync(request: GraphSyncRequest): GraphSyncResponse {
      // Deny-by-default RBAC + absolute tenant isolation. A mismatched scope is
      // treated as unauthorized (never leaks another project/org).
      if (
        request.scope.projectId !== scope.projectId ||
        request.scope.organizationId !== scope.organizationId ||
        !authorized(request.access)
      ) {
        counters.unauthorizedRequests += 1;
        return { kind: "unauthorized", reason: "unauthorized_or_out_of_scope", deltas: [], snapshot: null, targetVersion: null };
      }

      const since = request.sinceVersion;
      const rootScope = request.rootScope ?? DEFAULT_ROOT_SCOPE;

      // Fresh client already at the current version.
      if (since === currentVersion) {
        counters.freshClients += 1;
        return { kind: "noop", reason: "already_current", deltas: [], snapshot: null, targetVersion: currentVersion };
      }

      // A client ahead of us, or a brand-new client → full resync.
      if (since === null || since > currentVersion) {
        counters.fullResyncDecisions += 1;
        if (since != null && since > currentVersion) counters.versionMismatches += 1;
        return {
          kind: "full_resync",
          reason: since === null ? "new_client" : "client_ahead_of_store",
          deltas: [],
          snapshot: this.getSnapshotDescriptor(rootScope),
          targetVersion: currentVersion,
        };
      }

      // Stale client: can we replay contiguous deltas since `since`?
      counters.staleClients += 1;
      const oldest = oldestRecoverableVersion();
      if (since < oldest) {
        // The missed window was evicted — a safe partial merge is impossible.
        counters.fullResyncDecisions += 1;
        return {
          kind: "full_resync",
          reason: "missed_delta_window_evicted",
          deltas: [],
          snapshot: this.getSnapshotDescriptor(rootScope),
          targetVersion: currentVersion,
        };
      }

      // Contiguous ordered deltas strictly after `since`.
      const missed = retained
        .filter((d) => d.producedVersion > since)
        .sort((a, b) => a.producedVersion - b.producedVersion);
      // Contiguity guard: the first missed delta must be based on `since`.
      if (missed.length === 0 || missed[0].basedOnVersion !== since) {
        counters.fullResyncDecisions += 1;
        return {
          kind: "full_resync",
          reason: "non_contiguous_delta_chain",
          deltas: [],
          snapshot: this.getSnapshotDescriptor(rootScope),
          targetVersion: currentVersion,
        };
      }
      counters.missedUpdateRecoveries += 1;
      return { kind: "deltas", reason: "ordered_missed_deltas", deltas: missed, snapshot: null, targetVersion: currentVersion };
    },

    observability(rootScope = DEFAULT_ROOT_SCOPE): DeltaStoreObservability {
      return {
        projectId: scope.projectId,
        rootScopeType: rootScope.type,
        currentVersion,
        ...counters,
        warnings: [...warnings],
      };
    },
  };
}

/** Convenience: build a delta without a store (pure, for one-shot delivery). */
export function buildDeltaFromRecalculation(args: {
  result: LivingGraphRecalculationResult;
  basedOnVersion: number;
  producedVersion: number;
  rootScope?: LivingGraphRootScope;
  evidenceLayerIncluded?: boolean;
  deltaId: string;
  now?: () => Date;
}): HierarchicalGraphDelta {
  return buildHierarchicalDelta({
    recalcResult: args.result,
    rootScope: args.rootScope ?? DEFAULT_ROOT_SCOPE,
    producedVersion: args.producedVersion,
    basedOnVersion: args.basedOnVersion,
    evidenceLayerIncluded: args.evidenceLayerIncluded ?? false,
    deltaId: args.deltaId,
    now: args.now ?? (() => new Date()),
  });
}

// Re-export for the engine wiring (buildDelta delegates here). Kept named so the
// unauthorized error type is available at the delivery boundary.
export { LgreUnauthorizedAccessError };
