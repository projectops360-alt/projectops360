# Isabella — Root Cause & Constraint Analysis Engine

**Regression ID:** `ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE` · Phase 5 · Task 4 ·
**Status:** protected

## 1. Purpose

Let Isabella explain **"why does this show execution problems, and what evidence
supports that?"** — evidence-backed, uncertainty-aware, **conservative**. It
distinguishes symptom vs constraint vs likely/possible/confirmed cause vs
insufficient evidence. **No recommendations, no action plans, no UI.**

## 2. Architecture

`src/lib/isabella/root-cause/` — a synthesis layer over Task 2 context + Task 3
diagnosis:

```
IsabellaProcessContext (Task 2) + IsabellaDailyProcessDiagnosis (Task 3)
 → signals.ts       extract symptoms + classify constraint signals (evidence only)
 → engine.ts        classify findings (confirmed/likely/possible/insufficient)
 → evidence-chain.ts one chain per finding (symptom→evidence→…→conclusion)
 → confidence.ts    conservative scoring; partial context CAPS confidence
 → engine.ts        assembleRootCauseAnalysis (PURE) + buildIsabellaRootCauseAnalysis (server)
 → formatter.ts     concise bilingual answer
```

Never queries raw project data (import-boundary tested).

## 3. Inputs

`context?` / `dailyDiagnosis?` (reused if provided), else built via
`buildIsabellaProcessContext` (Task 2) + `assembleDailyDiagnosis` (Task 3).
`scope?: {milestoneId?, taskId?}`.

## 4. Output — `IsabellaRootCauseAnalysis`

`status`, `projectId`, `organizationId`, `snapshotAt`, `title`, `summary`,
`analysisScope {source: project|milestone|task|daily_diagnosis}`, `findings[]`,
`constraints[]`, `symptoms[]`, `evidenceChains[]`, `investigationGaps[]`,
`recommendationHandoffHints[]`, `confidence`, `evidenceRefs`, `citations`,
`limitations`, `message?`.

## 5. Constraint taxonomy

`explicit_blocker`, `ownership_gap`, `milestone_assignment_gap`,
`overdue_constraint`, `evidence_gap` are **supported today**. `dependency_constraint`,
`sequencing_gap`, `decision_delay`, `approval_delay`, `external_dependency`,
`capacity_signal`, `stalled_progress` need evidence sources not yet in the context
→ represented as **evidence gaps / unavailable**, never fabricated. Synthetic
`milestone_chain` is never used for dependency constraints (the engine reads no
edges).

## 6. Root-cause classification

- **confirmed_cause** — direct explicit evidence (e.g. an explicit blocker record);
  confidence high.
- **likely_cause** — multiple supporting signals for one constraint (e.g.
  ownership gap + blockers/overdue); confidence medium.
- **possible_cause** — one weak signal (e.g. tasks without milestone; overdue with
  no evidenced delay cause); confidence low/medium.
- **insufficient_evidence** — a symptom (not-started work) with no evidenced cause;
  confidence unknown/low.

The engine never overstates a possible cause as confirmed.

## 7. Evidence chains

Every finding carries a chain: **signal (symptom) → evidence (refs) → inference
(only for likely/possible) → limitation (if incomplete) → conservative conclusion**
whose wording matches the classification.

## 8. Confidence / uncertainty

`verified/high/medium/low/unknown/unavailable`. Direct facts = verified; causal
conclusions high only with strong direct evidence, usually medium; weak single
signals low; missing evidence unknown/unavailable. **Partial context caps at
medium**; denied/unavailable → unavailable. `insufficient_evidence` never exceeds
low.

## 9. Scopes

Project / milestone / task (via `scope`). Unauthorized/unavailable scope → safe
`unauthorized`/`unavailable`/`missing_context` status; never infers entity
existence from unauthorized data.

## 10. Evidence / citations

`evidenceRefs` (opaque `task:/blocker:/milestone:` refs) on every finding;
citations passed from context. No raw `project_event_log`, no raw payloads, no DB
ids beyond safe refs, no layout coordinates, no synthetic `milestone_chain` as
dependency.

## 11. Recommendation boundary

Emits **findings + evidence + investigation gaps + `recommendationHandoffHints`
(`allowedForRecommendationEngine: true`)** — **never** a next-best-action /
recovery / mitigation / prioritized plan. The formatter states recommendations
belong to the next engine.

## 12. RBAC / security

Access enforced by the Task 2 builder (deny-by-default, org+project scope). This
engine never bypasses it and never reads raw data. Read-only.

## 13. Empty / partial / error states

`ready` (full analysis) · `partial` (analysis + capped confidence + limitations) ·
`empty`/`missing_context`/`unauthorized`/`unavailable` — safe message, unavailable
confidence, no findings.

## 14. i18n

Bilingual (EN/ES) text built inline in the formatter (same convention as the
task-report / daily-diagnosis formatters) — no new `messages/*.json` keys.

## 15. Examples

**ES** — "Análisis de causa raíz / Confianza: medium / Resumen: El hallazgo más
notable es causa confirmada: 1 bloqueo explícito (high). … Nota: las
recomendaciones se generarán en el siguiente motor."

**EN** — "Root Cause Analysis / Confidence: medium / Summary: The most notable
finding is confirmed cause: 1 explicit blocker (high). … Note: recommendations
will be generated by the next engine."

## 16. Known limitations

- Only blocker/ownership/milestone/overdue constraints + evidence gaps today;
  dependency/decision/approval/capacity/sequencing need context sources not wired
  yet (disclosed as investigation gaps).
- Not wired into the live Isabella chat / scheduled job (Task 6).

## 17. Future integration — Recommendation Engine (Task 5)

Consumes `recommendationHandoffHints` + findings + evidence to produce prioritized,
evidence-backed next-best-actions.

## 18. Manual verification

Invoke `buildIsabellaRootCauseAnalysis({projectId, locale, scope})` (or
`assembleRootCauseAnalysis(context, diagnosis, scope, locale)` with a fixture) for:
explicit blocker, overdue, no-owner, no-milestone, insufficient evidence, partial
context, missing project, unauthorized. Expect evidence-backed findings, evidence
chains, conservative confidence, explicit limitations, no plan.

Dependent guards: `ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE` ·
`ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL` ·
`ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT` ·
`ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE` ·
`ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA`.
