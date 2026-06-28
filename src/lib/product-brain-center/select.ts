// ============================================================================
// ProjectOps360° — Product Brain Control Center — pure selectors
// ============================================================================
// Pure search/filter/summary/export helpers. Client-safe and unit-tested so the
// Control Center's behavior (search works, filters work, needs-test visible,
// protected visible, export shape) is protected by executable tests.
// ============================================================================

import type {
  ProductBrainItem,
  ProductBrainItemType,
  ProductBrainStatus,
  ProductBrainSummary,
  ProductBrainTestStatus,
} from "./types";

export interface ProductBrainFilter {
  query?: string;
  type?: ProductBrainItemType | "all";
  status?: ProductBrainStatus | "all";
  module?: string | "all";
  testStatus?: ProductBrainTestStatus | "all";
  /** Only items whose test is missing/manual_only/not yet protected. */
  needsTestOnly?: boolean;
  /** Only items flagged needs_review. */
  needsReviewOnly?: boolean;
}

const OPEN_REGRESSION_STATUSES = new Set<ProductBrainStatus>([
  "proposed", "approved", "in_progress", "needs_test", "blocked", "needs_review",
]);
const PROTECTED_TEST_STATUSES = new Set<ProductBrainTestStatus>([
  "unit_tested", "integration_tested", "e2e_tested", "protected",
]);

export function isRegressionOpen(item: ProductBrainItem): boolean {
  return item.type === "regression" && OPEN_REGRESSION_STATUSES.has(item.status);
}
export function isProtectedByTest(item: ProductBrainItem): boolean {
  return PROTECTED_TEST_STATUSES.has(item.testStatus);
}
/** Item whose protected behavior is not yet covered by an automated test. */
export function needsTest(item: ProductBrainItem): boolean {
  if (item.testStatus === "missing") return true;
  // manual_only counts as "needs (automated) test" except where tests aren't applicable.
  if (item.testStatus === "manual_only") return true;
  return false;
}

export function searchText(item: ProductBrainItem): string {
  return [
    item.itemKey, item.title, item.module, item.summary, item.decision,
    item.expectedBehavior, item.sourcePath, item.sourceSection, ...item.tags,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function filterItems(items: ProductBrainItem[], f: ProductBrainFilter): ProductBrainItem[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return items.filter((it) => {
    if (f.type && f.type !== "all" && it.type !== f.type) return false;
    if (f.status && f.status !== "all" && it.status !== f.status) return false;
    if (f.module && f.module !== "all" && it.module !== f.module) return false;
    if (f.testStatus && f.testStatus !== "all" && it.testStatus !== f.testStatus) return false;
    if (f.needsTestOnly && !needsTest(it)) return false;
    if (f.needsReviewOnly && it.status !== "needs_review") return false;
    if (q && !searchText(it).includes(q)) return false;
    return true;
  });
}

export function summarize(items: ProductBrainItem[]): ProductBrainSummary {
  const regressions = items.filter((i) => i.type === "regression");
  const modulesWithGaps = new Set(
    items
      .filter((i) => (i.type === "known_gap" || i.type === "technical_debt" || isRegressionOpen(i)) && i.module)
      .map((i) => i.module as string),
  );
  return {
    total: items.length,
    productDecisions: items.filter((i) => i.type === "product_decision").length,
    openRegressions: regressions.filter(isRegressionOpen).length,
    closedRegressions: regressions.filter((i) => !isRegressionOpen(i)).length,
    protectedByTest: items.filter(isProtectedByTest).length,
    needsTest: items.filter(needsTest).length,
    needsReview: items.filter((i) => i.status === "needs_review").length,
    highPriority: items.filter((i) => i.priority === "p1" || i.severity === "critical" || i.severity === "high").length,
    modulesWithGaps: modulesWithGaps.size,
  };
}

export function listModules(items: ProductBrainItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.module).filter(Boolean) as string[])).sort();
}

/** Build a Markdown status report (export). Safe over already-authorized data. */
export function toMarkdownReport(items: ProductBrainItem[]): string {
  const s = summarize(items);
  const lines: string[] = [
    "# Product Brain Status Report",
    "",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Summary",
    `- Total items: ${s.total}`,
    `- Product decisions: ${s.productDecisions}`,
    `- Open regressions: ${s.openRegressions}`,
    `- Closed regressions: ${s.closedRegressions}`,
    `- Protected by test: ${s.protectedByTest}`,
    `- Needs test: ${s.needsTest}`,
    `- Needs review: ${s.needsReview}`,
    `- Modules with active gaps: ${s.modulesWithGaps}`,
    "",
    "## Open regressions",
    ...(items.filter(isRegressionOpen).map((i) => `- ${i.itemKey} — ${i.title} (${i.module ?? "—"})`)),
    "",
    "## Needs test",
    ...(items.filter(needsTest).map((i) => `- ${i.itemKey} — ${i.title} [${i.testStatus}]`)),
    "",
    "## Approved UX contracts",
    ...(items.filter((i) => i.type === "ux_contract").map((i) => `- ${i.itemKey} — ${i.title} (${i.status})`)),
    "",
    "## Active product decisions",
    ...(items.filter((i) => i.type === "product_decision").map((i) => `- ${i.itemKey} — ${i.title}`)),
  ];
  return lines.join("\n");
}
