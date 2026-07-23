// ============================================================================
// Full-workbook extraction — charter, derived milestones, prompts, risks
// ============================================================================
// Protects the "no sheet is silently dropped" behavior for the official
// template structure (Project Charter, combined Milestones & Tasks, Task
// Prompts, Risk Register, Data Dependencies, Acceptance Criteria,
// Governance & Gates). Guard id: IMPORT-FULL-WORKBOOK.
// ============================================================================

import { describe, it, expect } from "vitest";
import { extractCanonicalImport } from "../extract";
import { entitiesToCanonical, type ImportEntityRow } from "../execute";
import type { ParsedFile, ParsedTable } from "@/types/import-intelligence";

function fileWith(tables: ParsedTable[], rawText = ""): ParsedFile {
  return { fileType: "xlsx", rawText, rawJson: null, tables, metadata: {} };
}

const charterSheet: ParsedTable = {
  name: "Project Charter",
  // The sheet title lands in `headers` (first non-empty row) — real XLSX shape.
  headers: ["Project Charter — Demo", ""],
  rows: [
    ["Field", "Definition"],
    ["Purpose", "Build a demo command center."],
    ["Business Problem", "Dashboards do not explain flow."],
    ["In Scope", "Process map; KPIs."],
    ["Out of Scope", "ERP replacement."],
    ["Key Assumptions", "Event data is reliable."],
    ["Primary Constraints", "Single developer."],
    ["Definition of Done", "All criteria met."],
    ["Feature Flag", "demo_flag — OFF by default."],
  ],
};

const tasksSheet: ParsedTable = {
  name: "Milestones & Tasks",
  headers: ["Task ID", "Milestone", "Milestone Name", "Task", "Objective", "Estimate", "Dependencies", "Acceptance Criterion", "Status", "Priority", "Owner"],
  rows: [
    ["T1.1", "M1", "Governance", "Freeze scope", "Define the experience.", "1.5 días", "—", "Scope approved.", "Not Started", "High", "Efrain"],
    ["T1.2", "M1", "Governance", "Inventory repo", "Inspect the codebase.", "2 días", "T1.1", "Map documented.", "Not Started", "High", "Efrain"],
    ["T2.1", "M2", "Data Contracts", "Define contracts", "Canonical models.", "1 semana", "T1.2", "Contracts approved.", "Not Started", "Medium", "Efrain"],
  ],
};

const promptsSheet: ParsedTable = {
  name: "Task Prompts",
  headers: ["Task ID", "Task", "Milestone", "Prompt Ready to Copy"],
  rows: [
    ["T1.1", "Freeze scope", "M1", "TASK T1.1 — do exactly this."],
    ["T2.1", "Define contracts", "M2", "TASK T2.1 — do exactly that."],
  ],
};

const riskSheet: ParsedTable = {
  name: "Risk Register",
  headers: ["Risk ID", "Risk", "Description", "Probability (1-5)", "Impact (1-5)", "Score", "Rating", "Response", "Mitigation / Contingency", "Owner", "Trigger", "Status"],
  rows: [
    ["R01", "Scope creep", "New features alter the plan.", "4", "5", "20", "Crítico", "Evitar", "Freeze scope; change control.", "PO", "New unrelated tasks.", "Abierto"],
    ["R02", "Low data quality", "Logs missing timestamps.", "2", "3", "6", "Medio", "Mitigar", "Audit event capture early.", "Data", "Empty variants.", "Abierto"],
  ],
};

const dataDepsSheet: ParsedTable = {
  name: "Data Dependencies",
  headers: ["ID", "Data / Service", "Required Fields or Capability", "Blocking Milestone", "Criticality", "Current Status", "Owner", "Validation Rule"],
  rows: [["D01", "Event Ledger", "ids, timestamps", "M2", "Crítica", "Por validar", "Data", "Completeness ≥95%."]],
};

const acceptanceSheet: ParsedTable = {
  name: "Acceptance Criteria",
  headers: ["ID", "Acceptance Criterion", "Milestone", "Severity"],
  rows: [["AC01", "Loads only under the flag.", "M3", "Obligatorio"]],
};

const governanceSheet: ParsedTable = {
  name: "Governance & Gates",
  headers: ["Governance, Stage Gates & Change Control", "", "", "", ""],
  rows: [
    ["Gate", "Name", "Milestone", "Approver", "Exit Evidence"],
    ["G0", "Scope Gate", "M1", "Founder", "Scope approved."],
    ["Change Control Rules", "", "", "", ""],
    ["CR-01", "No new features mid-task.", "", "", ""],
  ],
};

const workbook = fileWith([charterSheet, tasksSheet, promptsSheet, riskSheet, dataDepsSheet, acceptanceSheet, governanceSheet]);

