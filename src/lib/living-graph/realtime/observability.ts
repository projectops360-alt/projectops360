// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Observability (Phase 4, Task 1)
// ============================================================================
// Every engine tick (coalescing window / plan cycle) MUST emit an immutable
// tick summary. Deterministic: the clock is injected, never Date.now() inside
// derived math (mirrors src/lib/milestone-flow/observability.ts).
// ============================================================================

import { LGRE_ENGINE_VERSION, LGRE_CONFIG_VERSION } from "./constants";
import type { LivingGraphRealtimeScope, LivingGraphRealtimeTickSummary } from "./types";

let tickCounter = 0;

/** Deterministic-enough tick id; a seed makes tests fully reproducible. */
export function newTickId(seed?: string): string {
  tickCounter += 1;
  return seed ? `lgre-tick-${seed}-${tickCounter}` : `lgre-tick-${tickCounter}`;
}

export interface LgreTickContext {
  tickId: string;
  organizationId: string;
  projectId: string | null;
  startedAt: Date;
}

export function openTickContext(args: {
  scope: LivingGraphRealtimeScope;
  now?: () => Date;
  tickIdSeed?: string;
}): LgreTickContext {
  const now = args.now ?? (() => new Date());
  return {
    tickId: newTickId(args.tickIdSeed),
    organizationId: args.scope.organizationId,
    projectId: args.scope.projectId ?? null,
    startedAt: now(),
  };
}

export interface LgreTickCounts {
  noticesReceived: number;
  noticesCoalesced: number;
  noticesRejected: number;
  plansEmitted: number;
  deltasEmitted: number;
  fullResyncsRequested: number;
  warnings?: readonly string[];
}

export function closeTickSummary(
  ctx: LgreTickContext,
  counts: LgreTickCounts,
  now?: () => Date,
): LivingGraphRealtimeTickSummary {
  const clock = now ?? (() => new Date());
  const finishedAt = clock();
  const warnings = counts.warnings ?? [];
  return {
    tickId: ctx.tickId,
    organizationId: ctx.organizationId,
    projectId: ctx.projectId,
    startedAt: ctx.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - ctx.startedAt.getTime(),
    noticesReceived: counts.noticesReceived,
    noticesCoalesced: counts.noticesCoalesced,
    noticesRejected: counts.noticesRejected,
    plansEmitted: counts.plansEmitted,
    deltasEmitted: counts.deltasEmitted,
    fullResyncsRequested: counts.fullResyncsRequested,
    warningCount: warnings.length,
    warnings: [...warnings],
    engineVersion: LGRE_ENGINE_VERSION,
    configVersion: LGRE_CONFIG_VERSION,
  };
}
