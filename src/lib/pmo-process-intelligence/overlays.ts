// ============================================================================
// PMO Process Intelligence — risk / dependency overlay engines (CAP-047 · M6)
// ============================================================================
// Pure, deterministic derivations. Risk propagation follows EXPLICIT task
// dependencies only (BFS over task_dependencies) — systemic exposure is
// calculated from recorded structure, never inferred from proximity.
// Benefits/strategy have NO data model yet: that absence is declared by the
// UI, never faked. Every figure carries its source tables.
// ============================================================================

export interface PmoPiRiskInput {
  id: string;
  projectId: string;
  title: string;
  category: string;
  probability: string;
  impact: string;
  severity: string;
  status: string;
  linkedTaskId: string | null;
}

export interface PmoPiDependencyInput {
  projectId: string;
  predecessorId: string;
  successorId: string;
}

export interface PmoPiRiskProjectRow {
  projectId: string;
  openCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface PmoPiSystemicRisk {
  riskId: string;
  projectId: string;
  title: string;
  severity: string;
  status: string;
  linkedTaskId: string;
  /** Tasks reachable downstream from the linked task via recorded deps. */
  downstreamTaskCount: number;
}

export interface PmoPiRiskOverlay {
  rows: PmoPiRiskProjectRow[];
  systemic: PmoPiSystemicRisk[];
  criticalOpenCount: number;
  totalOpenCount: number;
  source: string;
}

const OPEN_STATUSES = new Set(["open", "mitigating"]);

/** BFS downstream reach over explicit dependencies (recorded, never inferred). */
export function downstreamReach(
  startTaskId: string,
  deps: readonly PmoPiDependencyInput[],
): number {
  const next = new Map<string, string[]>();
  for (const d of deps) {
    const list = next.get(d.predecessorId) ?? [];
    list.push(d.successorId);
    next.set(d.predecessorId, list);
  }
  const seen = new Set<string>();
  const queue = [...(next.get(startTaskId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of next.get(id) ?? []) if (!seen.has(n)) queue.push(n);
  }
  return seen.size;
}

export function buildRiskOverlay(
  risks: readonly PmoPiRiskInput[],
  deps: readonly PmoPiDependencyInput[],
): PmoPiRiskOverlay {
  const byProject = new Map<string, PmoPiRiskProjectRow>();
  const systemic: PmoPiSystemicRisk[] = [];
  let criticalOpenCount = 0;
  let totalOpenCount = 0;

  for (const r of risks) {
    if (!OPEN_STATUSES.has(r.status)) continue;
    totalOpenCount++;
    const row = byProject.get(r.projectId) ?? {
      projectId: r.projectId,
      openCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    };
    row.openCount++;
    if (r.severity === "critical") {
      row.criticalCount++;
      criticalOpenCount++;
    } else if (r.severity === "high") row.highCount++;
    else if (r.severity === "medium") row.mediumCount++;
    else row.lowCount++;
    byProject.set(r.projectId, row);

    // Propagation: only risks explicitly linked to a task can propagate, and
    // only along recorded dependencies.
    if (r.linkedTaskId) {
      const downstream = downstreamReach(r.linkedTaskId, deps);
      if (downstream > 0 && (r.severity === "critical" || r.severity === "high" || downstream >= 3)) {
        systemic.push({
          riskId: r.id,
          projectId: r.projectId,
          title: r.title,
          severity: r.severity,
          status: r.status,
          linkedTaskId: r.linkedTaskId,
          downstreamTaskCount: downstream,
        });
      }
    }
  }

  systemic.sort((a, b) => b.downstreamTaskCount - a.downstreamTaskCount || a.riskId.localeCompare(b.riskId));

  return {
    rows: [...byProject.values()].sort((a, b) => b.criticalCount - a.criticalCount || b.openCount - a.openCount),
    systemic,
    criticalOpenCount,
    totalOpenCount,
    source: "risks + task_dependencies",
  };
}

// ── Dependencies overlay ─────────────────────────────────────────────────────

export interface PmoPiDependencyHub {
  taskId: string;
  projectId: string;
  outDegree: number;
}

export interface PmoPiDependencyOverlay {
  perProject: { projectId: string; dependencyCount: number }[];
  /** Tasks whose completion unblocks the most successors (top 5). */
  hubs: PmoPiDependencyHub[];
  totalDependencies: number;
  /** Honest disclosure: the data model records intra-project deps only. */
  limitations: string[];
  source: string;
}

export function buildDependencyOverlay(deps: readonly PmoPiDependencyInput[]): PmoPiDependencyOverlay {
  const perProject = new Map<string, number>();
  const outDegree = new Map<string, { projectId: string; n: number }>();
  for (const d of deps) {
    perProject.set(d.projectId, (perProject.get(d.projectId) ?? 0) + 1);
    const cur = outDegree.get(d.predecessorId) ?? { projectId: d.projectId, n: 0 };
    cur.n++;
    outDegree.set(d.predecessorId, cur);
  }
  const hubs = [...outDegree.entries()]
    .map(([taskId, v]) => ({ taskId, projectId: v.projectId, outDegree: v.n }))
    .sort((a, b) => b.outDegree - a.outDegree || a.taskId.localeCompare(b.taskId))
    .slice(0, 5);

  return {
    perProject: [...perProject.entries()]
      .map(([projectId, dependencyCount]) => ({ projectId, dependencyCount }))
      .sort((a, b) => b.dependencyCount - a.dependencyCount),
    hubs,
    totalDependencies: deps.length,
    limitations: ["only_intra_project_dependencies_are_recorded"],
    source: "task_dependencies",
  };
}

// ── Capacity summary (mapped from the canonical capacity engine) ────────────

export interface PmoPiCapacityProjectSummary {
  projectId: string;
  hasCapacityInputs: boolean;
  workforceAvailabilityPercent: number | null;
  overallocatedResourceCount: number;
  atRiskMilestoneCount: number;
  unassignedCriticalTaskCount: number;
}
