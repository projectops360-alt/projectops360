-- ============================================================================
-- ProjectOps360° — Add drawing_pages.extracted_text
-- Migration: 20260715000000_add_drawing_pages_extracted_text.sql
--
-- The full per-page sheet text is the source for material/quantity takeoff.
-- The column was defined in the drawing-intelligence schema file but the
-- applied prod schema predates it, so the processing pipeline could not
-- persist page text (insert/select silently failed) and the AI only ever saw
-- the heuristic "general notes" block. Adding it (idempotent) unblocks the
-- full-text → takeoff path.
-- ============================================================================

ALTER TABLE public.drawing_pages
  ADD COLUMN IF NOT EXISTS extracted_text text;

COMMENT ON COLUMN public.drawing_pages.extracted_text IS
  'Full extracted text for this page (vector PDF text layer). Source for material/quantity takeoff and the AI evidence-validation corpus. Null for scanned pages without OCR.';
