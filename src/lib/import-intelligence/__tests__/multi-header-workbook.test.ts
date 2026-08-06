// ============================================================================
// REG-045 — Structured plan workbooks import their rows
// ============================================================================
// A planning workbook rarely starts with its header row: it opens with a title
// banner, a subtitle, and often a merged "group band" spanning the columns
// above the real headers. The parser used to take row 0 as the header, so
// every sheet became a table with one junk header and no recognizable columns
// — the whole workbook then extracted zero tasks, milestones and resources.
//
// The regression that must fail if this returns: a workbook shaped like the
// SAP Activate export (title rows + group band + row-kind column) extracts its
// work, its phases/gates and its team.
// ============================================================================

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { detectHeaderRowIndex, parseImportFile } from "../parse";
import {
  extractCanonicalImport,
  classifyRowKind,
  findColumn,
  isNegative,
  isGovernanceTable,
  isProjectDataTable,
} from "../extract";
import { validateCanonicalImport } from "../validate";
import type { ParsedTable } from "@/types/import-intelligence";

// ── Header row detection ────────────────────────────────────────────────────

describe("detectHeaderRowIndex", () => {
  it("keeps row 0 when it already is the header", () => {
    expect(
      detectHeaderRowIndex([
        ["Task", "Owner", "Start"],
        ["Dig", "Ana", "2026-01-05"],
      ]),
    ).toBe(0);
  });

  it("skips a title banner and a subtitle", () => {
    expect(
      detectHeaderRowIndex([
        ["Project plan — Aurora", "", ""],
        ["Fill the yellow cells before baselining.", "", ""],
        ["Task", "Owner", "Start"],
        ["Dig", "Ana", "2026-01-05"],
      ]),
    ).toBe(2);
  });

  it("skips a merged group band above the real header", () => {
    expect(
      detectHeaderRowIndex([
        ["Scope", "", "", "Planning", "", ""],
        ["WBS", "Activity", "Type", "Start", "Finish", "Owner"],
        ["1.1", "Dig", "Task", "2026-01-05", "2026-01-09", "Ana"],
      ]),
    ).toBe(1);
  });

  it("does not mistake a wide numeric data row for the header", () => {
    expect(
      detectHeaderRowIndex([
        ["Phase", "Budget", "Actual"],
        ["1", "210300", "0"],
        ["2", "521000", "0"],
      ]),
    ).toBe(0);
  });
});

// ── Column binding ──────────────────────────────────────────────────────────

describe("findColumn", () => {
  it("does not bind 'ID de tarea' to location via the 'area' substring", () => {
    const headers = ["ID de tarea", "Actividad", "Responsable"];
    expect(findColumn(headers, "location")).toBe(-1);
  });

  it("still matches an exact 'Area' header for location", () => {
    expect(findColumn(["Activity", "Area"], "location")).toBe(1);
  });

  it("prefers the referenceable activity id over the WBS outline number", () => {
    const headers = ["WBS", "ID de tarea", "Actividad"];
    expect(findColumn(headers, "task_id")).toBe(1);
    expect(findColumn(headers, "wbs")).toBe(0);
  });
});

// ── Row-kind routing ────────────────────────────────────────────────────────

describe("classifyRowKind", () => {
  it("routes phases and gates to milestones, work to tasks", () => {
    expect(classifyRowKind("Fase")).toBe("milestone");
    expect(classifyRowKind("Quality Gate")).toBe("milestone");
    expect(classifyRowKind("Ola")).toBe("milestone");
    expect(classifyRowKind("Hito")).toBe("milestone");
    expect(classifyRowKind("Proyecto")).toBe("project");
    expect(classifyRowKind("Tarea")).toBe("task");
    expect(classifyRowKind("Entregable")).toBe("task");
  });

  it("keeps unfamiliar kinds as work rather than dropping the row", () => {
    expect(classifyRowKind("Paquete de trabajo")).toBe("task");
    expect(classifyRowKind("")).toBe("task");
  });
});

describe("isNegative", () => {
  it("reads an explicit opt-out", () => {
    expect(isNegative("No")).toBe(true);
    expect(isNegative("Sí")).toBe(false);
    expect(isNegative("Yes")).toBe(false);
  });
});

