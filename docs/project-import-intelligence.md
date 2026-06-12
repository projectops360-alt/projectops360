# Project Import Intelligence — Implementation Notes

Date: 2026-06-12. Module: AI Project Import Engine (`/import`).

## What it does

Upload an existing project file (XLSX, CSV, JSON, DOCX, PDF, TXT/MD) →
analyze → extract entities into the canonical import schema → validate with
confidence scores → review/edit/enable-disable per row → explicit approval →
import into the universal execution model, with Living Graph relationships,
critical path recalculation, rollback tracking, and AI recommendations.
Nothing is ever imported without preview; merge mode never overwrites.

## Architecture

```
upload (client → private 'project-imports' bucket, org-scoped RLS path)
  → createImportJobAction        (registers job; client metadata not trusted)
  → analyzeImportJobAction       (server downloads file from storage)
      parse.ts                   XLSX (exceljs) / CSV (custom RFC-4180-ish,
                                 handles ; and tabs) / JSON / DOCX (mammoth)
                                 / PDF (unpdf) / TXT-MD (md tables)
      extract.ts                 deterministic, bilingual header synonyms,
                                 table classification, dependency columns +
                                 phrase inference, status/priority/date
                                 normalization, project type detection
      ai-extract.ts              AI fallback for unstructured text (prompt
                                 type 'custom' via runAi/ai_runs); confidence
                                 capped at 0.6; skipped without OPENAI_API_KEY
      validate.ts                per-entity statuses, duplicates, cycle
                                 detection (blocker), critical-path readiness,
                                 deterministic recommendations
  → review UI                    tabs per entity, toggle will_import,
                                 confidence %, warnings, raw data
  → executeImportAction
      execute.ts                 project/milestones/resources/budget/tasks/
                                 dependencies/materials/risks; auto-milestones
                                 from task phase refs; merge duplicate skip;
                                 every row tracked in
                                 project_import_created_records; Living Graph
                                 nodes+edges; recalculateCriticalPath; failure
                                 ⇒ automatic rollback of the partial batch
  → rollbackImportAction         removes the whole batch by import_job_id
```

## Database (migration 20260710000000 — applied to prod 2026-06-12)

7 tables: `project_import_jobs`, `project_import_raw_data`,
`project_import_mappings`, `project_import_entities`,
`project_import_validation_results`, `project_import_audit_events`,
`project_import_created_records` (rollback tracking). Private storage bucket
`project-imports` (path `project-imports/{org}/{job}/{file}`, member RLS).
Living Graph CHECKs extended: node `import_event`, source
`project_import_jobs`, edges `contains`, `imported_from`.

## Navigation entry points (4)

1. Global sidebar: Import Project (`/import`).
2. AI Command Center: Project Import Intelligence card.
3. Create Project dialog: "Or import an existing project file…" link.
4. Project Settings: "Import / Merge Project Data" card (`/import?projectId=…`, preselects merge mode).

## New dependencies

`exceljs` (XLSX read; formulas are read as computed text, never evaluated),
`mammoth` (DOCX → text + HTML tables), `pg` (devDependency for migration
scripts). PDF reuses `unpdf`.

## Environment variables

- `OPENAI_API_KEY` — optional; enables the AI fallback for prose documents.
  Without it, table-based files still import fully; unstructured PDFs fail
  with a clear "no extractable content" message.

## Supported formats / limitations

| Format | Tables | Prose | Notes |
|---|---|---|---|
| XLSX | ✅ per sheet | — | password-protected ⇒ clear error |
| CSV | ✅ (`,` `;` tab) | — | header synonyms en/es |
| JSON | ✅ canonical-ish keys | — | invalid JSON ⇒ clear error |
| DOCX | ✅ HTML tables | ✅ AI | |
| PDF | — | ✅ AI | scanned PDFs (no text layer) not supported — OCR pending |
| TXT/MD | ✅ md tables | ✅ AI | |
| MPP / XER / XML / Google Sheets / Procore / Autodesk | — | — | future connectors |

Other known limitations: review screen edits are enable/disable + project
type/name (full inline field editing uses `updateImportEntityAction`, wired
server-side but minimal in UI); equipment/RFIs/submittals/procurement parse
into the canonical schema only when present as classified tables (no
dedicated extractors yet); merge duplicate detection is name-based (no
embedding similarity yet).

## Manual QA checklist

- [ ] XLSX with Tasks/Materials/Budget/Risks sheets → counts match, preview tabs populated.
- [ ] CSV task list (en y es headers) → tasks + owners + dependencies extracted.
- [ ] JSON `{project, tasks[]}` → project name + tasks + name-ref dependencies.
- [ ] DOCX plan with a task table → table extracted; prose-only → AI fallback.
- [ ] PDF text plan → AI extraction with ≤60% confidence, all needs_review.
- [ ] Invalid JSON / empty CSV / .exe → clear bilingual error, job marked failed.
- [ ] Duplicate task names → duplicate status + warning.
- [ ] Circular dependency in file → blocker; disabling one dependency allows import.
- [ ] Create-new → project visible with milestones/tasks/materials/budget/risks.
- [ ] Merge into existing → duplicates skipped, nothing overwritten.
- [ ] After import: Living Graph shows import node + contains/imported_from edges.
- [ ] Critical path snapshot created when dependencies imported.
- [ ] Rollback (`rollbackImportAction`) removes the full batch.
- [ ] Cross-org access blocked (RLS on tables + storage paths).

## Recommended next sprint

1. Inline editing in the review table (owners, dates, durations) using the
   existing `updateImportEntityAction`.
2. OCR fallback for scanned PDFs.
3. MPP/XER connectors behind the connector-registry pattern.
4. Import history page (list `project_import_jobs` with rollback button —
   action already exists).
5. Embedding-based duplicate detection in merge mode.
