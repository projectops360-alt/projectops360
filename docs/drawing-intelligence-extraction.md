# Drawing Intelligence — PDF Extraction Engine (Prompt 3 of 5)

> Implemented 2026-06-12. First real intelligence layer: PDF text extraction,
> title block / revision block / notes heuristics, discipline classification,
> evidence + confidence, needs_review handling. No RFI/risk automation yet
> (Prompt 4), no Autodesk APS, no symbol detection.

## Dependency added
`unpdf` (1.6.2) — serverless-friendly pdf.js build for Node. Only PDF text
extraction; no native deps. **First dependency added to the project for this
feature** (none existed for PDF/OCR).

## Architecture (src/lib/drawing-intelligence/)

| Module | Role |
|---|---|
| `pdf-extraction.ts` | PdfExtractionService — page count + per-page text via unpdf; classifies scanned PDFs (avg < 40 chars/page); error codes `encrypted_pdf` / `invalid_pdf` / `extraction_failed`; re-inserts line breaks before known labels so regex extractors work line-by-line. |
| `ocr.ts` | OcrService abstraction — `OcrProvider` interface + `NullOcrProvider` (OCR not configured). Plug point: implement provider + register in `getOcrProvider()`; pipeline needs no other change. |
| `extractors.ts` | Pure heuristics (23 unit tests): `extractTitleBlock` (12 labeled fields, bare-pattern fallback 0.6, filename fallback 0.5), `extractRevisionBlock` (table rows gated on a REV header), `extractNotes` (9 section categories, numbered/keynote items), `classifyDiscipline` (number prefix 0.9 → title/page/filename keywords 0.8/0.7/0.6 → Unknown 0). `CONFIDENCE_REVIEW_THRESHOLD = 0.7`. |
| `processing.ts` | DrawingProcessingService — orchestrator. Downloads from the `drawings` bucket, runs the pipeline, writes pages/extractions/evidence, canonical JSON, updates file + job statuses. Idempotent: reprocessing soft-deletes previous derived rows first. |

## Pipeline behavior
1. Non-PDF files: images → `needs_review` (`ocr_unavailable`); CAD/BIM →
   `needs_review` (`awaiting_aps_connector`). Honest, no fake processing.
2. PDF: download → text per page → `drawing_pages` rows → per-page heuristics.
3. Scanned PDF + no OCR: page shells created, file → `needs_review`,
   ocr_extraction job → `needs_review` (`scanned_pdf_ocr_unavailable`).
4. Title block: searched on every page, best-confidence page wins.
5. Writes: `drawing_extractions` (title_block / revision_block /
   general_notes / keynotes; `model_used: "heuristic/v1"`), `drawing_evidence`
   (per field + per note: page, excerpt, confidence), canonical JSON +
   overall confidence into `drawing_files.metadata.canonical_extraction`.
6. File metadata updated (number/title/revision/revision_date/discipline)
   only filling/overriding with extracted values; filename inference remains
   the fallback.
7. Final status: `completed`, or `needs_review` when overall confidence
   < 0.7 or no title block found. Jobs: page_split → completed,
   ocr_extraction → completed (or needs_review for scanned),
   ai_interpretation → **stays pending for Prompt 4**.
8. Stage log (in `processing_metadata_json.stages`): pdf_loaded,
   pages_detected, text_extracted, pages_stored, title_block_extracted,
   revision_block_extracted, notes_extracted, evidence_stored,
   metadata_updated (+ ocr_fallback_unavailable when applicable).

## Triggers
- **Automatic**: `registerDrawingFileAction` fires `processDrawingFile`
  fire-and-forget after upload (same pattern as embedding generation).
- **Manual**: "Run extraction" button in the detail panel
  (`processDrawingFileAction`, awaited).
- **Retry**: `retryDrawingProcessingJobAction` now also re-runs the pipeline.

## UI
- Detail panel sections: Metadata, Pages, **Title Block** (field/value/
  confidence chips, green ≥70% / amber below), **Revisions**, **Notes**
  (id, category, page, confidence), **Evidence** (excerpt + page +
  confidence), **Raw extracted JSON** (collapsible `<pre>`), needs-review
  banner ("AI extraction needs review because confidence is low"), Run
  extraction button.
- AI Extraction Results tab: project-wide extraction table (drawing, type,
  confidence, status) — rows open the detail panel.

## Known limitations (deliberate)
- Text extraction loses layout → no coordinates in evidence yet (excerpt +
  page only); `coordinates_json` stays empty until a layout-aware pass.
- OCR is a null provider — scanned PDFs are flagged, not processed.
- Evidence rows reference the file id as `related_entity_id` (note/field
  granularity arrives when insights exist to link against in Prompt 4).
- Processing runs in the request process (fire-and-forget). Job rows are the
  contract; moving to a background worker is a drop-in change.

## ⚠️ Prerequisites still pending on hosted Supabase
Migrations `20260705…` (tables) and `20260706…` (bucket+policies) — the user
was given the exact SQL to paste in the SQL Editor.
