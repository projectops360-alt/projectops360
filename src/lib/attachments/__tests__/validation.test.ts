import { describe, it, expect } from "vitest";
import {
  buildAttachmentPath,
  extensionFromFileName,
  isAllowedExtension,
  isAllowedMime,
  sanitizeFileName,
  validateAttachmentFile,
  validateBatchSize,
  validateSingleParent,
} from "../validation";
import { ATTACHMENT_MAX_BATCH, ATTACHMENT_MAX_BYTES } from "../types";

// ============================================================================
// TASK-SUBTASK-FILE-ATTACHMENTS — validation guard
// Type allowlist, size limit, batch limit, filename sanitization, single-parent
// oracle (mirrors the DB CHECK) and scoped/collision-free storage paths.
// ============================================================================

describe("file type allowlist", () => {
  it("accepts an allowed PDF", () => {
    expect(validateAttachmentFile({ fileName: "spec.pdf", sizeBytes: 100, mimeType: "application/pdf" }).ok).toBe(true);
  });

  it("accepts an allowed Word document", () => {
    expect(
      validateAttachmentFile({
        fileName: "scope.docx",
        sizeBytes: 100,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).ok,
    ).toBe(true);
  });

  it("accepts PNG and JPG images", () => {
    expect(validateAttachmentFile({ fileName: "photo.png", sizeBytes: 100, mimeType: "image/png" }).ok).toBe(true);
    expect(validateAttachmentFile({ fileName: "photo.jpg", sizeBytes: 100, mimeType: "image/jpeg" }).ok).toBe(true);
  });

  it("rejects an executable regardless of a benign-looking MIME", () => {
    const res = validateAttachmentFile({ fileName: "malware.exe", sizeBytes: 100, mimeType: "application/pdf" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorKey).toBe("errorTypeNotAllowed");
  });

  it("rejects script/markup extensions (js, html, svg)", () => {
    for (const name of ["x.js", "x.html", "x.svg", "x.ps1", "x.sh"]) {
      expect(validateAttachmentFile({ fileName: name, sizeBytes: 10, mimeType: "text/plain" }).ok).toBe(false);
    }
  });

  it("rejects a disallowed MIME even with an allowed extension (spoof guard)", () => {
    const res = validateAttachmentFile({ fileName: "x.pdf", sizeBytes: 10, mimeType: "application/x-msdownload" });
    expect(res.ok).toBe(false);
  });

  it("isAllowedMime / isAllowedExtension are case-insensitive", () => {
    expect(isAllowedMime("IMAGE/PNG")).toBe(true);
    expect(isAllowedExtension("PDF")).toBe(true);
    expect(isAllowedExtension("EXE")).toBe(false);
  });
});

describe("size + batch limits", () => {
  it("rejects an empty file", () => {
    const res = validateAttachmentFile({ fileName: "a.pdf", sizeBytes: 0, mimeType: "application/pdf" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorKey).toBe("errorEmptyFile");
  });

  it("rejects a file above the size limit", () => {
    const res = validateAttachmentFile({
      fileName: "big.pdf",
      sizeBytes: ATTACHMENT_MAX_BYTES + 1,
      mimeType: "application/pdf",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorKey).toBe("errorTooLarge");
  });

  it("accepts a file exactly at the size limit", () => {
    expect(
      validateAttachmentFile({ fileName: "edge.pdf", sizeBytes: ATTACHMENT_MAX_BYTES, mimeType: "application/pdf" }).ok,
    ).toBe(true);
  });

  it("enforces the per-batch file count", () => {
    expect(validateBatchSize(ATTACHMENT_MAX_BATCH).ok).toBe(true);
    const res = validateBatchSize(ATTACHMENT_MAX_BATCH + 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorKey).toBe("errorTooManyFiles");
  });
});

describe("filename sanitization", () => {
  it("strips directory traversal and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("my file (v2).pdf")).toBe("my_file_v2_.pdf".replace(/_+/g, "_"));
  });

  it("prevents hidden files and empty results", () => {
    expect(sanitizeFileName("...")).toBe("file");
    expect(sanitizeFileName(".secret")).toBe("secret");
    expect(sanitizeFileName("")).toBe("file");
  });

  it("caps the length", () => {
    expect(sanitizeFileName("a".repeat(500)).length).toBeLessThanOrEqual(120);
  });

  it("extensionFromFileName lowercases and handles no-extension", () => {
    expect(extensionFromFileName("Report.PDF")).toBe("pdf");
    expect(extensionFromFileName("noext")).toBe("");
  });
});

describe("single-parent oracle (mirrors DB CHECK)", () => {
  it("accepts exactly a task parent", () => {
    expect(validateSingleParent({ taskId: "t1", subtaskId: null }).ok).toBe(true);
  });
  it("accepts exactly a subtask parent", () => {
    expect(validateSingleParent({ taskId: null, subtaskId: "s1" }).ok).toBe(true);
  });
  it("rejects both parents", () => {
    const res = validateSingleParent({ taskId: "t1", subtaskId: "s1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorKey).toBe("errorBothParents");
  });
  it("rejects neither parent", () => {
    const res = validateSingleParent({ taskId: null, subtaskId: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorKey).toBe("errorNoParent");
  });
});

describe("storage path is scoped, deterministic and collision-free", () => {
  it("builds a project+task scoped path with the attachment id", () => {
    const path = buildAttachmentPath({
      projectId: "proj-1",
      taskId: "task-9",
      attachmentId: "att-abc",
      fileName: "Site Plan.pdf",
    });
    expect(path).toBe("projects/proj-1/task/task-9/att-abc-Site_Plan.pdf");
    // folder[1] must be 'projects' and folder[2] the projectId for the RLS.
    const parts = path.split("/");
    expect(parts[0]).toBe("projects");
    expect(parts[1]).toBe("proj-1");
  });

  it("builds a project+subtask scoped path", () => {
    const path = buildAttachmentPath({
      projectId: "proj-1",
      subtaskId: "sub-3",
      attachmentId: "att-xyz",
      fileName: "photo.png",
    });
    expect(path).toBe("projects/proj-1/subtask/sub-3/att-xyz-photo.png");
  });

  it("never lets a malicious filename escape the scoped prefix", () => {
    const path = buildAttachmentPath({
      projectId: "proj-1",
      taskId: "task-9",
      attachmentId: "att-1",
      fileName: "../../../../secret.pdf",
    });
    expect(path.startsWith("projects/proj-1/task/task-9/att-1-")).toBe(true);
    expect(path).not.toContain("..");
  });
});
