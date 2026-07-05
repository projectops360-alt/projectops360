// ============================================================================
// GitHub Intelligence — Isabella context provider (SERVER ONLY)
// ============================================================================
// The ONLY sanctioned entry point for Isabella to receive GitHub context.
// Returns null unless ALL conditions hold:
//   (a) GITHUB_INTELLIGENCE_ENABLED = true
//   (b) project is software
//   (c) a repository is connected
//   (d) the user has permission (org/project scoping via the guard)
// For non-software projects it returns null — Isabella must not mention GitHub
// unless the user explicitly asks WHY it is unavailable (see whyUnavailable()).
// Never mutates canonical task/milestone/risk/decision data.
// ============================================================================

import "server-only";
import { assertGitHubIntelligenceAvailable } from "./software-project-guard";
import { loadDashboardData, type DateWindow } from "./read-model";
import type { GitHubIntelligenceSummary } from "./types";

export interface IsabellaGitHubContext extends GitHubIntelligenceSummary {
  repositoryFullName: string;
  windowDays: DateWindow;
}

/**
 * Deterministic GitHub summary for Isabella. Returns null when unavailable
 * (feature off, non-software, no repo, or no permission) — Isabella then simply
 * has no GitHub context and must not raise the topic.
 */
export async function getGitHubIntelligenceSummary(
  projectId: string,
  options: { windowDays?: DateWindow; isEs?: boolean } = {},
): Promise<IsabellaGitHubContext | null> {
  const guard = await assertGitHubIntelligenceAvailable(projectId);
  if (!guard.ok) return null;

  const data = await loadDashboardData(guard.org, projectId, {
    windowDays: options.windowDays,
    isEs: options.isEs,
  });
  if (!data.repository) return null; // no repository connected → no context

  return {
    ...data.summary,
    repositoryFullName: data.repository.fullName,
    windowDays: data.windowDays,
  };
}

/**
 * The canonical answer when a user in a NON-software project asks why GitHub
 * Intelligence is unavailable. Isabella uses this verbatim (i18n aware).
 */
export function whyGitHubUnavailable(isEs: boolean): string {
  return isEs
    ? "GitHub Intelligence está disponible solo para proyectos de software porque se basa en la actividad del repositorio: commits, ramas, pull requests, workflows y releases."
    : "GitHub Intelligence is available only for software projects because it relies on repository activity such as commits, branches, pull requests, workflows and releases.";
}
