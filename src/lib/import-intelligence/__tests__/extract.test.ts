import { describe, it, expect } from "vitest";
import {
  findColumn,
  classifyTable,
  extractCanonicalImport,
  extractDependencyPhrases,
  detectProjectType,
  normalizeStatus,
  normalizePriority,
  buildFieldMappings,
} from "../extract";
import type { ParsedFile, ParsedTable } from "@/types/import-intelligence";

function fileWith(tables: ParsedTable[], rawText = ""): ParsedFile {
  return { fileType: "xlsx", rawText, rawJson: null, tables, metadata: {} };
}

describe("findColumn / classifyTable", () => {
  it("matches English and Spanish headers", () => {
    expect(findColumn(["Task Name", "Owner", "Start Date"], "name")).toBe(0);
    expect(findColumn(["Tarea", "Responsable", "Fecha Inicio"], "assignee")).toBe(1);
    expect(findColumn(["Tarea", "Responsable", "Fecha Inicio"], "start")).toBe(2);
    expect(findColumn(["X", "Y"], "name")).toBe(-1);
  });

  it("classifies tables by name and column shape", () => {
    expect(classifyTable({ name: "Tasks", headers: ["Task", "Start", "End"], rows: [] }).type).toBe("task");
    expect(classifyTable({ name: "Materiales", headers: ["Material", "Cantidad", "Unidad"], rows: [] }).type).toBe("material");
    expect(classifyTable({ name: "Risk Register", headers: ["Risk", "Probability", "Impact"], rows: [] }).type).toBe("risk");
    expect(classifyTable({ name: "Presupuesto", headers: ["Concepto", "Costo Estimado"], rows: [] }).type).toBe("budget");
  });
});

describe("status / priority normalization", () => {
  it("maps bilingual values into canonical statuses", () => {
    expect(normalizeStatus("Completed")).toBe("done");
    expect(normalizeStatus("En progreso")).toBe("in_progress");
    expect(normalizeStatus("Bloqueado")).toBe("blocked");
    expect(normalizeStatus("whatever")).toBe("not_started");
    expect(normalizePriority("Alta")).toBe("p1");
    expect(normalizePriority("low")).toBe("p3");
  });
});

describe("extractDependencyPhrases", () => {
  it("detects English and Spanish dependency phrases", () => {
    expect(extractDependencyPhrases("Cannot start until Foundation pour")).toContain("Foundation pour");
    expect(extractDependencyPhrases("Esta tarea depende de Instalación eléctrica")).toContain("Instalación eléctrica");
    expect(extractDependencyPhrases("Nothing here")).toHaveLength(0);
  });
});

describe("extractCanonicalImport", () => {
  const taskTable: ParsedTable = {
    name: "Tasks",
    headers: ["ID", "Task", "Predecessor", "Start Date", "End Date", "Assigned To", "Status"],
    rows: [
      ["1", "Excavation", "", "2026-07-01", "2026-07-03", "Civil Crew", "Done"],
      ["2", "Foundation pour", "1", "2026-07-04", "2026-07-08", "Concrete Crew", "In Progress"],
      ["3", "Framing", "2", "2026-07-09", "2026-07-20", "", "Not Started"],
    ],
  };

  it("extracts tasks with dates, durations, owners, and explicit dependencies", () => {
    const c = extractCanonicalImport(fileWith([taskTable]), "plan.xlsx");
    expect(c.tasks).toHaveLength(3);
    expect(c.tasks[0].source_id).toBe("1");
    expect(c.tasks[0].status).toBe("done");
    expect(c.tasks[1].duration_days).toBe(5);
    expect(c.dependencies).toHaveLength(2);
    expect(c.dependencies[0]).toMatchObject({ predecessor_source_id: "1", successor_source_id: "2", inferred: false });
    // Assignees become resource candidates, deduplicated
    expect(c.resources.map((r) => r.name)).toEqual(["Civil Crew", "Concrete Crew"]);
  });

  it("resolves name-based predecessor references and drops unresolvable ones", () => {
    const table: ParsedTable = {
      name: "Tareas",
      headers: ["Tarea", "Predecesora"],
      rows: [
        ["Cimentación", ""],
        ["Estructura", "Cimentación"],
        ["Techado", "No existe"],
      ],
    };
    const c = extractCanonicalImport(fileWith([table]), "plan.xlsx");
    expect(c.dependencies).toHaveLength(1);
    expect(c.dependencies[0].successor_source_id).toBe(c.tasks[1].source_id);
  });

  it("extracts materials, budget, risks from their own sheets", () => {
    const c = extractCanonicalImport(
      fileWith([
        { name: "Materials", headers: ["Material", "Qty", "Unit", "Unit Cost"], rows: [["CAT6A cable", "2500", "ft", "0.42"]] },
        { name: "Budget", headers: ["Item", "Estimated Cost"], rows: [["Electrical labor", "120000"]] },
        { name: "Risks", headers: ["Risk", "Probability", "Impact"], rows: [["UPS delay", "High", "Critical"]] },
      ]),
      "dc.xlsx",
    );
    expect(c.materials[0]).toMatchObject({ name: "CAT6A cable", quantity: 2500, unit: "ft" });
    expect(c.budget_items[0].estimated_cost).toBe(120000);
    // "Critical" impact is preserved as critical (risks.impact supports it);
    // probability stays clamped to low/medium/high.
    expect(c.risks[0]).toMatchObject({ probability: "high", impact: "critical" });
  });

  it("extracts from a structured JSON file", () => {
    const parsed: ParsedFile = {
      fileType: "json",
      rawText: "",
      rawJson: {
        project: { name: "API Platform", start_date: "2026-08-01" },
        tasks: [
          { name: "Build API", duration: 10, "assigned to": "Dev A" },
          { name: "Build UI", duration: 8, predecessor: "Build API" },
        ],
      },
      tables: [],
      metadata: {},
    };
    const c = extractCanonicalImport(parsed, "p.json");
    expect(c.project.name).toBe("API Platform");
    expect(c.tasks).toHaveLength(2);
    expect(c.dependencies).toHaveLength(1);
  });

  it("falls back to file name for the project name and detects type", () => {
    const c = extractCanonicalImport(fileWith([taskTable], "rack install ups generator commissioning fiber"), "data_center-plan.xlsx");
    expect(c.project.name).toBe("data center plan");
    expect(c.project.project_type).toBe("data_center_construction");
  });
});

describe("detectProjectType", () => {
  it("requires enough signal before leaving general", () => {
    expect(detectProjectType("nothing relevant").type).toBe("general");
    expect(detectProjectType("sprint backlog api deploy qa release sprint").type).toBe("software_development");
    expect(detectProjectType("cimentación techado drywall framing vivienda").type).toBe("residential_construction");
  });
});

describe("buildFieldMappings", () => {
  it("reports source column → canonical field mappings", () => {
    const mappings = buildFieldMappings(
      fileWith([{ name: "Tasks", headers: ["Task", "Start Date", "Owner"], rows: [["a", "2026-01-01", "x"]] }]),
    );
    const targets = mappings.map((m) => m.target_field_name);
    expect(targets).toContain("name");
    expect(targets).toContain("start");
    expect(targets).toContain("assignee");
    expect(mappings[0].source_entity_type).toBe("sheet:Tasks");
  });
});
