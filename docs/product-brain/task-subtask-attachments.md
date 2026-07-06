# Task & Subtask File Attachments

**Guard:** `TASK-SUBTASK-FILE-ATTACHMENTS` · **Status:** Phase 1 (secure MVP) ·
**Migration:** `20260839000000_task_subtask_attachments.sql`

## 1. Purpose

Task and subtask execution needs supporting documents — drawings, PDFs, Word
docs, screenshots, acceptance evidence, invoices, QA proof, implementation
notes. This feature lets a project member attach files to **a task** or **a
subtask** so execution tracking carries its evidence. It is a document
attachment feature only: **no OCR, no summarization, no document AI** in this
phase (see §12).

## 2. Approved behavior

On a task or subtask detail surface, an **Attachments** section lets an
authorized user:

- Upload one or more files (batch up to 5).
- See the list: file name, type icon, size, upload date, uploader.
- Open/download a file via a short-lived signed URL.
- Remove a file when authorized.
- See an empty state when there are none.

A failure to load the list **never blocks** the surrounding task/subtask detail.

## 3. Supported parent entities

An attachment belongs to **exactly one** parent — a task **or** a subtask, never
both, never neither. Enforced three ways: the DB `CHECK` constraint
(`project_task_attachments_one_parent`), the `validateSingleParent` oracle, and
the register action's `zod` refine.

- Task parent → `roadmap_tasks`
- Subtask parent → `task_subtasks`

## 4. Supported file types (allowlist)

Documents: PDF, Word (`doc`/`docx`), Excel (`xls`/`xlsx`), PowerPoint
(`ppt`/`pptx`), plain text, CSV. Images: PNG, JPEG, WebP, GIF.

**Blocked** (never accepted, even if the MIME looks benign): executables and
scripts/markup — `exe, bat, cmd, sh, ps1, js, ts, tsx, jsx, html, htm, svg, php,
jar, msi, zip, rar, 7z, dll, app, com, scr, vbs`. Both the **extension** and the
**declared MIME** must be on the allowlist — the client MIME is never trusted on
its own (it is spoofable). Single source of truth: `src/lib/attachments/types.ts`.

## 5. File size / batch limits

- Max **10 MB** per file (`ATTACHMENT_MAX_BYTES`).
- Max **5 files** per upload batch (`ATTACHMENT_MAX_BATCH`).

Errors are friendly and bilingual (`attachments.errors.*`).

## 6. Storage / security model

- Binary files live in the **private** Supabase Storage bucket
  `project-attachments` (never public). Postgres stores **metadata only** — never
  file contents.
- Uploads run **browser-side under the user's session**, so the storage RLS
  policy `can_access_project` gates every write. The service-role key is **never**
  exposed to the browser.
- Deterministic, scoped, collision-free object path
  (`buildAttachmentPath`): `projects/{projectId}/task|subtask/{parentId}/{attachmentId}-{safeName}`.
  `folder[1]='projects'` and `folder[2]=projectId` so the tested
  `can_access_project()` RLS applies. Filenames are sanitized; the attachment
  UUID guarantees uniqueness. The register action **re-derives the expected path
  and rejects anything else** — users cannot choose arbitrary paths.
- Open/download uses a **short-lived signed URL** (10 min), generated
  **server-side only after the access check**. Signed URLs are **never stored**.

## 7. RBAC / RLS behavior

Server-side, deny-by-default (`authorizeAttachmentAction`):

- **list / view / download:** any role with project access (owner/admin/member/viewer).
- **upload:** owner/admin/member (viewers cannot).
- **remove:** owner/admin (any attachment) or the **uploader** (member removing
  their own).

Every action re-checks the caller's session (`getOrgContext`) and scopes reads/
writes to `organization_id` + `project_id`; the parent task/subtask must belong
to the caller's org+project. Cross-org and cross-project access is blocked, and
cross-org rows are invisible (signed-URL/remove lookups are org-scoped, so an
outsider gets `not_found`, never a leak of existence). Table RLS: org members
read; writes go through the service-role server actions.

## 8. UI behavior

Reusable `EntityAttachmentsSection` (`{ projectId, taskId?, subtaskId?,
readonly?, canUpload? }`) is mounted on the Task Execution Map detail panel for
**both** the parent task and each subtask. Compact list, per-file Open, Remove
shown only when `DTO.canRemove` and not `readonly`. Upload control hidden for
viewers / readonly. Keyboard-accessible buttons with aria labels. Images open in
a new tab; PDFs/Word open/download via the signed URL.

## 9. Delete / remove behavior

Soft-delete the metadata (`status='deleted'`, `deleted_at`, `deleted_by`) first —
it is the source of truth for what the user sees — then best-effort remove the
storage object. If object removal fails, the row is marked `orphaned` for a later
cleanup sweep (it is already hidden from users). Every removal is audit-logged.

## 10. i18n labels

Namespace `attachments.*` in `messages/{en,es}.json` (EN/ES key parity enforced
by `message-parity.test.ts`). Labels: title, add, upload, dropzone, empty,
download, open, remove, uploading, removeConfirm, uploadedBy, plus
`attachments.errors.*` (type not allowed, too large, too many files, empty file,
one/both/no parent, forbidden, not authenticated, not found, parent not found,
invalid path, sign failed, unexpected).

## 11. Known limitations

- No thumbnails/previews yet (icon by type only).
- No drag-and-drop dropzone yet (click-to-upload; the label string exists for a
  future dropzone).
- No project-level "all attachments" browser; scoped to a task/subtask.
- `orphaned` cleanup is a status marker; no background sweeper job yet.
- Per-parent cap (e.g., 25) is documented as recommended but not hard-enforced.

## 12. Future enhancements

- Drag-and-drop dropzone + upload progress bars.
- Image thumbnails / inline PDF preview.
- Attachment-aware **evidence provenance** (link a file to a decision/acceptance)
  — only if explicitly approved.
- Document intelligence (OCR / summarization / RAG over attachment contents) is
  **explicitly out of scope** here; file contents are never sent to the LLM,
  never stored in the Product Brain / RAG corpus, and Isabella does not read them.
- Append-only Project Event Graph events (`TaskAttachmentAdded`, etc.) — deferred;
  today only the audit log records the action.

## 13. Regression guardrails

See `regression-test-map.md` → `TASK-SUBTASK-FILE-ATTACHMENTS`. Protected:
exactly-one-parent, private bucket, signed URL only after access check,
org/project/task/subtask scoping, no cross-org/cross-project access, type
allowlist, size/batch limit, safe filename/path generation, no raw storage
secrets exposed, no file contents in DB, no file contents in
`project_event_log`, existing task/subtask behavior preserved, EN/ES parity, no
`project_event_log` update/delete, no `process_nodes`/`process_edges` mutation.

## 14. Manual QA steps

**Task:** open a task → upload a PDF, a Word doc, a PNG → confirm they list →
open/download each → remove one → confirm it disappears → refresh (persists) →
confirm task edit/status/owner still work.

**Subtask:** open a subtask → upload a PDF + an image → list → open/download →
remove → refresh (persists) → confirm subtask status/owner still work.

**Security:** attempt cross-project access (blocked); confirm signed URL only
works when authorized; confirm an `.exe` and an 11 MB file are rejected with
friendly messages.

**Bilingual:** verify EN and ES labels.
