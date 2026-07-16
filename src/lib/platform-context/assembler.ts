import type {
  AssembledContextFragment,
  ContextAssemblyRequest,
  ContextConflict,
  ContextFragment,
  ContextFreshness,
  ContextLevel,
  ContextScope,
  PlatformContextAssembly,
} from "./types";

const LEVEL_RANK: Record<ContextLevel, number> = {
  organization: 1,
  portfolio: 2,
  project: 3,
  work_item: 4,
  interaction: 5,
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function matchesScope(fragment: ContextScope, requested: ContextScope): boolean {
  if (fragment.organizationId !== requested.organizationId) return false;
  for (const key of ["portfolioId", "projectId", "workItemId", "interactionId"] as const) {
    if (fragment[key] && fragment[key] !== requested[key]) return false;
  }
  return true;
}

function freshnessFor(fragment: ContextFragment, assembledAt: string): ContextFreshness {
  const now = new Date(assembledAt).getTime();
  if (fragment.expiresAt && new Date(fragment.expiresAt).getTime() <= now) return "expired";
  if (!fragment.observedAt) return "unknown";
  const ageDays = (now - new Date(fragment.observedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return "unknown";
  return ageDays <= 7 ? "current" : "aging";
}

function compareFragments(left: AssembledContextFragment, right: AssembledContextFragment): number {
  const level = LEVEL_RANK[right.level] - LEVEL_RANK[left.level];
  if (level !== 0) return level;
  const freshness = ({ current: 3, aging: 2, unknown: 1, expired: 0 }[right.freshness]
    - { current: 3, aging: 2, unknown: 1, expired: 0 }[left.freshness]);
  if (freshness !== 0) return freshness;
  const priority = (right.priority ?? 0) - (left.priority ?? 0);
  return priority !== 0 ? priority : left.id.localeCompare(right.id);
}

export function assemblePlatformContext(
  request: ContextAssemblyRequest,
  sourceFragments: readonly ContextFragment[],
): PlatformContextAssembly {
  const maximumFragments = request.maximumFragments ?? 50;
  const maximumSummaryCharacters = request.maximumSummaryCharacters ?? 12_000;
  const excludedFragmentIds: string[] = [];
  const limitations: string[] = [];
  let deniedCount = 0;

  const eligible: AssembledContextFragment[] = [];
  for (const fragment of sourceFragments) {
    if (!matchesScope(fragment.scope, request.scope)) {
      excludedFragmentIds.push(fragment.id);
      continue;
    }
    if (!fragment.authorized || !fragment.sanitized) {
      excludedFragmentIds.push(fragment.id);
      deniedCount += 1;
      continue;
    }
    const freshness = freshnessFor(fragment, request.assembledAt);
    if (freshness === "expired") {
      excludedFragmentIds.push(fragment.id);
      limitations.push(`expired:${fragment.id}`);
      continue;
    }
    eligible.push({ ...fragment, scope: { ...fragment.scope }, evidenceRefs: unique(fragment.evidenceRefs), freshness });
  }

  const byKey = new Map<string, AssembledContextFragment[]>();
  for (const fragment of eligible) byKey.set(fragment.key, [...(byKey.get(fragment.key) ?? []), fragment]);
  const conflicts: ContextConflict[] = [];
  const selected = [...byKey.entries()].map(([key, fragments]) => {
    const ordered = [...fragments].sort(compareFragments);
    if (ordered.length > 1) {
      conflicts.push({
        key,
        selectedFragmentId: ordered[0].id,
        rejectedFragmentIds: ordered.slice(1).map((fragment) => fragment.id).sort(),
        resolution: "most_specific_then_freshest",
      });
    }
    return ordered[0];
  }).sort(compareFragments);

  const fragments: AssembledContextFragment[] = [];
  let usedCharacters = 0;
  let truncated = false;
  for (const fragment of selected) {
    if (fragments.length >= maximumFragments || usedCharacters + fragment.summary.length > maximumSummaryCharacters) {
      truncated = true;
      excludedFragmentIds.push(fragment.id);
      continue;
    }
    fragments.push(fragment);
    usedCharacters += fragment.summary.length;
  }

  if (deniedCount > 0) limitations.push("unauthorized_or_unsanitized_context_excluded");
  if (conflicts.length > 0) limitations.push("context_conflicts_resolved_deterministically");
  if (fragments.some((fragment) => fragment.freshness !== "current")) limitations.push("non_current_context_present");
  if (truncated) limitations.push("context_budget_truncated");

  return {
    contractVersion: "1.0.0",
    status: fragments.length === 0
      ? deniedCount > 0 ? "denied" : "empty"
      : limitations.length > 0 ? "partial" : "ready",
    scope: { ...request.scope },
    assembledAt: request.assembledAt,
    fragments,
    conflicts,
    excludedFragmentIds: unique(excludedFragmentIds),
    evidenceRefs: unique(fragments.flatMap((fragment) => fragment.evidenceRefs)),
    limitations: unique(limitations),
    truncated,
  };
}
