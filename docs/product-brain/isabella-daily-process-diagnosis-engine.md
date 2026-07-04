# Isabella — Daily Process Diagnosis Engine

**Regression ID:** `ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE` · Phase 5 · Task 3 ·
**Status:** protected

## 1. Purpose

Give Isabella an evidence-backed **daily execution health briefing**: *"What is
happening in this project today, what needs attention, and what evidence supports
that?"* — SYMPTOMS + attention signals only. **No root causes, no recommendations,
no UI.**

## 2. Architecture

`src/lib/isabella/daily-diagnosis/` — a **synthesis layer over the Task 2 context**:

```
IsabellaProcessContext (Task 2)
 → metrics.ts    computeDiagnosisSignals (deterministic counts)
 → health.ts     evaluateDailyHealth (conservative, evidence-derived)
 → sections.ts   progress / blockers / attention / milestoneFocus / gaps / todayFocus
 → evidence.ts   collectDiagnosisEvidence + buildNextEngineHints (handoff to Task 4/5)
 → engine.ts     assembleDailyDiagnosis (PURE) + buildIsabellaDailyProcessDiagnosis (server)
 → formatter.ts  formatDailyDiagnosisForIsabella (bilingual answer text)
```

The engine consumes the context **only** — it never queries raw project data
(import-boundary tested: no DB client, no `.from(`, no `project_event_log`/
`process_nodes`/`process_edges`, no mutation).

## 3. Inputs

`IsabellaProcessContext` (status, `taskContext`, `milestoneContext`,
`processSignals`, `evidencePackets`, `citations`, `limitations`). If not provided,
the server entry calls the approved `buildIsabellaProcessContext`
(project/tasks/milestones/blockers).

## 4. Output — `IsabellaDailyProcessDiagnosis`

`status`, `projectId`, `organizationId`, `snapshotAt`, `title`, `executiveSummary`,
`overallHealth {level, confidence, rationale, evidenceRefs}`, `sections {progress,
blockers, risksOrAttention, milestoneFocus, executionGaps, todayFocus}`, `metrics`,
`evidenceRefs`, `citations`, `limitations`, `message?`, `nextEngineHints?`.

## 5. Health scoring (conservative, evidence-derived — never LLM-invented)

`unknown` (missing/unauthorized/unavailable/empty or no task data) · `blocked`
(≥ `DIAGNOSIS_BLOCKED_THRESHOLD`=3 blocked) · `at_risk` (overdue, any blocker, or
≥2 attention signals) · `watch` (some attention signal or partial context) ·
`healthy` (progressing, no blockers/overdue/gaps). Rationale + `evidenceRefs`
always included; confidence = `verified` (ready) / `medium` (partial) /
`unavailable` (denied).

## 6. Diagnosis sections

- **Progress** — done/in-progress/not-started counts (deterministic).
- **Blockers** — from `processSignals` blocker packets only; discloses that
  root-cause analysis is the next engine.
- **Attention signals** — overdue / blocked / without milestone / without owner;
  labeled *attention signals*, not formal risks (no risk evidence source).
- **Milestone focus** — milestones with blocked/overdue/many-not-started tasks
  (aggregated from task evidence; never from synthetic `milestone_chain`).
- **Execution gaps** — unassigned / without-milestone + unavailable sources.
- **Today's focus** — FOCUS AREAS ("review blocked tasks", "assign owners"), never
  a prioritized plan.

## 7. Evidence / citations

Every factual claim carries `evidenceRefs` from the context packets (opaque refs
like `task:<id>` / `blocker:<id>` / `milestone:<id>`); citations passed through
from the context. No raw `project_event_log`, no raw payloads, no DB ids beyond the
safe refs, no layout coordinates, no synthetic `milestone_chain` as dependency.

## 8. Uncertainty rules

Missing context → `missing_context`; unauthorized → `unauthorized`; empty →
`empty`; partial sources → `partial` + limitations ("Risk evidence is not available
in this context", "Advanced delay/rework/bottleneck findings are not available
yet"). Gaps are never filled with generic PM advice.

## 9. Root-cause boundary

Identifies symptoms + attention signals and emits `nextEngineHints
{engine:"root_cause"}` — **never** "the root cause is…", no causal chain, no
constraint propagation. (Task 4.)

## 10. Recommendation boundary

Emits **focus areas** + `nextEngineHints {engine:"recommendation"}` — **never** a
prioritized/mitigation/recovery/next-best-action plan. (Task 5.)

## 11. RBAC / security

Access is enforced by the Task 2 context builder (deny-by-default, org+project
scope). This engine never bypasses it and never reads raw data. Read-only.

## 12. Empty / partial / error states

`ready` (full diagnosis) · `partial` (diagnosis + limitations) · `empty`/`unknown`
· `missing_context` · `unauthorized` · `unavailable` — each with a user-safe
message and unknown health where data is insufficient.

## 13. i18n

The formatter builds bilingual (EN/ES) text inline (same convention as the
task-report / query-engine formatters) — no new `messages/*.json` keys required.

## 14. Examples

**ES** — "Diagnóstico diario del proyecto / Estado: Bloqueado / Resumen: El
proyecto está en estado bloqueado: 3 tareas bloqueadas, 2 sin responsable. …
Fuente: datos verificados del proyecto actual. Limitaciones: …"

**EN** — "Daily Project Diagnosis / Status: Watch / Summary: The project is watch:
2 tasks blocked, 3 without owner, 1 overdue. … Source: verified project data."

## 15. Known limitations

- Advanced process findings (delay/rework/bottleneck) and formal risk/decision/
  approval evidence are not in the context yet → disclosed as limitations.
- Not wired into the live Isabella chat / a scheduled daily job yet (Task 6).
- Per-milestone overdue uses the context snapshot date.

## 16–17. Future integration

- **Task 4 — Root Cause**: consumes `nextEngineHints{root_cause}` + evidence.
- **Task 5 — Recommendation**: consumes diagnosis + `nextEngineHints{recommendation}`.

## 18. Manual verification

Invoke `buildIsabellaDailyProcessDiagnosis({projectId, locale})` (or
`assembleDailyDiagnosis(context, locale)` with a fixture) for: clean project,
blocked tasks, overdue tasks, no-owner, no-milestone, partial sources, no project
(→ missing_context), unauthorized. Expect evidence-backed output, no invented
facts, no root cause, no plan, explicit limitations, verified-data labeling.

Dependent guards: `ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT` ·
`ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL` ·
`ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE` ·
`ISABELLA-TOOL-USE-RUNTIME-GATEWAY` · `ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA`.