// ── Sheet routing ───────────────────────────────────────────────────────────

describe("sheet routing", () => {
  const table = (name: string, headers: string[]): ParsedTable => ({ name, headers, rows: [] });

  it("does not treat a milestone register as a governance sheet", () => {
    expect(isGovernanceTable(table("HITOS_GATES", ["ID", "Nombre", "Fecha objetivo", "Estado"]))).toBe(false);
  });

  it("still routes a real governance sheet", () => {
    expect(isGovernanceTable(table("Governance", ["Gate", "Approver"]))).toBe(true);
    expect(isGovernanceTable(table("CAMBIOS", ["ID de cambio", "Descripción"]))).toBe(true);
  });

  it("routes a narrow key/value sheet to project data but not a wide breakdown", () => {
    expect(isProjectDataTable(table("DATOS_PROYECTO", ["Sección", "Campo", "Valor", "Ayuda"]))).toBe(true);
    expect(
      isProjectDataTable(table("PRESUPUESTO", ["Fase", "Presupuesto", "Comprometido", "Costo real", "ETC", "EAC"])),
    ).toBe(false);
  });
});

// ── End-to-end over a synthetic structured workbook ─────────────────────────

/** Build the shape that used to import nothing: banner + subtitle + group band
 *  + header, plus a row-kind column mixing project, phase, gate and work. */
async function buildWorkbook(): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const plan = [
    ["Structure and scope", "", "", "", "", "Planning", "", "", ""],
    ["Incluir", "WBS", "ID de tarea", "Tipo", "Actividad", "Fase", "Inicio planificado", "Fin planificado", "Predecesoras"],
    ["Sí", "1", "P-001", "Proyecto", "Aurora programme", "Programme", "2026-01-12", "2026-12-09", ""],
    ["Sí", "1.1", "P-002", "Fase", "Preparación", "Preparación", "2026-01-12", "2026-03-06", ""],
    ["Sí", "1.1.1", "P-003", "Tarea", "Detallar el plan", "Preparación", "2026-01-12", "2026-02-24", ""],
    ["Sí", "1.1.2", "P-004", "Entregable", "Organigrama del proyecto", "Preparación", "2026-02-25", "2026-03-03", "P-003"],
    ["Sí", "1.1.3", "P-005", "Quality Gate", "Ejecución de Q-Gate", "Preparación", "2026-03-06", "2026-03-06", "P-004"],
    ["Sí", "1.2", "P-006", "Fase", "Exploración", "Exploración", "2026-03-09", "2026-06-05", ""],
    ["Sí", "1.2.1", "P-007", "Quality Gate", "Ejecución de Q-Gate", "Exploración", "2026-06-05", "2026-06-05", ""],
    ["No", "1.2.2", "P-008", "Tarea", "Actividad descartada", "Exploración", "2026-04-01", "2026-04-10", ""],
  ];

  const datos = [
    ["Datos del Proyecto — Aurora", "", "", ""],
    ["Complete las celdas amarillas.", "", "", ""],
    ["Sección", "Campo", "Valor", "Ayuda"],
    ["General", "Nombre del proyecto", "Proyecto Aurora Retail", "Nombre visible."],
    ["Planificación", "Fecha de inicio", "2026-01-12", ""],
    ["Planificación", "Fecha fin objetivo", "2026-12-09", ""],
    ["Alcance", "Fuera de alcance", "Nómina y CRM", ""],
  ];

  const equipo = [
    ["Equipo y Roles RACI", "", "", ""],
    ["Asigne personas y disponibilidad.", "", "", ""],
    ["ID de rol", "Rol", "Nombre", "Organización"],
    ["ROLE-01", "Project Manager", "Diego Navarro", "NexaSphere"],
    ["ROLE-02", "Test Manager", "Camila Torres", "NovaMercado"],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plan), "PLAN_PROYECTO");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(datos), "DATOS_PROYECTO");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(equipo), "EQUIPO_RACI");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

