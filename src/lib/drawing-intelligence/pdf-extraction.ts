// ============================================================================
// ProjectOps360° — PdfExtractionService (Prompt 3)
// ============================================================================
// Thin wrapper around `unpdf` (serverless-friendly pdf.js build): page count
// and per-page text for vector/searchable PDFs. Scanned PDFs return empty
// text and fall through to the OCR abstraction (see ocr.ts).
// Server-only — do not import from client components.
// ============================================================================

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  ok: true;
  totalPages: number;
  pages: PdfPageText[];
  /** True when the PDF produced almost no text (likely scanned/raster) */
  isLikelyScanned: boolean;
}

export interface PdfExtractionFailure {
  ok: false;
  error: "encrypted_pdf" | "invalid_pdf" | "extraction_failed";
  message: string;
}

/** Minimum average characters per page for a PDF to count as "searchable" */
const SCANNED_TEXT_THRESHOLD = 40;

export async function extractPdfText(
  buffer: Uint8Array,
): Promise<PdfExtractionResult | PdfExtractionFailure> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pages: PdfPageText[] = (text as string[]).map((pageText, i) => ({
      pageNumber: i + 1,
      // unpdf joins text items with spaces; normalize line-ish breaks so the
      // heuristic extractors (which split on \n) get usable lines.
      text: normalizePageText(pageText),
    }));

    const totalChars = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
    const isLikelyScanned = totalPages > 0 && totalChars / totalPages < SCANNED_TEXT_THRESHOLD;

    return { ok: true, totalPages, pages, isLikelyScanned };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password|encrypt/i.test(message)) {
      return { ok: false, error: "encrypted_pdf", message };
    }
    if (/invalid|corrupt|structure|header/i.test(message)) {
      return { ok: false, error: "invalid_pdf", message };
    }
    return { ok: false, error: "extraction_failed", message };
  }
}

/** pdf.js extraction loses layout; re-introduce line breaks at common
 *  boundaries so regex extractors can work line-by-line. */
function normalizePageText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Break before numbered note items glued into one line: "… 1. THE …"
    .replace(/\s+(\d{1,2}[.)]\s+[A-Z])/g, "\n$1")
    // Break before common title-block labels
    .replace(
      /\s+((?:DRAWING|DWG|SHEET|PROJECT|TITLE|REV(?:ISION)?|SCALE|DATE|DRAWN|CHECKED|APPROVED|GENERAL\s+NOTES|KEY\s*NOTES)\b)/gi,
      "\n$1",
    )
    .trim();
}
