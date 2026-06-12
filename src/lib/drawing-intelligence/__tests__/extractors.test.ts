import { describe, it, expect } from "vitest";
import {
  extractTitleBlock,
  extractRevisionBlock,
  extractNotes,
  classifyDiscipline,
} from "../extractors";

const TITLE_BLOCK_TEXT = [
  "PROJECT: DOWNTOWN DATA CENTER",
  "TITLE: LEVEL 1 FLOOR PLAN",
  "DRAWING NO: A-101",
  "SHEET: 1 OF 12",
  "REV: 3",
  "SCALE: 1/8\" = 1'-0\"",
  "DRAWN BY: JMR",
  "CHECKED BY: LDP",
  "DATE: 06/01/2026",
].join("\n");

describe("extractTitleBlock", () => {
  it("extracts labeled title block fields with confidence and evidence", () => {
    const result = extractTitleBlock(TITLE_BLOCK_TEXT, 1, "A-101_R3.pdf");
    expect(result.values.drawing_number).toBe("A-101");
    expect(result.values.drawing_title).toBe("LEVEL 1 FLOOR PLAN");
    expect(result.values.project_name).toBe("DOWNTOWN DATA CENTER");
    expect(result.values.revision).toBe("3");
    expect(result.values.scale).toContain("1/8");
    expect(result.values.drawn_by).toBe("JMR");
    expect(result.confidence).toBeGreaterThan(0.7);
    const drawingNumber = result.fields.find((f) => f.field === "drawing_number");
    expect(drawingNumber?.method).toBe("title_block_heuristic");
    expect(drawingNumber?.evidence.page_number).toBe(1);
    expect(drawingNumber?.evidence.text_excerpt).toContain("A-101");
  });

  it("falls back to the file name at lower confidence", () => {
    const result = extractTitleBlock("no labels at all here", 1, "S-201 Rev B.pdf");
    const field = result.fields.find((f) => f.field === "drawing_number");
    expect(field?.value).toBe("S-201");
    expect(field?.method).toBe("filename_fallback");
    expect(field?.confidence_score).toBeLessThan(0.7);
  });

  it("detects bare drawing-number patterns at medium confidence", () => {
    const result = extractTitleBlock("see detail on M-301 for ductwork", 2, "scan.pdf");
    const field = result.fields.find((f) => f.field === "drawing_number");
    expect(field?.value).toBe("M-301");
    expect(field?.method).toBe("pattern_match");
  });
});

describe("extractRevisionBlock", () => {
  it("extracts revision rows when a REV header exists", () => {
    const text = [
      "REVISIONS",
      "1 03/15/2026 ISSUED FOR PERMIT",
      "2 04/20/2026 ISSUED FOR CONSTRUCTION",
      "3 06/01/2026 REVISED PER RFI-042",
    ].join("\n");
    const entries = extractRevisionBlock(text, 1);
    expect(entries).toHaveLength(3);
    expect(entries[2].revision).toBe("3");
    expect(entries[2].revision_date).toBe("06/01/2026");
    expect(entries[2].description).toContain("RFI-042");
  });

  it("returns nothing without a revision header", () => {
    const entries = extractRevisionBlock("1 03/15/2026 SOME DIMENSION ROW", 1);
    expect(entries).toHaveLength(0);
  });
});

describe("extractNotes", () => {
  it("extracts numbered notes under section headers with categories", () => {
    const text = [
      "GENERAL NOTES",
      "1. ALL DIMENSIONS TO BE VERIFIED IN FIELD.",
      "2. CONTRACTOR SHALL COORDINATE WITH MEP.",
      "KEYNOTES",
      "N1 PROVIDE FIRE-RATED ASSEMBLY AT SHAFT.",
    ].join("\n");
    const notes = extractNotes(text, 1);
    expect(notes).toHaveLength(3);
    expect(notes[0].category).toBe("general_notes");
    expect(notes[0].note_id).toBe("N1");
    expect(notes[0].text).toContain("DIMENSIONS");
    expect(notes[2].category).toBe("keynotes");
    expect(notes[2].note_id).toBe("N1");
    expect(notes[2].confidence_score).toBeGreaterThan(0.8);
  });

  it("ignores numbered lines before any section header", () => {
    const notes = extractNotes("1. THIS IS NOT A NOTE SECTION", 1);
    expect(notes).toHaveLength(0);
  });

  it("merges continuation lines into the open note (multi-line notes)", () => {
    const text = [
      "GENERAL NOTES",
      "3. CONFLICTS IN DOCUMENTS: NOTIFY OWNER IMMEDIATELY FOR CLARIFICATION SHOULD",
      "ANY DISCREPANCY ARISE BETWEEN DRAWINGS AND SPECIFICATIONS.",
      "4. ALL WORK SHALL COMPLY WITH LOCAL CODE.",
    ].join("\n");
    const notes = extractNotes(text, 2);
    expect(notes).toHaveLength(2);
    expect(notes[0].text).toBe(
      "CONFLICTS IN DOCUMENTS: NOTIFY OWNER IMMEDIATELY FOR CLARIFICATION SHOULD ANY DISCREPANCY ARISE BETWEEN DRAWINGS AND SPECIFICATIONS.",
    );
    expect(notes[1].note_id).toBe("N4");
  });

  it("a blank line closes the current note without closing the section", () => {
    const text = [
      "GENERAL NOTES",
      "1. FIRST NOTE",
      "",
      "STRAY TEXT THAT IS NOT A NOTE",
      "2. SECOND NOTE",
    ].join("\n");
    const notes = extractNotes(text, 1);
    expect(notes).toHaveLength(2);
    expect(notes[0].text).toBe("FIRST NOTE");
    expect(notes[1].text).toBe("SECOND NOTE");
  });
});

describe("classifyDiscipline", () => {
  const base = { title: null, fileName: "x.pdf", pageText: "", pageNumber: 1 };

  it("classifies by drawing number prefix", () => {
    expect(classifyDiscipline({ ...base, drawingNumber: "A-101" }).discipline).toBe("Architectural");
    expect(classifyDiscipline({ ...base, drawingNumber: "S-201" }).discipline).toBe("Structural");
    expect(classifyDiscipline({ ...base, drawingNumber: "M-301" }).discipline).toBe("Mechanical");
    expect(classifyDiscipline({ ...base, drawingNumber: "E-101" }).discipline).toBe("Electrical");
    expect(classifyDiscipline({ ...base, drawingNumber: "P-101" }).discipline).toBe("Plumbing");
    expect(classifyDiscipline({ ...base, drawingNumber: "FP-101" }).discipline).toBe("Fire Protection");
    expect(classifyDiscipline({ ...base, drawingNumber: "C-101" }).discipline).toBe("Civil");
  });

  it("prefix classification carries high confidence", () => {
    const result = classifyDiscipline({ ...base, drawingNumber: "A-101" });
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.9);
    expect(result.method).toBe("discipline_prefix");
  });

  it("falls back to keywords in the title", () => {
    const result = classifyDiscipline({
      ...base,
      drawingNumber: null,
      title: "ELECTRICAL POWER PLAN — LEVEL 2",
    });
    expect(result.discipline).toBe("Electrical");
    expect(result.confidence_score).toBeLessThan(0.9);
  });

  it("returns Unknown with zero confidence when nothing matches", () => {
    const result = classifyDiscipline({ ...base, drawingNumber: null });
    expect(result.discipline).toBe("Unknown");
    expect(result.confidence_score).toBe(0);
  });
});
