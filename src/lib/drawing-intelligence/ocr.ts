// ============================================================================
// ProjectOps360° — OcrService abstraction (Prompt 3)
// ============================================================================
// No OCR library exists in the project, so this is a clean plug point:
// scanned PDFs / images flow through here and today receive a deterministic
// "unavailable" answer (the pipeline marks them needs_review instead of
// pretending). To enable OCR later, implement OcrProvider and register it in
// getOcrProvider() — the processing pipeline needs no other change.
// ============================================================================

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrProvider {
  readonly name: string;
  isAvailable(): boolean;
  /** Extract text from a rendered page image */
  extractText(image: Uint8Array, pageNumber: number): Promise<OcrPageResult>;
}

/** Default provider: OCR not configured. */
class NullOcrProvider implements OcrProvider {
  readonly name = "none";
  isAvailable(): boolean {
    return false;
  }
  extractText(): Promise<OcrPageResult> {
    return Promise.reject(new Error("OCR provider not configured"));
  }
}

let provider: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (!provider) {
    // Future: switch on env (e.g. DRAWING_OCR_PROVIDER=tesseract|textract|vision)
    provider = new NullOcrProvider();
  }
  return provider;
}
