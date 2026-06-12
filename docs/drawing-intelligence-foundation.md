# Drawing Intelligence — Foundation (Prompt 1 of 5)

> Implemented 2026-06-12. Foundation only: data model, routes, navigation, UI shell.
> No OCR, no Autodesk APS, no AI extraction, no PDF rendering yet (by design).

## What was added and where

### 1. Database schema
`supabase/migrations/20260705000000_create_drawing_intelligence.sql`

Seven tables, all following the existing conventions (org + project scoping,
soft delete via `deleted_at`, `updated_at` trigger, RLS with `is_org_member()`
plus service-role bypass):

| Table | Purpose |
|---|---|
| `drawing_files` | Uploaded/connected drawing files. Source-agnostic (`source_system`: manual_upload, autodesk_aps, procore, google_drive, local). File status: active/superseded/archived. Processing status: pending/processing/completed/failed/needs_review/cancelled. |
| `drawing_pages` | Per-page/sheet metadata (title block, revision block, scale, preview). Unique per (file, page_number). |
| `drawing_extractions` | Structured extraction results. `extraction_type` is an open text set (title_block, general_notes, rooms, mep_elements, quantity_takeoff, rfi_candidates, risk_candidates, …). |
| `drawing_insights` | AI interpretations with CHECK-constrained `insight_type` (risk, rfi_candidate, submittal_requirement, schedule_impact, cost_impact, missing_information, contradiction, scope_gap, coordination_issue, version_change, decision_required), severity, confidence, evidence and links (`linked_task_id` FK to roadmap_tasks; risk/rfi/submittal/schedule IDs reserved as plain uuid until those tables exist). |
| `drawing_versions` | Revision-to-revision comparison metadata (changed pages, deltas, summary). |
| `drawing_processing_jobs` | Background job tracking (job_type open set: ingest, page_split, title_block_extraction, insight_generation, version_compare). |
| `drawing_evidence` | Traceability: links any entity back to exact drawing locations (page, coordinates, excerpt, image crop). |

**The migration has NOT been applied to the hosted database yet** — apply with
`supabase db push` (or paste into the SQL editor). All pages degrade gracefully
to empty states until then.

### 2. Types
`src/types/drawing-intelligence.ts` — row interfaces for the 7 tables, status
unions, and the **canonical extraction JSON contract**
(`CanonicalDrawingExtraction` = `{ drawing: {...}, pages: [...] }`) that every
future extraction engine must populate, plus `emptyCanonicalExtraction()`.

### 3. Navigation (3 places, per requirements)
- **Global sidebar**: `src/config/navigation.ts` — "Drawing Intelligence"
  (DraftingCompass icon) → `/drawing-intelligence`.
- **AI Command Center**: `src/app/[locale]/(app)/ai-operator/page.tsx` — module
  card linking to Drawing Intelligence.
- **Per project**: `src/components/layout/project-tabs.tsx` — new tab →
  `/projects/[projectId]/drawing-intelligence`.

Deliberately **not** placed under Documents — Documents stores files; Drawing
Intelligence interprets them (the UI states this explicitly).

### 4. Routes / UI shell
- `src/app/[locale]/(app)/drawing-intelligence/page.tsx` — global entry:
  header + positioning note + project selector cards with drawing counts.
- `src/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/page.tsx`
  — server page (auth via `getOrgContext`, org-scoped queries, parallel fetch
  of project + drawing_files + drawing_processing_jobs).
- `.../drawing-intelligence-client.tsx` — UI shell with the 13 planned tabs:
  Upload/Connect, Drawing Library, AI Extraction Results, Detected Risks,
  Generated RFIs, Submittal Requirements, Quantity Takeoff, Version Changes,
  Schedule Impact, Cost Impact, Recommended Actions, Evidence Viewer,
  Processing Logs. Library renders a functional table (number, title,
  discipline, revision, source, status badges, processing badges). Upload tab
  shows the four connector placeholders ("Coming soon"). Logs tab lists real
  `drawing_processing_jobs` rows when they exist. Other tabs show
  empty/coming-soon panels.

### 5. i18n
Full EN + ES sections under `drawingIntelligence` in `messages/*.json`, plus
`nav.drawingIntelligence` and `projectTabs.drawingIntelligence`.

## Decisions worth knowing
- `organization_id` added to every table (the suggested schema omitted it on
  `drawing_pages`) because RLS here is `is_org_member(organization_id)`.
- `extraction_type` and `job_type` are open text (no CHECK) for forward
  compatibility; `insight_type`, statuses and severity ARE CHECK-constrained.
- `(string & {})` unions in TS keep autocompletion while allowing future values.
- No seed data added (not required for the foundation; the DC labor seeds are
  scenario-specific).

## Ready for Prompt 2 (Drawing Ingestion Pipeline)
Storage path field, processing job table, page model and canonical JSON are in
place; the pipeline only needs to write into them.
