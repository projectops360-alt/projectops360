# Drawing Intelligence — Ingestion Pipeline (Prompt 2 of 5)

> Implemented 2026-06-12. Functional manual upload, processing jobs, retry,
> detail panel, logs. OCR/AI extraction intentionally left for Prompt 3.

## What was added and where

### Storage
`supabase/migrations/20260706000000_create_drawings_storage.sql` — private
`drawings` bucket with org-scoped policies (same pattern as `documents`).
Path convention: `drawings/{organization_id}/{project_id}/{uuid}-{filename}` —
the second path segment is checked against `is_org_member()` so cross-org
access is impossible even with direct storage calls.

### Service layer (pure helpers)
`src/lib/drawing-intelligence/ingestion.ts`
- `SUPPORTED_DRAWING_FORMATS` / `SUPPORTED_EXTENSIONS`: pdf (main path), dwg,
  rvt, ifc (metadata-level, awaiting Autodesk APS), png, jpg/jpeg.
- `MAX_DRAWING_FILE_SIZE` = 50 MB.
- `validateDrawingFile()` — pure, runs on **both** client and server (client
  metadata is never trusted alone).
- `inferDrawingMetadata()` — best-effort drawing number/revision from file
  names ("A-101_R3.pdf" → A-101 / 3); overridable by title-block extraction.
- `buildDrawingStoragePath()` — canonical storage key builder.
- Tests: `src/lib/drawing-intelligence/__tests__/ingestion.test.ts` (12 tests).

### Server actions
`src/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/actions.ts`
- `registerDrawingFileAction` — called after the client uploads to storage.
  Validates (zod + shared validator), verifies org/project access
  (`assertProjectAccess`), verifies the storage path matches the caller's
  org/project prefix, detects duplicates (checksum first, name+size fallback),
  infers metadata, inserts the `drawing_files` row (processing_status
  `pending`), and creates the pipeline jobs.
- `retryDrawingProcessingJobAction` — re-queues only `failed`/`cancelled`
  jobs on the **same row** (increments `retry_count`; no duplicate records);
  resets the parent file from `failed` → `pending`.
- `archiveDrawingFileAction` — soft delete (file + its jobs). Storage object
  intentionally kept, consistent with the app's soft-delete pattern.
- `getDrawingDetailAction` — file + pages + extractions + jobs in parallel,
  lazy-loaded by the detail panel.

### Pipeline model
One job row per stage (independent, idempotent, ready to move to background
workers):

| job_type | today | future |
|---|---|---|
| `ingest` | **completed synchronously** (upload received → metadata stored → file stored → record created → validation completed; stages recorded in `processing_metadata_json`) | — |
| `page_split` | created `pending` (`queued_reason: awaiting_pdf_engine`) | Prompt 3 — **no PDF dependency exists in the project today**, page counting deliberately skipped |
| `ocr_extraction` | created `pending` | Prompt 3 |
| `ai_interpretation` | created `pending` | Prompt 3+ |

**Status mapping note:** the DB CHECK constraints from Prompt 1 use
`pending/processing/completed/failed/needs_review/cancelled`. The prompt's
suggested vocabulary maps onto them in UI copy only (pending = "Queued for
intelligence processing", completed = "Processed — ready for AI
interpretation", retrying = re-queued `pending` with `retry_count++`). No
schema churn.

### UI
- **Upload tab**: real drag & drop + multi-file (`DrawingUploadZone`,
  `src/components/drawing-intelligence/drawing-upload-zone.tsx`). Per-file
  pipeline stages: validating → uploading → registering → "Queued for
  intelligence processing" / error. SHA-256 checksum computed client-side
  (crypto.subtle) for dedup. Files upload **directly to storage from the
  browser** (same pattern as Documents) so server actions never carry file
  bytes — no body-size limits, UI never blocks.
- **Library tab**: clickable rows + actions column (View / Retry when a job
  failed / Archive with confirm).
- **Detail side panel** (`drawing-detail-panel.tsx`): metadata grid, pipeline
  status with intelligence-language hints, per-job retry, error messages,
  pages list (fills with Prompt 3), placeholders for extraction results and
  evidence viewer.
- **Logs tab**: job type, status badge, retry counter, started→completed
  timestamps, error message, source file.
- Refresh behavior: `router.refresh()` after upload/retry/archive (the app's
  existing pattern; no polling loop added).

### i18n
EN/ES: `drawingIntelligence.uploadZone/errors/actionsMenu/pipelineHints/jobTypes/detail`.

## Error codes (server → UI translation keys)
`unsupported_file_type`, `file_too_large`, `empty_file`, `duplicate_file`,
`upload_failed`, `missing_project_context`, `processing_job_failed`,
`storage_error`, `permission_error`, `not_authenticated`, `job_not_retryable`.

## ⚠️ Deployment prerequisites
Two migrations must be applied to the hosted Supabase before uploads work:
1. `20260705000000_create_drawing_intelligence.sql` (tables — from Prompt 1)
2. `20260706000000_create_drawings_storage.sql` (bucket + policies)

Until then the UI renders with empty states and uploads fail at the storage
step with a clear error.

## Ready for Prompt 3
The extraction engine only needs to: pick up `pending` jobs, set
`processing` → write `drawing_pages` / `drawing_extractions` → set
`completed`/`failed` (+ `error_message`), and update the parent file's
`processing_status`. Retry and logs already work against that contract.
