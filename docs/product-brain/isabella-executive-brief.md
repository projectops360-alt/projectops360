# Isabella Executive Brief (REG-023 / ISABELLA-EXECUTIVE-BRIEF)

**Status:** implemented (no flag — it is a routing FIX, not a new capability; the data engines it
consumes were already approved). **Classification:** P0 capability regression · AI orchestration /
tool-routing / project-context propagation defect.

---

## 1. Root-cause report

**Reported (2026-07-09, voice + text):** *"necesito un resumen del proyecto, ¿cuáles son los
posibles riesgos que tengo hoy?"* → *"solo puedo generar reportes sobre las tareas, y aún no tengo
la información completa…"*

**Confirmed cause (code + prod `ai_runs`):** a routing defect, not a capability gap.

1. `parseProjectDataQuery` treats the question as a data query ("resumen" = report cue) and
   resolves the token **"riesgos" → entity `risk`** (the entity catalog registers FUTURE aliases
   for risk/milestone/decision/approval/subtask).
2. `askLivingGuideAction` executed the deterministic path first; `runTaskQuery` supports **only
   `entity === "task"`** and returned the **hardcoded** `unsupported_entity` message
   ("Por ahora solo puedo generar reportes de tareas…", `query-engine/task-adapter.ts`).
3. Because that answer RETURNED, everything downstream that could actually answer — Process
   Intelligence (daily diagnosis), the **REG-013 briefing engine** (which computes exactly what was
   asked and already renders it as the proactive briefing card), and RAG — **never ran**. Voice
   users hit it hardest because the voice surface has no briefing card.
4. There was also **no multi-intent planning**: "summary + today's risks" had no combined goal.

Hypotheses ruled out: project context DOES reach the pipeline (projectId propagated and
re-stamped); identity is session-stamped (not lost); `guide_coaching` HAS data tools; RAG was not
substituting operational data (it never got the chance); permissions were not the failure.

## 2. Flow — before vs after

```
BEFORE                                       AFTER
question                                     question
  ↓                                            ↓
parse → entity=risk plan                     executive-intent detector (bilingual, multi-goal)
  ↓                                            ├─ goals detected + projectId →
task adapter: entity ≠ task                  │    REG-013 briefing engine + risks register
  ↓                                          │    → grounded executive answer (audited)
"solo puedo generar reportes de tareas"      └─ no goals → parse
  ✗ (PI / briefing / RAG never ran)                ├─ entity=task → tool loop / task adapter (unchanged)
                                                   ├─ other entity → falls through (no dead end)
                                                   ↓
                                                 PI wiring → provenance → RAG (unchanged)
```

The required architecture maps onto existing layers: **Runtime Project Context Resolver** =
`getOrgContext` + re-stamp in `askLivingGuideAction` + REG-013 org/project gate (client context is
hints only, never authorization) · **Intent+Goal Planner** = `detectExecutiveIntents` (multi-goal)
· **Tool Selection/Execution** = executive-brief service + tool registry · **Evidence
Aggregation/Synthesis** = `formatExecutiveBriefAnswer` (deterministic; the LLM does not summarize
counts) · **Grounded Response** = tier `verified`, evidence-base line.

## 3. Components

| Piece | File | Role |
|---|---|---|
| Intent planner | `src/lib/isabella/executive-brief/intent.ts` | bilingual, cue-based, multi-goal (`project_summary`, `risk_outlook`); definitions/how-to, task reports and pure recommendation asks are explicit NON-goals |
| Data service | `executive-brief/service.ts` | reuses `getProjectBriefing` (REG-013: session identity, org+project gate, role scope, dataGaps) + org+project-scoped risks detail |
| Formatter | `executive-brief/formatter.ts` | deterministic executive answer; `registeredRisks` ≠ `detectedRiskSignals` ≠ `dataGaps`; recommended priority from the strongest signal |
| Gateway | `executive-brief/gateway.ts` | first routing stop in `askLivingGuideAction`; null on no-goal / no-project / failure (pipeline unchanged); honest permission denial; `ai_runs` observability |
| Composite tools | `tools/executive-executors.ts` + registry | `get_project_executive_brief`, `get_project_risk_outlook` — same service, for the LLM tool loop |
| Routing fix | `components/living-guide/actions.ts` | executive gateway first; task adapter only for `entity === "task"`; other entities fall through |

