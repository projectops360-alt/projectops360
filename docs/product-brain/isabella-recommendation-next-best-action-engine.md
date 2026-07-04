# Isabella — Recommendation & Next-Best-Action Engine

**Regression ID:** `ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE` · Phase 5 · Task 5 ·
**Status:** protected

## 1. Purpose

Let Isabella answer **"given the diagnosis and root-cause evidence, what should
the PM focus on next, why, what impact is expected, and what evidence supports
it?"** — ranked, evidence-backed, conservative, uncertainty-aware, and **advisory
only**. Every recommendation requires human approval and is **never** executed by
this engine. No generic PM advice. This is the recommendation layer, **not** the
UI integration (Task 6) and **not** an automation/execution engine.

## 2. Architecture

`src/lib/isabella/recommendations/` — a synthesis layer over Tasks 2/3/4:

```
IsabellaProcessContext (Task 2)
 + IsabellaDailyProcessDiagnosis (Task 3)
 + IsabellaRootCauseAnalysis (Task 4)
 → candidates.ts  generate candidates from findings + investigation gaps (consumes handoff hints)
 → evidence.ts    validateRecommendationEvidence — drop anything not evidence-backed
 → dedupe.ts      merge same-action candidates (top examples + count), preserve evidenceRefs
 → scoring.ts     derivePriority + deterministic score + rankRecommendations
 → engine.ts      assembleRecommendationPlan (PURE) + buildIsabellaRecommendationPlan (server)
 → formatter.ts   concise bilingual answer (advisory language)
```

Never queries raw project data, never mutates (import-boundary tested).

## 3. Inputs

`context?` / `dailyDiagnosis?` / `rootCauseAnalysis?` (reused if provided), else
built via `buildIsabellaProcessContext` (Task 2) → `assembleDailyDiagnosis`
(Task 3) → `assembleRootCauseAnalysis` (Task 4). `scope?: {milestoneId?, taskId?}`.

## 4. Output — `IsabellaRecommendationPlan`

`status`, `projectId`, `organizationId`, `snapshotAt`, `title`, `summary`,
`recommendations[]`, `recommendationGroups[]`, `decisionSupport
{topPriorityReason?, tradeoffs?, blockedByMissingEvidence?}`, `evidenceRefs`,
`citations`, `limitations`, `message?`.

Each **`IsabellaRecommendation`**: `id`, `title`, `category`, `priority`,
`urgency`, `effort`, `expectedImpact`, `confidence`, `rationale`,
`expectedOutcome`, `affectedEntities[]`, `groupedCount`, `sourceFindingIds`,
`sourceConstraintIds`, `sourceEvidenceChainIds`, `evidenceRefs`, `citations?`,
`preconditions?`, `missingEvidence?`, `humanApprovalRequired: true`,
`executableNow: false`.

## 5. Recommendation categories

Supported today: `resolve_explicit_blocker`, `assign_owner`, `assign_milestone`,
`recover_overdue_work`, `investigate_evidence_gap`, `stabilize_milestone`,
`clarify_scope`, `reduce_execution_uncertainty`. `validate_dependency` is emitted
**only** when a finding carries REAL dependency evidence — a synthetic
`milestone_chain` never triggers it. Unsupported/future constraints
(sequencing/decision/approval/external/capacity) map to `null` and are **never**
fabricated.

## 6. Candidate generation

`generateRecommendationCandidates(analysis, diagnosis, language)`:
`mapFindingToRecommendationCategory(finding)` → one candidate per supported
finding; each investigation gap → an `investigate_evidence_gap` candidate; ≥2
converging attention findings → a `stabilize_milestone` candidate.
**`recommendationHandoffHints` are consumed**: when present, only findings whose
id was handed off are eligible.

## 7. Priority / urgency / effort / impact scoring

`derivePriority(finding)` — critical requires blocked severity + strong evidence
(or a confirmed cause); high requires a direct blocker/confirmed cause/at-risk +
strong; likely/possible → medium; cleanup → low. A low-confidence possible cause
**can never** become critical. `urgency`/`effort`/`expectedImpact` come from the
category profile (`CATEGORY_PROFILE`). `scoreRecommendationCandidate` is a
deterministic weighted sum (priority ≫ severity ≫ impact ≫ urgency ≫ confidence,
minus effort); `rankRecommendations` sorts by score then category order then
affected-entity title then id — **stable and replay-deterministic**. Partial
context caps confidence at `medium` (`capRecommendationConfidence`).

