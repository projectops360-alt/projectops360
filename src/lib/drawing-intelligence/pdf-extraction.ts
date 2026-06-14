// ============================================================================
// ProjectOps360° — PdfExtractionService (Prompt 3)
// ============================================================================
// Per-page text for vector/searchable PDFs. Two backends:
//   1. LlamaParse (when LLAMA_CLOUD_API_KEY is set) — GenAI-native parsing that
//      preserves tables, fractions and layout as clean markdown. Far better
//      input for the takeoff AI. Free tier covers development.
//   2. unpdf (always available, no key) — pdf.js text layer fallback.
// LlamaParse is tried first; ANY failure falls back to unpdf so the pipeline
// never breaks. Server-only — do not import from client components.
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
  /** Which backend produced the text (telemetry). */
  engine: "llamaparse" | "unpdf";
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
  // 1. Try LlamaParse when configured — richer, table-aware extraction.
  if (process.env.LLAMA_CLOUD_API_KEY) {
    try {
      const lp = await extractWithLlamaParse(buffer, process.env.LLAMA_CLOUD_API_KEY);
      if (lp && lp.pages.length > 0) return lp;
    } catch (error) {
      console.error("[pdf-extraction] LlamaParse failed, falling back to unpdf:", error);
    }
  }
  // 2. Fallback: unpdf (no key, always available).
  return extractWithUnpdf(buffer);
}

// ── Backend 1: LlamaParse (GenAI-native, table-aware) ──────────────────────────

const LLAMA_BASE = "https://api.cloud.llamaindex.ai/api/parsing";
const LLAMA_POLL_INTERVAL_MS = 2500;
const LLAMA_MAX_POLLS = 40; // ~100s ceiling

async function extractWithLlamaParse(
  buffer: Uint8Array,
  apiKey: string,
): Promise<PdfExtractionResult | null> {
  const auth = { Authorization: `Bearer ${apiKey}` };

  // 1. Upload → job id
  const form = new FormData();
  form.append("file", new Blob([buffer as unknown as BlobPart], { type: "application/pdf" }), "drawing.pdf");
  const upload = await fetch(`${LLAMA_BASE}/upload`, { method: "POST", headers: auth, body: form });
  if (!upload.ok) {
    console.error("[pdf-extraction] LlamaParse upload HTTP", upload.status);
    return null;
  }
  const uploaded = (await upload.json()) as { id?: string };
  const jobId = uploaded.id;
  if (!jobId) return null;

  // 2. Poll until SUCCESS / ERROR / timeout
  let status = "PENDING";
  for (let i = 0; i < LLAMA_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, LLAMA_POLL_INTERVAL_MS));
    const res = await fetch(`${LLAMA_BASE}/job/${jobId}`, { headers: auth });
    if (!res.ok) continue;
    const j = (await res.json()) as { status?: string };
    status = (j.status ?? "").toUpperCase();
    if (status === "SUCCESS" || status === "COMPLETED") break;
    if (status === "ERROR" || status === "FAILED" || status === "CANCELLED") return null;
  }
  if (status !== "SUCCESS" && status !== "COMPLETED") return null; // timed out → fallback

  // 3. Per-page result (markdown preferred — preserves tables/fractions)
  const resultRes = await fetch(`${LLAMA_BASE}/job/${jobId}/result/json`, { headers: auth });
  if (!resultRes.ok) return null;
  const result = (await resultRes.json()) as {
    pages?: Array<{ page?: number; md?: string; text?: string }>;
  };
  const rawPages = result.pages ?? [];
  if (rawPages.length === 0) return null;

  const pages: PdfPageText[] = rawPages.map((p, i) => ({
    pageNumber: p.page ?? i + 1,
    // markdown carries tables/structure; fall back to plain text per page.
    text: (p.md ?? p.text ?? "").trim(),
  }));

  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  const isLikelyScanned = pages.length > 0 && totalChars / pages.length < SCANNED_TEXT_THRESHOLD;

  return { ok: true, totalPages: pages.length, pages, isLikelyScanned, engine: "llamaparse" };
}

// ── Backend 2: unpdf (pdf.js text layer) ───────────────────────────────────────

async function extractWithUnpdf(
  buffer: Uint8Array,
): Promise<PdfExtractionResult | PdfExtractionFailure> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pages: PdfPageText[] = (text as string[]).map((pageText, i) => ({
      pageNumber: i + 1,
      text: normalizePageText(pageText),
    }));

    const totalChars = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
    const isLikelyScanned = totalPages > 0 && totalChars / totalPages < SCANNED_TEXT_THRESHOLD;

    return { ok: true, totalPages, pages, isLikelyScanned, engine: "unpdf" };
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
    .replace(/\s+(\d{1,2}[.)]\s+[A-Z])/g, "\n$1")
    .replace(
      /\s+((?:DRAWING|DWG|SHEET|PROJECT|TITLE|REV(?:ISION)?|SCALE|DATE|DRAWN|CHECKED|APPROVED|GENERAL\s+NOTES|KEY\s*NOTES)\b)/gi,
      "\n$1",
    )
    .trim();
}
