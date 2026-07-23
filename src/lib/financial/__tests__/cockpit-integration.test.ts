import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("P8 Core integration contracts", () => {
  it("adds the PMO cockpit without replacing the existing budget experience", () => {
    const page = read("src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx");
    const cockpit = read("src/app/[locale]/(app)/projects/[projectId]/budget/financial-cockpit.tsx");
    expect(page).toContain("getFinancialFeatureStateFromProcess");
    expect(page).toContain("<FinancialCockpit");
    expect(page).toContain("<BudgetReportClient");
    expect(page).toContain("categories.length > 0 || !financialFeatures.writers");
    expect(cockpit).toContain('t("livingGraph")');
    expect(cockpit).toContain('t("reports")');
    expect(cockpit).toContain("grid-cols-1");
    expect(cockpit.toLowerCase()).not.toContain("gantt");
  });

  it("routes reports and Isabella to the canonical cockpit projection", () => {
    const reports = read("src/lib/reports/query-service.ts");
    const context = read("src/lib/isabella/process-context/context-builder.ts");
    const intelligence = read("src/lib/financial/intelligence.ts");
    expect(reports).toContain('fromView("financial_project_cockpit")');
    expect(context).toContain('included.includes("financial_summary")');
    expect(intelligence).toContain('allowedOperations: ["explain", "compare", "trace"]');
    expect(intelligence).toContain('prohibitedOperations: ["approve", "post", "release", "reopen", "execute"]');
  });
});
