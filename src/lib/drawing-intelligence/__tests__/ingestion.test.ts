import { describe, it, expect } from "vitest";
import {
  validateDrawingFile,
  inferDrawingMetadata,
  buildDrawingStoragePath,
  MAX_DRAWING_FILE_SIZE,
} from "../ingestion";

describe("validateDrawingFile", () => {
  it("accepts a normal PDF", () => {
    const result = validateDrawingFile({ fileName: "A-101_R3.pdf", fileSize: 1024 });
    expect(result).toEqual({ ok: true, extension: "pdf", fileType: "pdf" });
  });

  it("accepts metadata-level formats (dwg, rvt, ifc, png, jpg, jpeg)", () => {
    for (const ext of ["dwg", "rvt", "ifc", "png", "jpg", "jpeg"]) {
      const result = validateDrawingFile({ fileName: `plan.${ext}`, fileSize: 10 });
      expect(result.ok).toBe(true);
    }
  });

  it("is case-insensitive on extensions", () => {
    expect(validateDrawingFile({ fileName: "PLAN.PDF", fileSize: 10 }).ok).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    const result = validateDrawingFile({ fileName: "model.skp", fileSize: 10 });
    expect(result).toEqual({ ok: false, error: "unsupported_file_type" });
  });

  it("rejects files without extension", () => {
    const result = validateDrawingFile({ fileName: "drawing", fileSize: 10 });
    expect(result).toEqual({ ok: false, error: "unsupported_file_type" });
  });

  it("rejects empty files", () => {
    const result = validateDrawingFile({ fileName: "a.pdf", fileSize: 0 });
    expect(result).toEqual({ ok: false, error: "empty_file" });
  });

  it("rejects oversized files", () => {
    const result = validateDrawingFile({ fileName: "a.pdf", fileSize: MAX_DRAWING_FILE_SIZE + 1 });
    expect(result).toEqual({ ok: false, error: "file_too_large" });
  });
});

describe("inferDrawingMetadata", () => {
  it("extracts number and revision from A-101_R3.pdf", () => {
    expect(inferDrawingMetadata("A-101_R3.pdf")).toEqual({
      drawing_number: "A-101",
      revision: "3",
    });
  });

  it("extracts 'Rev B' style revisions", () => {
    const result = inferDrawingMetadata("S-201 Rev B - Foundation Plan.pdf");
    expect(result.drawing_number).toBe("S-201");
    expect(result.revision).toBe("B");
  });

  it("returns nulls when nothing matches", () => {
    expect(inferDrawingMetadata("site photos.png")).toEqual({
      drawing_number: null,
      revision: null,
    });
  });

  it("normalizes separators in drawing numbers", () => {
    expect(inferDrawingMetadata("M_301.pdf").drawing_number).toBe("M-301");
  });
});

describe("buildDrawingStoragePath", () => {
  it("builds the org/project-scoped path expected by storage policies", () => {
    const path = buildDrawingStoragePath("org-1", "proj-1", "A 101 (rev).pdf", "uuid-x");
    expect(path).toBe("drawings/org-1/proj-1/uuid-x-A_101__rev_.pdf");
    expect(path.startsWith("drawings/org-1/proj-1/")).toBe(true);
  });
});
