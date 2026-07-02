# Backfill Operations & Administrator Guide (Phase 2)

> The **Backfill Administration Console** (`/admin/backfill`) is the only approved mechanism for running
> the [Historical Backfill Service](historical-backfill-service.md). Manual SQL is never the operational
> path. See the [Product Constitution](00-product-constitution.md).

## Access (security model)
Gated **server-side**: only org **owner/admin** roles, or a **platform-admin allowlist**
(`BACKFILL_ADMIN_EMAILS`, comma-separated), may reach the console or call `runBackfillAction`.
Everyone else (PMO / PM / member / viewer) gets a **404** — no nav leak, no data. The gate lives in
`src/lib/events/backfill-access.ts` (`canRunBackfill`).

## Administrator guide (how to run safely)
1. Open `/admin/backfill`.
2. Choose **scope**: a single project or the entire organization.
3. Enter a **reason** (required to execute; recorded in the immutable audit event).
4. Click **Dry run (preview)** — computes counts, quality and replay readiness **without writing**.
5. Review the report. When satisfied, click **Execute** (enabled only after a dry run of the same
   scope + a reason) and confirm. Execution is **idempotent** — re-running never duplicates events.
6. **Download report** (JSON) for the record.

## Reports
- **Quality:** total events, explicit % (owner timestamp, ≥0.85) vs inferred %, average / lowest /
  highest confidence, duplicate suppression, unsupported sources.
- **Replay readiness (0–100 / ready·partial·insufficient):** rewards task + milestone history and
  strong average confidence; flags weak/missing history and low confidence with explicit reasons.
- **Organizational memory:** projects processed, total events, average confidence, top contributors,
  weak-evidence projects. *(Organizational DNA is future — structure only, not implemented.)*

## Audit
Each executed project emits an **immutable `BackfillCompleted` event** into `project_event_log` with
`actor_id` (the admin), `payload.reason`, `execution_id`, and per-batch counts. This is the durable,
tamper-evident audit trail (the event log is append-only). Dry runs write nothing.

## Recovery guide
- **Idempotent re-run:** simply run the console again — existing events are skipped (dedup), only
  missing ones are created. This is the recovery path for an interrupted run.
- **Failed records:** counted in `eventsFailed` + `errorSummary`; re-running retries them (they are not
  written until valid). A single bad record never rolls back the batch.
- **Unsupported owners** (e.g. estrato-C tables absent): reported as `unsupportedSources`, skipped
  safely — not an error.

## Troubleshooting
| Symptom | Cause / action |
|---|---|
| 404 on `/admin/backfill` | Not owner/admin and not allowlisted → add email to `BACKFILL_ADMIN_EMAILS` or use an admin account. |
| "Dry run required before executing" | Run a dry run of the same scope first (safety gate). |
| Many `eventsSkipped` on re-run | Expected — idempotent dedup suppressing already-recorded events. |
| Source in `unsupportedSources` | That owner table/column is not present (e.g. estrato C) — nothing to backfill there yet. |
| Low replay score | Weak/missing task or milestone history, or low confidence — the reasons list explains. |

## Living Graph & Isabella
After execution the Living Graph can consume the newly available historical events on next load (no
automatic replay is built — compatibility only). Isabella may explain coverage, confidence, missing
evidence and replay readiness, but must **never** claim history is complete unless the data supports it,
and must treat backfilled events as synthetic (reduced confidence), not live-captured facts.

## Performance & limits (MVP)
Runs are **synchronous per request** (fine for a project or a small org). For very large organizations
(thousands of projects / millions of events) chunked/background execution, cancellation and resume are
**future work** — the current console processes up to 500 projects per org run.
