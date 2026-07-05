// ============================================================================
// GitHub Intelligence — deterministic branch classification
// ============================================================================
// Pure, framework-free. Maps a branch name (+ the repo default branch) to one
// of the fishbone lanes. Prefix rules are intentionally simple and stable;
// customization is a documented follow-up, not built here.
// ============================================================================

import type { BranchType } from "./types";

const MAIN_NAMES = new Set(["main", "master", "trunk", "develop", "development"]);

const PREFIX_RULES: Array<{ type: BranchType; prefixes: string[] }> = [
  { type: "feature", prefixes: ["feature/", "feat/", "story/", "task/"] },
  { type: "hotfix", prefixes: ["hotfix/", "fix/", "bugfix/", "emergency/"] },
  { type: "release", prefixes: ["release/", "rel/", "rc/"] },
];

/**
 * Classify a branch into a fishbone lane.
 * @param branchName raw ref name (without `refs/heads/`)
 * @param defaultBranch the repository default branch (always classified `main`)
 */
export function classifyBranch(branchName: string, defaultBranch?: string | null): BranchType {
  if (!branchName) return "other";
  const name = branchName.trim();
  const lower = name.toLowerCase();

  if (defaultBranch && lower === defaultBranch.trim().toLowerCase()) return "main";
  if (MAIN_NAMES.has(lower)) return "main";

  for (const rule of PREFIX_RULES) {
    if (rule.prefixes.some((p) => lower.startsWith(p))) return rule.type;
  }
  return "other";
}

/** Strip a `refs/heads/` or `refs/tags/` prefix from a git ref. */
export function refToBranchName(ref: string | null | undefined): string | null {
  if (!ref) return null;
  return ref.replace(/^refs\/(heads|tags)\//, "");
}
