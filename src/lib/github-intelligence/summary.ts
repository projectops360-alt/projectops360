// ============================================================================
// GitHub Intelligence — deterministic Isabella-ready summary
// ============================================================================
// NO LLM call. Turns snapshots + readiness into a short, explainable summary
// (what changed / primary risk / recommendation / readiness). This is the
// contract Isabella will consume; deeper analysis is a documented follow-up.
//
// Pure + framework-free. Never mutates canonical data.
// ============================================================================

import type {
  BranchSnapshot,
  GitHubIntelligenceSummary,
  PullRequestSnapshot,
  ReadinessResult,
  ReleaseSnapshot,
  WorkflowRunSnapshot,
} from "./types";

export interface SummaryInput {
  branches: BranchSnapshot[];
  pullRequests: PullRequestSnapshot[];
  workflowRuns: WorkflowRunSnapshot[];
  releases: ReleaseSnapshot[];
  commitCount: number;
  readiness: ReadinessResult;
  isEs?: boolean;
}

export function buildGitHubSummary(input: SummaryInput): GitHubIntelligenceSummary {
  const isEs = input.isEs ?? false;
  const openPrs = input.pullRequests.filter((p) => p.state === "open").length;
  const activeBranches = input.branches.filter((b) => b.status === "active").length;
  const activeHotfixes = input.branches.filter((b) => b.branch_type === "hotfix" && b.status === "active");
  const failedRun = input.workflowRuns.find((w) => w.conclusion === "failure");
  const latestRelease = [...input.releases]
    .filter((r) => !r.draft && r.published_at)
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())[0];

  // ── What changed ───────────────────────────────────────────────────────────
  let summary: string;
  if (input.commitCount === 0 && activeBranches === 0) {
    summary = isEs
      ? "No hay actividad reciente en el repositorio para esta ventana."
      : "No recent repository activity in this window.";
  } else {
    const parts: string[] = [];
    parts.push(
      isEs
        ? `${input.commitCount} commit(s) en ${activeBranches} rama(s) activa(s)`
        : `${input.commitCount} commit(s) across ${activeBranches} active branch(es)`,
    );
    if (openPrs > 0) parts.push(isEs ? `${openPrs} PR abierto(s)` : `${openPrs} open PR(s)`);
    const base = parts.join(isEs ? ", " : ", ");
    const health =
      input.readiness.band === "good"
        ? isEs
          ? "El desarrollo avanza con normalidad."
          : "Development is progressing normally."
        : isEs
          ? "El desarrollo avanza, con puntos que requieren atención."
          : "Development is progressing, with items needing attention.";
    summary = `${health} ${base}${activeHotfixes.length > 0 ? (isEs ? `. ${activeHotfixes.length} hotfix requiere atención` : `. ${activeHotfixes.length} hotfix branch needs attention`) : ""}.`;
  }

  // ── Primary risk (single most important) ─────────────────────────────────────
  let risk: string | null = null;
  if (failedRun) {
    risk = isEs
      ? `El workflow "${failedRun.workflow_name ?? "CI"}" falló${failedRun.branch_name ? ` en ${failedRun.branch_name}` : ""}.`
      : `Workflow "${failedRun.workflow_name ?? "CI"}" failed${failedRun.branch_name ? ` on ${failedRun.branch_name}` : ""}.`;
  } else if (input.pullRequests.some((p) => p.state === "open" && p.review_state === "changes_requested")) {
    risk = isEs
      ? "Un PR abierto tiene cambios solicitados en revisión."
      : "An open PR has requested changes in review.";
  } else if (activeHotfixes.length > 0) {
    risk = isEs
      ? `Hay ${activeHotfixes.length} rama(s) hotfix activa(s).`
      : `${activeHotfixes.length} active hotfix branch(es).`;
  }

  // ── Recommendation ───────────────────────────────────────────────────────────
  let recommendation: string | null = null;
  if (failedRun) {
    recommendation = isEs
      ? "Corrige el workflow fallido antes del release a producción."
      : "Fix the failing workflow before the production release.";
  } else if (openPrs > 0) {
    recommendation = isEs
      ? "Revisa y fusiona los PR abiertos para consolidar el trabajo."
      : "Review and merge the open PRs to consolidate work.";
  } else if (latestRelease) {
    recommendation = isEs
      ? `Verifica la readiness antes de promover ${latestRelease.tag_name}.`
      : `Confirm readiness before promoting ${latestRelease.tag_name}.`;
  }

  return {
    summary,
    risk,
    recommendation,
    readinessScore: input.readiness.score,
    readinessBand: input.readiness.band,
  };
}
