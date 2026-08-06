// ============================================================================
// REG-046 — An import must never write less than it reports
// ============================================================================
// A 274-task plan imported 201 tasks and reported success. Every rejected row
// vanished because the insert read only `data` and never `error`:
//
//     const { data: row } = await supabase.from("roadmap_tasks").insert({...});
//     if (row) { ...count it... }          // no row → silently skipped
//
// What Postgres rejected was `duration_days: 0`. Plans legitimately carry
// zero-duration rows (milestones, deliverables, quality gates are points in
// time), but `roadmap_tasks` constrains duration_days to NULL or > 0.
//
// Two regressions must fail if this returns: zero duration has to survive the
// write, and a refused row has to be reported instead of dropped.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { normalizeDurationDays, projectSlugCandidates } from "../execute";
import { parseImportFile } from "../parse";
import { extractCanonicalImport } from "../extract";

describe("normalizeDurationDays", () => {
  it("maps an explicit zero to 'no duration' so the row is accepted", () => {
    // 0 violates CHECK (duration_days IS NULL OR duration_days > 0).
    expect(normalizeDurationDays(0)).toBeNull();
  });

  it("does not invent a one-day span for a point-in-time row", () => {
    expect(normalizeDurationDays(0)).not.toBe(1);
  });

  it("keeps real durations untouched", () => {
    expect(normalizeDurationDays(1)).toBe(1);
    expect(normalizeDurationDays(32)).toBe(32);
    expect(normalizeDurationDays(0.5)).toBe(0.5);
  });

  it("rejects values the column cannot hold", () => {
    expect(normalizeDurationDays(null)).toBeNull();
    expect(normalizeDurationDays(undefined)).toBeNull();
    expect(normalizeDurationDays(-5)).toBeNull();
    expect(normalizeDurationDays(Number.NaN)).toBeNull();
    expect(normalizeDurationDays(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

// The canonical import stays faithful to the file (a 0 in the sheet is a 0 in
// the canonical); it is the write that translates it to the column's domain.
// This is what makes the review screen honest about what the plan says.
describe("zero-duration rows reach the writer", () => {
  it("keeps the source value in the canonical import", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Plan", "", "", "", ""],
        ["ID de tarea", "Actividad", "Duración", "Inicio planificado", "Fin planificado"],
        ["T-1", "Entregable puntual", "0", "2026-02-17", "2026-02-17"],
        ["T-2", "Trabajo real", "32", "2026-01-12", "2026-02-24"],
      ]),
      "PLAN",
    );
    const buffer = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));

    const canonical = extractCanonicalImport(await parseImportFile("p.xlsx", buffer), "p.xlsx");
    const byId = new Map(canonical.tasks.map((t) => [t.source_id, t]));

    // Both rows survive extraction — the zero-duration one is not dropped.
    expect(byId.size).toBe(2);
    expect(byId.get("T-1")!.duration_days).toBe(0);
    expect(byId.get("T-2")!.duration_days).toBe(32);

    // …and the writer turns the 0 into a value the column accepts.
    expect(normalizeDurationDays(byId.get("T-1")!.duration_days)).toBeNull();
    expect(normalizeDurationDays(byId.get("T-2")!.duration_days)).toBe(32);
  });
});

// ============================================================================
// REG-047 — Rolling an import back burned its project slug forever
// ============================================================================
// `projects_organization_id_slug_key` is UNIQUE (organization_id, slug) with
// NO deleted_at predicate, but a rollback only soft-deletes. The executor
// looked for slug clashes with `.is("deleted_at", null)`, so it judged the
// slug free while the database still counted it — re-importing the same file
// after a rollback died on "duplicate key value violates unique constraint".
// ============================================================================

describe("projectSlugCandidates", () => {
  const JOB = "8c1ff62a-4d8a-4cfc-b110-ebed636e2864";

  it("offers the clean slug first", () => {
    expect(projectSlugCandidates("Proyecto Aurora Retail", JOB)[0]).toBe("proyecto-aurora-retail");
  });

  it("strips accents and punctuation", () => {
    expect(projectSlugCandidates("Implementación SAP S/4HANA — Ola 1", JOB)[0]).toBe(
      "implementacion-sap-s-4hana-ola-1",
    );
  });

  it("falls back to a name for an unnamed project", () => {
    expect(projectSlugCandidates("", JOB)[0]).toBe("imported-project");
    expect(projectSlugCandidates("///", JOB)[0]).toBe("imported-project");
  });

  it("never runs out, and never ends on a plain numbered suffix", () => {
    const candidates = projectSlugCandidates("Aurora", JOB);
    // Numbered alternatives, then a job-derived one that cannot collide.
    expect(candidates[1]).toBe("aurora-1");
    expect(candidates.at(-1)).toBe("aurora-8c1ff62a");
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("is stable for the same job, so a retry reuses the same name", () => {
    expect(projectSlugCandidates("Aurora", JOB)).toEqual(projectSlugCandidates("Aurora", JOB));
  });
});

// ── Real workbook: the exact shape that lost 73 of 274 tasks ────────────────

// The file has been renamed at least once; accept either name rather than
// silently skipping the only real-world case in the suite.
const FIXTURE = [
  "C:/Users/ADM/Downloads/Proyecto_Aurora_SAP_Completo.xlsx",
  "C:/Users/ADM/Downloads/ProjectOps360_Proyecto_Aurora_SAP_Completo.xlsx",
].find((f) => existsSync(f)) ?? "";

describe.skipIf(!existsSync(FIXTURE))("SAP Activate workbook — zero-duration rows", () => {
  it("every extracted task is writable", async () => {
    const parsed = await parseImportFile("sap.xlsx", new Uint8Array(readFileSync(FIXTURE)));
    const canonical = extractCanonicalImport(parsed, "sap.xlsx");

    // The plan really does contain zero-duration rows — that is the point.
    const zeroDuration = canonical.tasks.filter((t) => t.duration_days === 0);
    expect(zeroDuration.length).toBeGreaterThan(50);

    // None of them would be refused by CHECK (duration IS NULL OR > 0).
    const unwritable = canonical.tasks.filter((t) => {
      const d = normalizeDurationDays(t.duration_days);
      return d !== null && d <= 0;
    });
    expect(unwritable).toEqual([]);
  });
});