## 4. Tool inventory (requested → provided by)

`getProjectOverview`/`getProjectHealth` → `get_project_executive_brief` (REG-013 engine) ·
`getProjectTasks`/`getBlockedTasks`/`getOverdueTasks`/`getUnassignedTasks`/`getTasksWithoutEstimates`
→ existing `query_tasks` filters (blocked/overdue/without_owner) + briefing capacity
(missing-estimate) · `getProjectRisks`/`getProjectRiskOutlook` → `get_project_risk_outlook` ·
`getProjectMilestones`/`getMilestonesAtRisk` → briefing overview/execution (`milestoneHealth`,
`atRiskMilestones`) · `getProjectDependencies`/`getCriticalPath` → briefing dependencies input +
Living Graph (UI); not yet a standalone tool (**gap, low priority**) · `getBudgetStatus` → **gap**
(budget tables exist; no read tool yet) · `getOpenDecisions` → briefing memory
(`recentDecisions`/`unresolvedActions`) · `getTeamCapacity` → briefing capacity (+ Resource
Capacity module for depth) · `getRecentProjectChanges` → briefing memory recent items ·
`getProjectAttentionItems` → briefing `attention` · `getProjectExecutiveBrief` /
`getProjectRiskOutlook` → **new composite tools**.

## 5. Result semantics (binding)

- **No records:** "No hay riesgos formalmente registrados en este proyecto." — never "no puedo".
- **Incomplete data:** named `dataGaps` ("no hay hitos definidos", "no hay trabajo activo…").
- **Unreadable source:** "No pude leer el registro de riesgos…" — never invented.
- **Permission denied:** explicit "No tienes acceso a los datos de ese proyecto…".
- **Tool/pipeline failure:** gateway returns null → next layers try; never a generic dead end.
- **Registered vs inferred:** `registeredRisks` (records) / `detectedRiskSignals`
  (record-backed operational counts) / exposure (deterministic rule) — never merged.

## 6. Security & audit

Identity is never client-claimed (`askLivingGuideAction` re-stamps from the session); project
access re-validated by the REG-013 gate; risks query is org+project scoped (defense in depth);
read-only end to end (no mutation path); no SQL from any model — the LLM only names registry
tools. Observability: one compact `ai_runs` row per run (`model: isabella-executive-brief`) with
detectedGoals, selectedTools, status, latency, record counts, gaps, screen context, locale — no
free text, no secrets.

## 7. Voice

No parallel logic: Isabella Voice → Voice Context Bridge → `askLivingGuideAction` → this same
gateway. Text and voice produce the same grounded answer (voice then speech-sanitizes it,
ISABELLA-VOICE-REALTIME-BRIDGE).

## 8. Tests

`executive-brief/__tests__/intent.test.ts` (approved question set EN/ES, multi-intent, non-goals) ·
`formatter.test.ts` (executive shape, forbidden phrases, empty/gap/unreadable semantics, EN/ES) ·
`gateway.test.ts` (routing boundary, permission denial, fall-through, audit, no-crash) ·
`components/living-guide/__tests__/actions-executive-routing.test.ts` (**the REG-023 regression
test**: P0 question end-to-end, non-task plans no longer dead-end, no-project preserved, read-only)
· `tools/__tests__/executive-tools-registry.test.ts` (composite tools always registered; separation
contract; tenant isolation mapping).

## 9. Known gaps (accepted, documented)

- Budget and critical-path standalone tools not yet registered (sources exist; add when asked-for
  questions appear in logs).
- Registered-risk detail shows top 10 by severity (full register lives in the Risks UI).
- Pure recommendation asks stay with the PI engine (flag-gated) by design — the brief does not
  replace the accepted recommendation engine.
