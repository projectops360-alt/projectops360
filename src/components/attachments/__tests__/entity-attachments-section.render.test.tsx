// ============================================================================
// TASK-SUBTASK-FILE-ATTACHMENTS — UI render guard
// ============================================================================
// The section renders on task/subtask detail with a title + upload control; the
// presentational list renders empty state, file rows (name/size/date/uploader),
// Open always, Remove only when authorized (DTO.canRemove) and not readonly;
// EN and ES render without Spanglish (UX-012). Server-action + storage modules
// are mocked so the node-env SSR test never touches env/admin/browser clients.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";
import type { AttachmentDTO } from "@/lib/attachments/types";

vi.mock("@/lib/attachments/actions", () => ({
  listTaskAttachmentsAction: vi.fn(),
  listSubtaskAttachmentsAction: vi.fn(),
  getAttachmentSignedUrlAction: vi.fn(),
  removeAttachmentAction: vi.fn(),
}));
vi.mock("@/lib/attachments/storage-service", () => ({ uploadAttachment: vi.fn() }));

import { AttachmentListView, EntityAttachmentsSection, formatBytes } from "../entity-attachments-section";

function render(node: React.ReactElement, locale: "en" | "es" = "en"): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? esMessages : enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function att(overrides: Partial<AttachmentDTO> = {}): AttachmentDTO {
  return {
    id: "att-1",
    fileName: "Site Plan.pdf",
    fileExt: "pdf",
    mimeType: "application/pdf",
    sizeBytes: 2 * 1024 * 1024,
    uploadedById: "u1",
    uploadedByName: "Ana PM",
    uploadedAt: "2026-07-03T10:00:00.000Z",
    parentType: "task",
    canRemove: true,
    ...overrides,
  };
}

describe("formatBytes", () => {
  it("renders human-readable sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("attachments section header (task/subtask detail)", () => {
  it("renders the Attachments title and an upload control by default", () => {
    const html = render(<EntityAttachmentsSection projectId="p1" taskId="t1" />);
    expect(html).toContain('data-testid="entity-attachments"');
    expect(html).toContain("Attachments");
    expect(html).toContain('data-testid="attachment-upload-button"');
    expect(html).toContain('data-testid="attachment-file-input"');
  });

  it("hides the upload control for viewers (canUpload=false) and when readonly", () => {
    const viewer = render(<EntityAttachmentsSection projectId="p1" subtaskId="s1" canUpload={false} />);
    expect(viewer).not.toContain('data-testid="attachment-upload-button"');
    const ro = render(<EntityAttachmentsSection projectId="p1" subtaskId="s1" readonly />);
    expect(ro).not.toContain('data-testid="attachment-upload-button"');
  });

  it("renders the Spanish title without Spanglish (UX-012)", () => {
    const html = render(<EntityAttachmentsSection projectId="p1" taskId="t1" />, "es");
    expect(html).toContain("Adjuntos");
    expect(html).toContain("Agregar adjunto");
  });
});

describe("attachment list view", () => {
  const base = {
    loaded: true,
    hasError: false,
    busy: false,
    onOpen: () => {},
    onRemove: () => {},
  };

  it("shows the empty state when loaded with no attachments", () => {
    const html = render(<AttachmentListView {...base} attachments={[]} readonly={false} />);
    expect(html).toContain('data-testid="attachment-empty"');
    expect(html).toContain("No attachments yet");
  });

  it("renders a file row with name, size, date, uploader and Open", () => {
    const html = render(<AttachmentListView {...base} attachments={[att()]} readonly={false} />);
    expect(html).toContain('data-testid="attachment-item"');
    expect(html).toContain("Site Plan.pdf");
    expect(html).toContain("2.0 MB");
    expect(html).toContain("2026-07-03");
    expect(html).toContain("Ana PM");
    expect(html).toContain('data-testid="attachment-open"');
  });

  it("shows Remove only when canRemove and not readonly", () => {
    const removable = render(<AttachmentListView {...base} attachments={[att({ canRemove: true })]} readonly={false} />);
    expect(removable).toContain('data-testid="attachment-remove"');

    const notMine = render(<AttachmentListView {...base} attachments={[att({ canRemove: false })]} readonly={false} />);
    expect(notMine).not.toContain('data-testid="attachment-remove"');

    const ro = render(<AttachmentListView {...base} attachments={[att({ canRemove: true })]} readonly />);
    expect(ro).not.toContain('data-testid="attachment-remove"');
  });

  it("renders Spanish labels without Spanglish (UX-012)", () => {
    const html = render(<AttachmentListView {...base} attachments={[]} readonly={false} />, "es");
    expect(html).toContain("Aún no hay adjuntos");
  });
});