describe("structured plan workbook", () => {
  it("extracts work, phases/gates, team and project identity", async () => {
    const parsed = await parseImportFile("plan.xlsx", await buildWorkbook());
    const plan = parsed.tables.find((t) => t.name === "PLAN_PROYECTO")!;
    // The group band must not become the header.
    expect(plan.headers[0]).toBe("Incluir");
    expect(plan.headers).toContain("Actividad");

    const canonical = extractCanonicalImport(parsed, "plan.xlsx");

    // Project identity comes from the key/value sheet, not the file name.
    expect(canonical.project.name).toBe("Proyecto Aurora Retail");
    expect(canonical.project.start_date).toBe("2026-01-12");
    expect(canonical.project.target_finish_date).toBe("2026-12-09");
    expect(canonical.charter?.fields.out_of_scope).toContain("Nómina");

    // Work rows only — the project row, the phases and the gates are not tasks.
    const taskNames = canonical.tasks.map((t) => t.name);
    expect(taskNames).toEqual(["Detallar el plan", "Organigrama del proyecto"]);
    // The descoped row is honoured.
    expect(taskNames).not.toContain("Actividad descartada");

    // Phases and both gates survive; the repeated gate name is qualified.
    const milestoneNames = canonical.milestones.map((m) => m.name);
    expect(milestoneNames).toContain("Preparación");
    expect(milestoneNames).toContain("Exploración");
    expect(milestoneNames).toContain("Ejecución de Q-Gate");
    expect(milestoneNames).toContain("Ejecución de Q-Gate — Exploración");

    // Tasks are keyed by the referenceable id, so predecessors resolve.
    expect(canonical.tasks.map((t) => t.source_id)).toEqual(["P-003", "P-004"]);
    expect(canonical.dependencies).toContainEqual(
      expect.objectContaining({ predecessor_source_id: "P-003", successor_source_id: "P-004" }),
    );

    // The team sheet is read as resources.
    expect(canonical.resources.map((r) => r.name)).toEqual(
      expect.arrayContaining(["Diego Navarro", "Camila Torres"]),
    );

    // Nothing silently vanished.
    expect(canonical.unparsed_tables).toEqual([]);
    expect(validateCanonicalImport(canonical).findings.some((f) => f.validation_type === "no_entities")).toBe(false);
  });
});

// ── Real workbook smoke (runs only when the fixture is present) ─────────────

// The file has been renamed at least once; accept either name rather than
// silently skipping the only real-world case in the suite.
const FIXTURE = [
  "C:/Users/ADM/Downloads/Proyecto_Aurora_SAP_Completo.xlsx",
  "C:/Users/ADM/Downloads/ProjectOps360_Proyecto_Aurora_SAP_Completo.xlsx",
].find((f) => existsSync(f)) ?? "";

describe.skipIf(!existsSync(FIXTURE))("SAP Activate workbook (real fixture)", () => {
  it("imports the full plan instead of nothing", async () => {
    const parsed = await parseImportFile("sap.xlsx", new Uint8Array(readFileSync(FIXTURE)));
    const canonical = extractCanonicalImport(parsed, "sap.xlsx");

    expect(canonical.project.name).toBe("Proyecto Aurora Retail — Implementación SAP S/4HANA Cloud");
    expect(canonical.tasks.length).toBeGreaterThan(250);
    expect(canonical.milestones.length).toBeGreaterThan(10);
    expect(canonical.dependencies.length).toBeGreaterThan(100);
    expect(canonical.resources.length).toBe(19);
    expect(canonical.risks.length).toBe(10);
    expect(canonical.budget_items.length).toBe(7);
    expect(canonical.unparsed_tables).toEqual([]);

    // Every identified plan row lands as a task or a milestone; the single
    // "Proyecto" row is absorbed into the project itself.
    const plan = parsed.tables.find((t) => t.name === "PLAN_PROYECTO")!;
    const idCol = plan.headers.indexOf("ID de tarea");
    const ids = plan.rows.map((r) => r[idCol]).filter(Boolean);
    const covered = new Set([
      ...canonical.tasks.map((t) => t.source_id),
      ...canonical.milestones.map((m) => m.source_id),
    ]);
    expect(ids.filter((id) => !covered.has(id))).toEqual(["SAP-W1-001"]);
  });
});
