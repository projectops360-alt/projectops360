# Isabella Process Intelligence — Architecture

**Regression ID:** `ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT`
**Phase:** 5 · Task 1 (foundation) · **Status:** protected (contract only)

## 1. Purpose

Define the rules **before** Isabella becomes "intelligent". Isabella is a project
execution intelligence assistant, not a generic chatbot: every project-specific
claim must be **evidence-backed, RBAC-safe, deterministic when project data is
requested, and honest when evidence is missing**. This task ships only
contracts/types/policies + tests — **no** retrieval, diagnosis, root-cause,
recommendation, or UI, and nothing is wired into the live Isabella flow yet.

This contract exists because of the reported blocker: Isabella answered
*"No tengo una respuesta verificada…"* to a deterministic task-report request.
The deterministic-project-data policy below makes that failure class impossible.

## 2. Architecture overview

`src/lib/isabella/process-intelligence/` (client-safe, pure):

| File | Responsibility |
|---|---|
| `types.ts` | Confidence, intent, claim, evidence, source vocabularies + `IsabellaEvidencePacket` + `IsabellaCitation` |
| `data-sources.ts` | Approved (available/future) + forbidden source allowlists |
| `intent-contract.ts` | Intent categories + `classifyIsabellaIntent` (reuses shipped `detectTaskReportIntent`) + deterministic policy |
| `confidence.ts` | Confidence model + "no low-confidence for verified reports" rule |
| `claim-policy.ts` | Claim → evidence requirements + `canEvidenceSupportClaim` + synthetic-milestone_chain guard |
| `security-contract.ts` | RBAC rules + deny-by-default `resolveIsabellaAccess` |
| `response-policy.ts` | Response MUST/MUST-NOT + `validateIsabellaResponse` |

## 3. Approved data sources

Available now: **Deterministic Project Data** (tasks/subtasks/milestones/Workboard
status/owners/dates/priorities/progress/team-if-authorized), **Living Graph /
Execution Map** (hierarchy-safe nodes/edges, scope, stale/fresh), **Milestone
Process Flow** (transitions/segments/delay/rework/bottleneck/health), **Risk /
Decision / Approval / Blocker**, **Project Memory / Status Reports**.

Future placeholders (wired later): **Project Event Graph** (approved event
*summaries* only, never raw rows) and **Observability / Realtime State**
(stale/fresh/degraded only).

Every factual claim traces to one of these **via approved server-side retrieval**.

## 4. Forbidden data sources

Raw `project_event_log` rows in UI/LLM; raw Supabase realtime payloads; raw DB
payloads to the LLM; unauthorized tasks/projects/orgs; `process_nodes`/
`process_edges` as mutable truth; unscoped project-wide reads; team details out of
scope; **synthetic `milestone_chain` as a dependency**; evidence/event nodes as
default task children; UI-only visual artifacts as truth.

## 5. Intent categories

`deterministic_project_report` · `project_status_question` · `process_diagnosis`
· `root_cause_analysis` · `recommendation_request` · `navigation_or_how_to` ·
`unsupported_or_missing_context`. Each declares examples (incl. the exact reported
prompt + Spanish/mixed), behavior, and an `implemented` flag. Diagnosis /
root-cause / recommendation are **placeholders** — their engines are NOT built
here.

## 6. Deterministic project-data policy

If the user asks for existing project data ProjectOps360° can retrieve
deterministically (task reports, milestone lists, blocked/overdue tasks, tasks by
owner/priority, subtasks, risks/decisions/approvals by status), Isabella MUST use
deterministic retrieval — not generic LLM reasoning:

1. Retrieval is server-side / approved selectors. 2. RBAC/org+project enforced.
3. Sorting/filtering deterministic. 4. The LLM may format/explain but never
invents or sorts raw data. 5. Marked **verified**. 6. No low-confidence label on
success. 7. No data → say so. 8. No project → ask for context. 9. Unauthorized →
deny safely. 10. Retrieval failure → app-data error, not "I don't know".

`requiresDeterministicRetrieval("deterministic_project_report") === true`.

## 7. Claim types & 8. Evidence requirements

`factual_project_data` (verified task/milestone ref) · `status_summary` ·
`dependency_claim` (**real** edge/record — never synthetic milestone_chain) ·
`blocker_claim` · `risk_claim` · `root_cause_claim` (≥2 signals + confidence,
labeled inference; confirmed/likely/possible) · `recommendation_claim` (evidence,
labeled) · `assumption_or_inference` (labeled). `canEvidenceSupportClaim` enforces
type + minimum confidence + per-packet `disallowedClaims`. See
[`isabella-evidence-contract.md`](isabella-evidence-contract.md).

## 9. Evidence packet shape

`IsabellaEvidencePacket` — pre-sanitized, LLM-safe: `evidenceId`, `evidenceType`,
`sourceKind`, `sourceId`, `projectId`, `organizationId`, `title`, `summary`,
`citationLabel`, `citationRef?`, `occurredAt?`, `updatedAt?`, `confidence`,
`visibility`, `claimSupport?`, `allowedClaims?`, `disallowedClaims?`,
`limitations?`. **No raw payloads.**

## 10. Citation / reference policy

`IsabellaCitation`: `sourceLabel`, `entityType`, `entityTitle`, `safeRef?`
(display-safe id/path only when UI convention allows), `occurredAt?`, `confidence`.
Never raw DB ids or JSON payloads.

## 11. Confidence / uncertainty model

`verified` (deterministic retrieval) · `high` (direct status summary) · `medium`
(multi-signal inference) · `low` (weak inference, labeled) · `unknown`
(insufficient) · `unavailable` (no context / failure / unauthorized).
`low`/`unknown` are "low-confidence labels" — **never** on a successful
deterministic report.

## 12. RBAC / security rules

Server-side authorization from the trusted session; org+project scope; no
cross-tenant leak; denials never disclose existence; pre-sanitized evidence; no
raw event log / realtime payload; ask when unclear; **read-only** (never mutates
canonical truth / `project_event_log` / `process_nodes` / `process_edges`).
`resolveIsabellaAccess` is deny-by-default.

## 13. Response rules

Answer in the user's language; state scope; include sort/filter + counts for
reports; cite evidence; distinguish facts from assumptions; never hallucinate
tasks/blockers/dependencies; never a low-confidence label for verified data; never
vague PM advice when a report was asked. `validateIsabellaResponse` encodes these.

## 14. Future task integration

- **Task 2 — Context & Evidence Retrieval Layer:** implements retrieval that
  produces `IsabellaEvidencePacket`s, enforces `resolveIsabellaAccess`, and does
  deterministic project-data retrieval per the intent contract.
- **Task 3 — Daily Process Diagnosis Engine:** consumes packets; cites evidence + uncertainty.
- **Task 4 — Root Cause & Constraint Analysis:** consumes packets + graph/flow signals; symptoms ≠ causes.
- **Task 5 — Recommendation Engine:** consumes diagnosis/root-cause evidence; prioritized.
- **Task 6 — UI / Realtime Integration & Regression.**

## 15. Known limitations

- Contract only — not wired into `askLivingGuideAction` yet (Task 2).
- `classifyIsabellaIntent` reuses the **conservative** shipped
  `detectTaskReportIntent`; broader report phrasings without a report-noun or
  "all/todas" cue (e.g. *"show tasks by priority"*, *"dame las tareas de Phase
  5"*) are recognized as examples but not yet auto-classified — recall is widened
  in Task 2.
- Non-report reasoning classification is keyword-based and best-effort until the
  engines land.

Dependent guard: [`ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA`](regression-test-map.md)
(the already-shipped deterministic report this policy generalizes).
