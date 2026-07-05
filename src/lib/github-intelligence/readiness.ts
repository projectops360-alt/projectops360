// ============================================================================
// GitHub Intelligence — deterministic release readiness score
// ============================================================================
// An execution SIGNAL, not canonical truth and not a replacement for human
// approval. Pure + framework-free so it is fully unit-testable.
// ============================================================================

import type {
  BranchSnapshot,
  DeploymentSnapshot,
  PullRequestSnapshot,
  ReadinessBand,
  ReadinessResult,
  WorkflowRunSnapshot,
} from "./types";

export interface ReadinessInput {
  branches: BranchSnapshot[];
  pullRequests: PullRequestSnapshot[];
  workflowRuns: WorkflowRunSnapshot[];
  deployments: DeploymentSnapshot[];
}

export function bandFor(score: number): ReadinessBand {
  if (score >= 85) return "good";
  if (score >= 65) return "watch";
  if (score >= 40) return "at_risk";
  return "blocked";
}

/**
 * Start at 100 and subtract for recent GitHub evidence. Clamped to [0, 100].
 * Deductions are additive and independent (each condition applies once).
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const deductions: ReadinessResult["deductions"] = [];
  const add = (reason: string, points: number) => deductions.push({ reason, points });

  const failedWorkflow = input.workflowRuns.some((w) => w.conclusion === "failure");
  if (failedWorkflow) add("workflow_failure", 20);

  const changesRequested = input.pullRequests.some(
    (p) => p.state === "open" && p.review_state === "changes_requested",
  );
  if (changesRequested) add("pr_changes_requested", 15);

  const activeHotfix = input.branches.some((b) => b.branch_type === "hotfix" && b.status === "active");
  if (activeHotfix) add("active_hotfix", 10);

  // Feature/other branch with recent commits but no open PR = unreviewed work.
  const commitsWithoutPr = input.branches.some(
    (b) =>
      (b.branch_type === "feature" || b.branch_type === "other") &&
      b.status === "active" &&
      b.commit_count_window > 0 &&
      b.open_pr_number == null,
  );
  if (commitsWithoutPr) add("commits_without_pr", 10);

  const releaseBranches = input.branches.filter((b) => b.branch_type === "release");
  if (releaseBranches.length > 0) {
    const releaseHasGreenCi = input.workflowRuns.some(
      (w) =>
        w.conclusion === "success" &&
        releaseBranches.some((b) => b.branch_name === w.branch_name),
    );
    if (!releaseHasGreenCi) add("release_without_green_ci", 10);
  }

  const hasDeploymentSignal =
    input.deployments.length > 0 ||
    input.workflowRuns.some((w) => (w.workflow_name ?? "").toLowerCase().includes("deploy"));
  if (!hasDeploymentSignal) add("no_deployment_signal", 5);

  const totalDeducted = deductions.reduce((sum, d) => sum + d.points, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeducted));

  return { score, band: bandFor(score), deductions };
}

const BAND_LABELS: Record<ReadinessBand, { en: string; es: string }> = {
  good: { en: "Good", es: "Bien" },
  watch: { en: "Watch", es: "Vigilar" },
  at_risk: { en: "At Risk", es: "En riesgo" },
  blocked: { en: "Blocked", es: "Bloqueado" },
};

export function readinessBandLabel(band: ReadinessBand, isEs: boolean): string {
  return isEs ? BAND_LABELS[band].es : BAND_LABELS[band].en;
}