## 8. Evidence / citations

Every recommendation carries `evidenceRefs` + `sourceFindingIds` +
`sourceEvidenceChainIds` (when a finding backs it) + `confidence`.
`validateRecommendationEvidence` **drops** any candidate with no evidence, no
source, and no declared gap (an `investigate_evidence_gap` is valid because its
whole purpose is confirming a missing source). Never cites raw
`project_event_log` rows, raw Supabase payloads, unsafe DB ids, layout
coordinates, or a synthetic `milestone_chain` as dependency evidence. Citations
are passed through from the Task 4 analysis.

## 9. Deduplication / grouping

`dedupeRecommendations` merges candidates sharing a `dedupeKey` (one action, many
tasks → "assign owners to N tasks" with top examples + `groupedCount`), preserving
merged `evidenceRefs` + source ids and keeping the strongest priority/urgency/
confidence. `groupRecommendations` buckets the final list into ordered
priority groups (critical → low).

## 10. Human approval / no auto-execution

Every recommendation is `humanApprovalRequired: true` + `executableNow: false`.
This engine **never** executes, auto-creates/edits/assigns/moves/closes anything.
Advisory verbs only ("Review", "Assign or confirm", "Validate", "Investigate",
"Clarify", "Prioritize review of"). The formatter states recommendations were
**not executed automatically**, never says "I changed/assigned/moved/fixed", and
never guarantees an outcome ("expected impact", never "guaranteed result").

## 11. RBAC / security

Access enforced by the Task 2 builder (deny-by-default, org+project scope). This
engine never bypasses it and never reads raw data. Read-only, no mutation.

## 12. Empty / partial / error states

`ready` (ranked plan) · `partial` (plan + capped confidence + limitations) ·
`empty` (ready/partial context but no evidence-backed candidate → "no
recommendation can be generated", **no generic advice**) ·
`missing_context`/`unauthorized`/`unavailable` — safe message, no recommendations.

## 13. i18n

Bilingual (EN/ES) text built inline in the formatter (same convention as the
task-report / daily-diagnosis / root-cause formatters) — no new
`messages/*.json` keys. Labels: Next-Best-Action Recommendations · Priority ·
Urgency · Effort · Expected impact · Rationale · Expected outcome · Evidence ·
Confidence · Preconditions · Missing evidence · Requires human approval · Not
executed automatically · Critical/High/Medium/Low · Now/Today/This week/Later.

## 14. Examples

**ES** — "Recomendaciones de siguiente mejor acción / Resumen: 5
recomendación(es). Foco principal: desbloquear ejecución, mejorar accountability
… / 1. Crítica — Revisar y resolver el bloqueo activo en … / Requiere aprobación
humana: sí / Nota: estas recomendaciones no se ejecutaron automáticamente."

**EN** — "Next-Best-Action Recommendations / Summary: 5 recommendation(s). Top
focus: unblock execution, improve accountability … / 1. Critical — Review and
resolve the active blocker on … / Requires human approval: yes / Note: these
recommendations were not executed automatically."

## 15. Known limitations

- Only categories backed by current evidence (blocker/ownership/milestone/overdue
  + evidence gaps + convergence) are produced; dependency/decision/approval/
  capacity/sequencing recommendations need sources not wired yet (surfaced as
  `investigate_evidence_gap`).
- Not wired into the live Isabella chat / scheduled job (Task 6).

## 16. Future integration — Isabella UI (Task 6)

Surfaces the ranked plan in Isabella's answer + realtime context, with per-
recommendation evidence disclosure and an approval-gated "apply" affordance
(execution still lives elsewhere, never in this engine).

## 17. Future integration — action/execution workflows

An "apply" action would call the existing approved server mutations under RBAC +
human approval; this engine only advises and hands off `humanApprovalRequired`
recommendations. It never becomes an execution path.

## 18. Manual verification

Invoke `buildIsabellaRecommendationPlan({projectId, locale, scope})` (or
`assembleRecommendationPlan(context, rootCauseAnalysis, diagnosis, language)` with
a fixture) for: explicit blocker, overdue, no-owner, no-milestone, evidence-gaps
only, partial context, missing project, unauthorized. Expect ranked,
evidence-backed recommendations, deterministic order, conservative confidence,
explicit limitations, human-approval requirement, and **no** generic advice / auto
execution.

Dependent guards: `ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE` ·
`ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE` ·
`ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL` ·
`ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT`.
