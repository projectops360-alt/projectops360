// ============================================================================
// GitHub Living Graph — horizontal lane packing (GitKraken/gitgraph.js style)
// ============================================================================
// Assigns each branch (a time interval on the x axis) to a horizontal lane so
// that non-overlapping branches REUSE lanes and the canvas height is bounded by
// the max concurrent branches, not the total. Pure + framework-free.
//
// Ordering: ALL intervals by length ASC (short → inner lane, long → outer lane).
// This makes a long branch land on an OUTER lane because the inner lanes are
// already taken by the short branches nested inside its span — so its elbows
// rise above those short segments without crossing them.
//
// Open branches are guaranteed a lane by EVICTION: if an open branch finds no
// free lane within budget, the longest single merged branch that blocks it is
// moved to overflow (it still shows in the spine's merge badges).
// ============================================================================

export interface LaneInterval {
  id: string;
  startX: number; // px in the plot (already clamped to the domain)
  endX: number; // px
  open: boolean; // not merged → lane priority + dashed right tail
  enterLeft: boolean; // diverged before the domain → dashed left entry
}

export type PlacedInterval = LaneInterval & { lane: number }; // lane 0 = closest to master

export interface PackResult {
  placed: PlacedInterval[];
  overflow: LaneInterval[]; // didn't fit the budget → spine badges only
}

const len = (it: LaneInterval) => it.endX - it.startX;

/** Two intervals conflict if their spans (padded by `margin`) touch. */
function conflict(a: LaneInterval, b: LaneInterval, margin: number): boolean {
  return !(a.endX + margin <= b.startX || b.endX + margin <= a.startX);
}

export function packLanes(intervals: LaneInterval[], budget: number, pillMargin = 12): PackResult {
  // Short first; deterministic tiebreak by startX then id.
  const order = intervals.slice().sort((a, b) => len(a) - len(b) || a.startX - b.startX || a.id.localeCompare(b.id));

  const lanes: PlacedInterval[][] = [];
  const placed: PlacedInterval[] = [];
  const overflow: LaneInterval[] = [];

  const laneFreeFor = (L: number, it: LaneInterval) => (lanes[L] ?? []).every((p) => !conflict(p, it, pillMargin));

  for (const it of order) {
    let lane = -1;
    for (let L = 0; L < budget; L++) {
      if (laneFreeFor(L, it)) { lane = L; break; }
    }

    if (lane !== -1) {
      const p: PlacedInterval = { ...it, lane };
      (lanes[lane] ??= []).push(p);
      placed.push(p);
      continue;
    }

    // No free lane. Open branches get priority by evicting the longest single
    // merged blocker that, once removed, frees a lane for this interval.
    if (it.open) {
      let best: { L: number; victim: PlacedInterval } | null = null;
      for (let L = 0; L < budget; L++) {
        const blockers = (lanes[L] ?? []).filter((p) => conflict(p, it, pillMargin));
        if (blockers.length === 1 && !blockers[0].open) {
          const victim = blockers[0];
          if (!best || len(victim) > len(best.victim)) best = { L, victim };
        }
      }
      if (best) {
        lanes[best.L] = lanes[best.L].filter((p) => p !== best.victim);
        placed.splice(placed.indexOf(best.victim), 1);
        const { lane: _drop, ...bare } = best.victim;
        void _drop;
        overflow.push(bare);
        const p: PlacedInterval = { ...it, lane: best.L };
        lanes[best.L].push(p);
        placed.push(p);
        continue;
      }
    }

    overflow.push(it);
  }

  return { placed, overflow };
}
