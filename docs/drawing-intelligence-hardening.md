# Drawing Intelligence — APS Architecture, Version Sync, Cost Controls (Prompt 5 of 5)

> Implemented 2026-06-12. Final prompt: vendor-agnostic connector layer
> (Autodesk-ready, never fakes success), version sync + delta detection,
> cost-aware processing modes, webhook abstraction, hardening + QA checklist.

## What was built

### Connector abstraction — `src/lib/drawing-intelligence/connectors/`
- `types.ts` — `DrawingConnector` contract (isConfigured / getStatus /
  listProjects / listFolders / listFiles), `ConnectorNotConfiguredError`.
  Canonical model stays ProjectOps360°-owned; connectors only translate.
- `autodesk.ts` — `AutodeskConnector`: REAL 2-legged OAuth
  (`/authentication/v2/token`, token cached until expiry), hub→project→
  folder→file listing via Data Management API, 15-20s request timeouts.
  Gated on `APS_CLIENT_ID` + `APS_CLIENT_SECRET`; without them every method
  throws and `getStatus()` reports `not_configured`. Model Derivative + AEC
  Data Model + webhook registration are documented TODO plug points.
- `registry.ts` — single lookup; future Procore/Drive connectors register here.
- `events.ts` — internal `DrawingSourceEvent` abstraction (file.created /
  file.updated / file.version.created / file.deleted / model.translated /
  extraction.completed), zod-validated, dispatched by
  `handleDrawingSourceEvent` (marks files pending version sync, archives
  deleted external files; import requires a configured connector — honest).

### Webhook endpoint — `src/app/api/webhooks/drawings/route.ts`
POST only. Refuses (503) without `DRAWING_WEBHOOK_SECRET`; verifies
`x-webhook-secret` header (401); zod-validates payloads (400); dispatches
through the event abstraction. Never trusts external payloads blindly.

### Version sync — `src/lib/drawing-intelligence/version-sync.ts`
After processing (standard/deep modes): finds the previous active file with
the same project + drawing_number, builds a metadata/text delta
(`buildVersionDelta`, pure, 6 tests): revision change, page-count delta,
new/removed notes (case-insensitive). Records `drawing_versions`
(idempotent per file-pair), supersedes the old file, creates an
evidence-backed `version_change` insight ("Drawing A-101 changed from R2 to
R3… Human review recommended before field execution", severity high when new
notes exist, status `in_review`), and emits Living Graph insight node + edge.
Visual page diffing deliberately deferred.

### Cost-aware processing
- `ProcessingMode`: `quick_scan` (extraction only, no AI) /
  `standard_analysis` (default; + deterministic insights + version sync, no
  AI) / `deep_analysis` (+ AI enhancement — the only mode that spends
  tokens). Selected per-upload in the UI (persisted in file metadata),
  overridable on reprocess.
- Existing controls kept: duplicates blocked at registration; no-text files
  never reach AI; AI requires explicit OrgContext.
- Cost tracking on job rows (`processing_metadata_json`): `processing_mode`,
  `pages_processed`, `processing_duration_ms`, `estimated_ocr_cost` (0 —
  no provider), `estimated_ai_token_cost` + `model_used` (from ai_runs).

### BIM scaffolding — `src/types/bim.ts`
Types only (`BimModelRef`, `BimElementRef`). Tables deliberately NOT created
(dead schema until Model Derivative is implemented) — documented TODO.

### UI
Processing-depth selector + cost note in the upload zone; Autodesk card with
real configured/not-configured state (env checked server-side, never
exposed); styled source badges (Manual upload / Autodesk / …); Version
Changes tab listing `drawing_versions` (drawing, rev from→to, detected
changes, date; row opens the detail panel).

## Database changes
None in this prompt (drawing_versions existed since Prompt 1; cost fields
live in `processing_metadata_json`).

## Environment variables
| Var | Purpose |
|---|---|
| `APS_CLIENT_ID` / `APS_CLIENT_SECRET` | Autodesk APS app credentials (https://aps.autodesk.com/myapps; enable Data Management + Model Derivative; link via ACC Account Admin → Custom Integrations) |
| `DRAWING_WEBHOOK_SECRET` | Shared secret for /api/webhooks/drawings |
| `OPENAI_API_KEY` | (existing) required for deep_analysis AI enhancement |
Added to `.env.example`.

## Remaining TODOs
1. APS Model Derivative pipeline → bim_* tables (create tables then).
2. APS webhook registration (dm.version.added → /api/webhooks/drawings).
3. ACC file import flow (browse UI + connector.importFile + storage copy).
4. 3-legged OAuth for user-context ACC access (2-legged implemented).
5. OCR provider (NullOcrProvider plug point from Prompt 3).
6. Visual page diffing; evidence coordinates (layout-aware extraction).
7. Convert-insight-to-Risk/RFI/Submittal once those modules exist.

## Known limitations
- Autodesk listing is implemented but untested against a real ACC account
  (no credentials available) — first run may need folder-URN adjustments.
- Version matching keys on `drawing_number`; files without one never
  version-match.
- Background processing runs in-process (fire-and-forget); job rows are the
  contract for moving to workers.

## Manual QA checklist (Prompt 5 acceptance)
1. ☐ Manual PDF upload works (drag & drop, multi-file).
2. ☐ Drawing appears in the library with source badge.
3. ☐ 4 processing jobs created; ingest completed immediately.
4. ☐ Extraction results stored (title block/revisions/notes in detail panel).
5. ☐ Insights are evidence-backed (quoted excerpts on every card).
6. ☐ Accept / dismiss / link-to-task workflow updates status.
7. ☐ Living Graph shows drawing + insight nodes with relationship edges.
8. ☐ Re-uploading the same drawing number with a new revision creates a
     drawing_versions record + version_change insight, supersedes the old file.
9. ☐ Re-uploading the exact same file is rejected as duplicate (checksum).
10. ☐ Failed jobs show Retry; retry re-runs the pipeline on the same row.
11. ☐ Unsupported file (.skp) shows a clear inline error.
12. ☐ Autodesk card shows "Not configured" without env vars; "Configured"
     with them.
13. ☐ Cross-org isolation: drawings never visible outside their org (RLS +
     org-scoped queries + storage path policies).
14. ☐ `next build` passes; Roadmap/Workboard/Living Graph/Labor unaffected.

## Recommended next sprint
1. Wire real ACC import (browse + import + webhook registration) with a test
   Autodesk account.
2. OCR provider (Textract or tesseract.js) for scanned PDFs.
3. Background worker (queue) for processing + interpretation.
4. Risks/RFIs/Submittals as first-class modules → enable insight conversion.
5. Evidence viewer with page-image crops (needs PDF rendering).
