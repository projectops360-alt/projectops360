// ============================================================================
// ProjectOps360° — Product Brain Control Center — data model (client-safe types)
// ============================================================================
// A structured index OVER the canonical Product Brain markdown (docs/product-brain).
// Markdown stays the source of truth; each item cites its source_path/section so
// the Control Center is an index, not a disconnected system. Status/test metadata
// makes the governance state trackable in-app (hybrid strategy, Option C).
// ============================================================================

export type ProductBrainItemType =
  | "product_decision"
  | "regression"
  | "ux_contract"
  | "adr"
  | "cap"
  | "module"
  | "sprint"
  | "known_gap"
  | "technical_debt"
  | "ai_development_rule"
  | "navigation_rule"
  | "security_rule";

export type ProductBrainStatus =
  | "proposed"
  | "approved"
  | "in_progress"
  | "implemented"
  | "protected_by_test"
  | "needs_test"
  | "blocked"
  | "needs_review"
  | "deprecated"
  | "resolved"
  | "closed";

export type ProductBrainTestStatus =
  | "not_required"
  | "missing"
  | "manual_only"
  | "unit_tested"
  | "integration_tested"
  | "e2e_tested"
  | "protected";

export type ProductBrainPriority = "p1" | "p2" | "p3";
export type ProductBrainSeverity = "critical" | "high" | "medium" | "low" | "none";

export interface ProductBrainItem {
  itemKey: string;
  title: string;
  type: ProductBrainItemType;
  status: ProductBrainStatus;
  module: string | null;
  priority: ProductBrainPriority | null;
  severity: ProductBrainSeverity;
  owner: string | null;
  /** Posix path within docs/product-brain (the canonical source). */
  sourcePath: string;
  sourceSection: string | null;
  summary: string;
  /** The decision / expected behavior, when applicable. */
  decision: string | null;
  expectedBehavior: string | null;
  protectionRule: string | null;
  implementationStatus: string | null;
  testStatus: ProductBrainTestStatus;
  /** Repo-relative test files that protect this item. */
  testFiles: string[];
  /** Steps to verify the behavior in-app. */
  verificationSteps: string[];
  relatedItems: string[];
  tags: string[];
  lastReviewed: string | null;
  notes: string | null;
}

export interface ProductBrainSummary {
  total: number;
  productDecisions: number;
  openRegressions: number;
  closedRegressions: number;
  protectedByTest: number;
  needsTest: number;
  needsReview: number;
  highPriority: number;
  modulesWithGaps: number;
}
