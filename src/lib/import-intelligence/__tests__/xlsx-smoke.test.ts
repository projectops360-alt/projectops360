import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseImportFile } from "../parse";
import { extractCanonicalImport } from "../extract";
import { validateCanonicalImport } from "../validate";

// Real-world smoke test: runs only when the local fixture exists.
// Covers ClosedXML-style namespace-prefixed XLSX that exceljs rejected.
const FIXTURE = "C:/Users/ADM/Downloads/perimeter_fence_project_plan.xlsx";

describe.skipIf(!existsSync(FIXTURE))("xlsx real-world workbook", () => {
  it("parses, extracts, and validates the perimeter fence plan", async () => {
    const buffer = new Uint8Array(readFileSync(FIXTURE));
    const parsed = await parseImportFile("perimeter_fence_project_plan.xlsx", buffer);
    expect(parsed.tables.length).toBeGreaterThan(0);

    const canonical = extractCanonicalImport(parsed, "perimeter_fence_project_plan.xlsx");
    console.log("sheets:", parsed.tables.map((t) => `${t.name}(${t.rows.length})`).join(", "));
    console.log("counts:", JSON.stringify({
      tasks: canonical.tasks.length,
      milestones: canonical.milestones.length,
      dependencies: canonical.dependencies.length,
      resources: canonical.resources.length,
      materials: canonical.materials.length,
      budget: canonical.budget_items.length,
      risks: canonical.risks.length,
    }));
    console.log("project:", canonical.project.name, "/", canonical.project.project_type);
    expect(canonical.tasks.length).toBeGreaterThan(0);

    const report = validateCanonicalImport(canonical);
    expect(report.findings.some((f) => f.validation_type === "no_entities")).toBe(false);
  });
});
