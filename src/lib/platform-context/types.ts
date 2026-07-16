export type ContextLevel = "organization" | "portfolio" | "project" | "work_item" | "interaction";
export type ContextFreshness = "current" | "aging" | "expired" | "unknown";
export type ContextAssemblyStatus = "ready" | "partial" | "empty" | "denied";

export interface ContextScope {
  organizationId: string;
  portfolioId?: string | null;
  projectId?: string | null;
  workItemId?: string | null;
  interactionId?: string | null;
}

export interface ContextFragment {
  id: string;
  level: ContextLevel;
  scope: ContextScope;
  key: string;
  value: unknown;
  summary: string;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt?: string | null;
  expiresAt?: string | null;
  authorized: boolean;
  sanitized: boolean;
  priority?: number;
}

export interface ContextAssemblyRequest {
  scope: ContextScope;
  assembledAt: string;
  maximumFragments?: number;
  maximumSummaryCharacters?: number;
}

export interface AssembledContextFragment extends Omit<ContextFragment, "evidenceRefs"> {
  evidenceRefs: string[];
  freshness: ContextFreshness;
}

export interface ContextConflict {
  key: string;
  selectedFragmentId: string;
  rejectedFragmentIds: string[];
  resolution: "most_specific_then_freshest";
}

export interface PlatformContextAssembly {
  contractVersion: "1.0.0";
  status: ContextAssemblyStatus;
  scope: ContextScope;
  assembledAt: string;
  fragments: AssembledContextFragment[];
  conflicts: ContextConflict[];
  excludedFragmentIds: string[];
  evidenceRefs: string[];
  limitations: string[];
  truncated: boolean;
}