describe("full workbook extraction (official template structure)", () => {
  const c = extractCanonicalImport(workbook, "plan.xlsx");

  it("derives milestones from the combined sheet in first-appearance order (REG-026)", () => {
    expect(c.milestones.map((m) => m.source_id)).toEqual(["M1", "M2"]);
    expect(c.milestones.map((m) => m.name)).toEqual(["Governance", "Data Contracts"]);
    // Tasks point at the milestone NAME so execute links by title.
    expect(c.tasks.find((t) => t.source_id === "T1.1")?.milestone).toBe("Governance");
    expect(c.tasks.find((t) => t.source_id === "T2.1")?.milestone).toBe("Data Contracts");
  });

  it("maps the charter key/value sheet onto project_charters fields without dropping content", () => {
    expect(c.charter).not.toBeNull();
    const f = c.charter!.fields;
    expect(f.project_goal).toBe("Build a demo command center.");
    expect(f.business_case).toBe("Dashboards do not explain flow.");
    expect(f.in_scope).toBe("Process map; KPIs.");
    expect(f.out_of_scope).toBe("ERP replacement.");
    expect(f.assumptions).toBe("Event data is reliable.");
    expect(f.constraints).toBe("Single developer.");
    expect(f.acceptance_criteria).toContain("All criteria met.");
    // Unmapped labels are preserved verbatim in background — never dropped.
    expect(f.background).toContain("Feature Flag: demo_flag — OFF by default.");
  });

  it("routes governance gates, change control, data dependencies and acceptance criteria into the charter", () => {
    const f = c.charter!.fields;
    expect(f.governance_model).toContain("G0 — Scope Gate (M1)");
    expect(f.governance_model).toContain("Founder");
    expect(f.change_management_process).toContain("CR-01 — No new features mid-task.");
    expect(f.dependencies).toContain("D01 — Event Ledger");
    expect(f.dependencies).toContain("Completeness ≥95%.");
    expect(f.acceptance_criteria).toContain("AC01 (M3 · Obligatorio) — Loads only under the flag.");
  });

  it("merges the Task Prompts sheet into the same tasks (UX-014: stored, not duplicated)", () => {
    expect(c.tasks).toHaveLength(3);
    expect(c.tasks.find((t) => t.source_id === "T1.1")?.prompt_body).toBe("TASK T1.1 — do exactly this.");
    expect(c.tasks.find((t) => t.source_id === "T2.1")?.prompt_body).toBe("TASK T2.1 — do exactly that.");
    expect(c.tasks.find((t) => t.source_id === "T1.2")?.prompt_body).toBeUndefined();
  });

  it("appends the acceptance criterion to the task description and parses duration estimates", () => {
    const t11 = c.tasks.find((t) => t.source_id === "T1.1")!;
    expect(t11.description).toContain("Define the experience.");
    expect(t11.description).toContain("Scope approved.");
    expect(t11.duration_days).toBe(1.5);
    expect(c.tasks.find((t) => t.source_id === "T2.1")?.duration_days).toBe(7); // "1 semana"
  });

  it("maps risks with the real title, 1-5 scales, rating column and mitigation/contingency", () => {
    expect(c.risks).toHaveLength(2);
    const r1 = c.risks[0];
    expect(r1.source_id).toBe("R01");
    expect(r1.title).toBe("Scope creep");
    expect(r1.probability).toBe("high"); // 4
    expect(r1.impact).toBe("critical"); // 5
    expect(r1.severity).toBe("critical"); // Rating "Crítico"
    expect(r1.mitigation).toBe("Freeze scope; change control."); // NOT the Response column
    const r2 = c.risks[1];
    expect(r2.probability).toBe("low"); // 2
    expect(r2.impact).toBe("medium"); // 3
    expect(r2.severity).toBe("medium"); // "Medio"
  });

  it("reports no unparsed sheets for the official structure, but flags unknown ones", () => {
    expect(c.unparsed_tables).toEqual([]);
    const withUnknown = fileWith([tasksSheet, { name: "Something Weird", headers: ["Foo", "Bar"], rows: [["a", "b"]] }]);
    expect(extractCanonicalImport(withUnknown, "plan.xlsx").unparsed_tables).toEqual(["Something Weird"]);
  });
});

describe("JSON charter extraction", () => {
  it("accepts a charter object with canonical or human keys", () => {
    const json = {
      project: { name: "Demo" },
      charter: { purpose: "Goal here.", out_of_scope: "Not this.", "Definition of Done": "Done when tested." },
      tasks: [{ task: "Only task", status: "Not Started" }],
    };
    const c = extractCanonicalImport({ fileType: "json", rawText: "", rawJson: json, tables: [], metadata: {} }, "plan.json");
    expect(c.charter?.fields.project_goal).toBe("Goal here.");
    expect(c.charter?.fields.out_of_scope).toBe("Not this.");
    expect(c.charter?.fields.acceptance_criteria).toBe("Done when tested.");
  });
});

describe("entitiesToCanonical charter passthrough", () => {
  it("rebuilds the charter entity from stored rows", () => {
    const rows: ImportEntityRow[] = [
      {
        id: "1",
        entity_type: "charter",
        source_order: 0,
        source_key: "charter",
        normalized_json: { fields: { project_goal: "X" }, confidence_score: 0.85, source_reference: "Project Charter" },
        validation_status: "valid",
        will_import: true,
      },
    ];
    const canonical = entitiesToCanonical(rows);
    expect(canonical.charter?.fields.project_goal).toBe("X");
  });
});
