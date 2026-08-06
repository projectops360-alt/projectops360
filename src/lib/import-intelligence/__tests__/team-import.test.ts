// ============================================================================
// Importing a team sheet: people, not capacity rows
// ============================================================================
// Guard: IMPORT-TEAM-MEMBERS
//
// The plan named 19 colleagues with their role, organization, email, share of
// their time and dates. They were imported only into `resources`, so they
// showed up under Resources and were invisible everywhere the product asks
// "who is on this project": the charter's role picker offered the
// organization's OTHER users instead, and a governance role could not be given
// to the very people the file named.
//
// Two defects, both about losing what the file said:
//   * people met first as a task's owner (a name, nothing else) beat the team
//     sheet row, because dedup kept the FIRST occurrence rather than merging;
//   * a percent-formatted cell is stored as a fraction, so 15% became 0.
// ============================================================================

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseImportFile } from "../parse";
import { extractCanonicalImport, toPercentage } from "../extract";

describe("toPercentage", () => {
  it("reads a spreadsheet fraction as a percentage", () => {
    // 100% and 15% are stored as 1 and 0.15; rounding those gave 1 and 0.
    expect(toPercentage("1")).toBe(100);
    expect(toPercentage("0.15")).toBe(15);
    expect(toPercentage("0.5")).toBe(50);
  });

  it("leaves an explicit percentage alone", () => {
    expect(toPercentage("15%")).toBe(15);
    expect(toPercentage("100%")).toBe(100);
  });

  it("treats a value above 1 as already scaled", () => {
    expect(toPercentage("60")).toBe(60);
  });

  it("returns nothing when there is nothing to read", () => {
    expect(toPercentage("")).toBeNull();
    expect(toPercentage(undefined)).toBeNull();
    expect(toPercentage("n/a")).toBeNull();
  });
});

describe("people merged across sheets", () => {
  it("keeps the team sheet's detail over a bare owner name", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Read first: the plan, where a person is only an owner column.
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Plan", "", ""],
        ["ID de tarea", "Actividad", "Responsable"],
        ["T-1", "Detallar el plan", "Diego Navarro"],
      ]),
      "PLAN_PROYECTO",
    );
    // Read second: the team sheet, which actually knows who they are.
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Equipo y Roles RACI", "", "", "", ""],
        ["Rol", "Nombre", "Correo", "Organización", "Disponibilidad %"],
        ["Project Manager", "Diego Navarro", "diego@nexasphere.example", "NexaSphere", "1"],
      ]),
      "EQUIPO_RACI",
    );

    const buffer = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const canonical = extractCanonicalImport(await parseImportFile("p.xlsx", buffer), "p.xlsx");

    const diego = canonical.resources.filter(
      (r) => r.name.toLowerCase() === "diego navarro",
    );
    // One person, not two.
    expect(diego).toHaveLength(1);
    // …and the one kept knows what the team sheet said.
    expect(diego[0].email).toBe("diego@nexasphere.example");
    expect(diego[0].trade).toBe("Project Manager");
    expect(diego[0].company).toBe("NexaSphere");
    expect(diego[0].allocation_percentage).toBe(100);
  });
});

// ── The real workbook ───────────────────────────────────────────────────────

const FIXTURES = [
  "C:/Users/ADM/Downloads/Proyecto_Aurora_SAP_Completo.xlsx",
  "C:/Users/ADM/Downloads/ProjectOps360_Proyecto_Aurora_SAP_Completo.xlsx",
];
const FIXTURE = FIXTURES.find((f) => existsSync(f));

describe.skipIf(!FIXTURE)("SAP Activate workbook — the team", () => {
  it("imports all 19 people with their identity intact", async () => {
    const parsed = await parseImportFile("sap.xlsx", new Uint8Array(readFileSync(FIXTURE!)));
    const canonical = extractCanonicalImport(parsed, "sap.xlsx");
    const people = canonical.resources.filter((r) => r.resource_type === "person");

    expect(people).toHaveLength(19);
    // Every one of them is a person the plan named, with a role and an email —
    // not a bare string harvested from an owner column.
    expect(people.every((p) => p.name.trim().length > 0)).toBe(true);
    expect(people.filter((p) => p.email && p.email.includes("@")).length).toBe(19);
    expect(people.filter((p) => p.trade && p.trade.trim().length > 0).length).toBe(19);

    const pm = people.find((p) => p.name === "Diego Navarro")!;
    expect(pm.trade).toBe("Project Manager");
    expect(pm.allocation_percentage).toBe(100);
    expect(pm.company).toContain("NexaSphere");

    // Part-time allocations survive as whole percentages, not zeros.
    const sponsor = people.find((p) => p.name === "Valeria Mendoza");
    if (sponsor) expect(sponsor.allocation_percentage).toBeGreaterThan(0);
  });
});
