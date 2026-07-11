# CAP-045 — Process Mining Layer · Canonical PM Ontology & Lifecycle: Risk-to-Resolution

> **Frozen semantic contract** for the pilot domain of the Living Graph Process Mining Layer:
> the canonical **Risk-to-Resolution** ontology, lifecycle, event vocabulary, invariants, and
> analytical model, from **Etapa 2 — PM Process Ontology & Event Vocabulary (July 2026)**.
> This is a **semantic contract only** — it designs no tables, no algorithms, no UI, no
> implementation. Its approval does **not** authorize code or production changes; it
> authorizes advancing to the **event audit (plan Phase 2 — Event Architecture)**.
>
> **Plan traceability:** `ProjectOps360_Import_Plan_v1` · **Phase 1 · Task P1-T2** — "Define
> canonical PM ontology and lifecycle" (consolidates original Stage S2-T1). Depends on the
> approved [foundation baseline](CAP-045-process-mining-layer-foundation-baseline.md)
> (CAP-045 · [PD-015](../30-product-decision-log.md), Approved 2026-07-10) — pilot domain per
> its decision **D-06** (Risk-to-Resolution first).
> **Source of the frozen content:** *ProjectOps360 Process Mining Layer — Etapa 2, PM Process
> Ontology & Event Vocabulary, julio 2026* (Product Owner research output).
>
> **Capability:** CAP-045 ([registry](../05-capability-registry.md)) · **Decision:**
> [PD-016](../30-product-decision-log.md) · Deliverables **D2.1–D2.7** (§2–§11).

---

## Approval block

| Field | Value |
|---|---|
| **Approval status** | ⏳ **Pending Product Owner approval** |
| **Approver** | Efrain Prada — Product Owner (pending) |
| **Approval date** | — |
| **Effect** | This ontology is the semantic source of truth for the Risk-to-Resolution pilot (PO-01: concepts precede tables). Phase 2 (Event Architecture & event audit) **may not begin** until it is Approved. Changes require a new Product Owner decision in the [Product Decision Log](../30-product-decision-log.md). |

---

## 1. Central decision (frozen)

Risk-to-Resolution is modeled as an **object-centric process** connected to the Living Graph.
The **risk is the focal object**, but one event may relate to project, milestone, task,
decision, blocker, response, evidence, and actor — without duplication.

Two cardinal distinctions:

- **State ≠ event.** A state expresses the current condition ("Open"); an event expresses an
  immutable historical fact ("risk_assessed"). Historical events are never rewritten.
- **Risk ≠ issue.** A risk is unmaterialized uncertainty; an issue is a condition that already
  occurred. **Materialization creates a traceable semantic transition — it never deletes the
  risk.**

## 2. D2.1 — Risk domain ontology

### 2.1 Ontological principles (PO-01 … PO-10, frozen)

| ID | Principle |
|----|-----------|
| **PO-01** | Concepts precede tables — semantics are never defined by the current schema. |
| **PO-02** | State and event are different — the historical event is never rewritten. |
| **PO-03** | Evidence precedes the finding — without a reliable event, no transition is declared. |
| **PO-04** | Object-centric by design — one event affects several objects without duplication. |
| **PO-05** | Risk and issue are not synonyms. |
| **PO-06** | Exceptions are classifiable — non-compliance ≠ authorized exception ≠ data gap. |
| **PO-07** | Context governs conformance — project type, methodology, severity, governance profile. |
| **PO-08** | Isabella interprets governed results — she generates no events, causes, or metrics without tools and evidence. |
| **PO-09** | End-to-end traceability — finding → events → objects → evidence → action. |
| **PO-10** | Privacy by default — processes, not individual rankings. |

### 2.2 Canonical definition of risk (canonical Spanish, verbatim)

> "Un riesgo de proyecto es una condición o evento incierto que, si ocurre, puede afectar uno
> o más objetivos del proyecto. Puede representar amenaza u oportunidad y debe conservar
> trazabilidad sobre su origen, exposición, ownership, respuesta, monitoreo, materialización y
> cierre."

*(English rendering, non-canonical: a project risk is an uncertain condition or event that,
if it occurs, may affect one or more project objectives. It may represent a threat or an
opportunity, and it must preserve traceability over its origin, exposure, ownership, response,
monitoring, materialization, and closure.)*

What has already occurred is classified as **issue / blocker / incident**, preserving its
relationship to the risk that anticipated it.

### 2.3 Focal object and related objects

| Object | Ontological role |
|---|---|
| **Risk** | Focal — managed uncertainty and current condition |
| Project | Mandatory context (scope, governance, authorization) |
| Milestone | Impacted or protected (exposure and temporal consequence) |
| Task / Action | Response (mitigation, prevention, contingency, exploitation, follow-up) |
| Decision | Control (authorizes strategy, acceptance, escalation) |
| Issue / Blocker | Materialization |
| Requirement / Deliverable | Affected object (scope, quality, acceptance) |
| Budget Item | Financial impact (reserve, response cost, loss) |
| Evidence | Proof (assessment, execution, impact, closure) |
| Actor / Role | Responsibility (who executed, approved, verified) |
| Communication | Context (meetings/messages; never a substitute for canonical events) |
| Process Model | Reference (expected activities, rules, target times) |

### 2.4 Process boundary

- **Starts formally** with a `risk_id` + the event `risk_registered`. A prior signal
  (`risk_signal_detected`) may exist but does **not** start the case.
- **Ends** in a valid terminal state with its event: `risk_closed`,
  `risk_materialized_transferred`, `risk_retired`, `risk_invalidated`.
- **"Expired" is NOT automatically terminal:** the real end of the exposure window and the
  residual risk must be verified.

### 2.5 Taxonomy (initial vocabulary — NOT definitive physical enumerations)

| Dimension | Values |
|---|---|
| Nature | Threat · Opportunity |
| Source | Internal · External |
| Knowledge | Known · Emerging · Unknown signal |
| Scope | Project · Milestone · Workstream · Requirement · Portfolio |
| Impact domain (multi-value) | Schedule · Cost · Scope · Quality · Safety · Compliance · Resource · Technical · Vendor · Reputation · Benefit |
| Proximity | Immediate · Near-term · Mid-term · Long-term |
| Response (threat) | Avoid · Mitigate · Transfer · Accept · Escalate |
| Response (opportunity) | Exploit · Enhance · Share · Accept · Escalate |
| Governance level | Standard · Significant · Critical |
| Status confidence | Confirmed · Provisional · Disputed |

Etapa 3 validates which values are universal vs configurable vs already existing in the app.

## 3. D2.2 — Canonical state vocabulary (12 states)

A state is the **current condition**; many events can occur without changing state.

| State | Semantics | Rule |
|---|---|---|
| **Draft** | Being formulated, outside the operational register | Not in exposure metrics unless configured |
| **Open-Unassessed** | Registered without a valid assessment | Generates aging and possible deviation |
| **Open-Assessed** | Assessment current, no approved/complete response | Enables prioritization |
| **Response-Planned** | Strategy, owner, and minimum actions defined | Does not imply the response started |
| **Response-In-Progress** | Response actions executing | May coexist with monitoring |
| **Monitoring** | Response executed or exposure watched until trigger/expiry | Periodic reviews per context |
| **Escalated** | Authority/scope exceeds the project | May be modeled as a facet (open decision) |
| **Materialized** | The uncertain event occurred totally or partially | Must link issue/blocker and real impact |
| **Closed** | Exposure ended or within tolerance, closure validated | Terminal, with evidence |
| **Retired** | No longer relevant (scope/context/window) | Terminal; does **NOT** mean mitigated |
| **Invalidated** | Duplicate, incorrect, or not a risk | Terminal, with explicit reason |
| **Reopened** | A previous closure lost validity | Transitory or event (open decision); requires justification |

## 4. D2.3 — Canonical event vocabulary (24 events)

**Conventions (frozen):** `snake_case`; noun + semantic past-tense verb; describes a business
fact, never a UI action; generic `record_updated` is **forbidden** for mining; derived events
are marked `derived` with their base evidence; every event carries a schema version and a
capture source.

Main lifecycle:

| # | Event | Semantics |
|---|---|---|
| 1 | `risk_signal_detected` | Optional; does not start the case |
| 2 | `risk_registered` | Formal start of the case |
| 3 | `risk_classified` | Taxonomy assigned/updated |
| 4 | `risk_assessed` | Preserves values and method |
| 5 | `risk_assessment_revised` | Does not overwrite history |
| 6 | `risk_owner_assigned` | First ownership |
| 7 | `risk_owner_changed` | Preserves previous and new owner |
| 8 | `risk_response_strategy_selected` | Does not imply approval |
| 9 | `risk_response_plan_approved` | May require a `decision_id` |
| 10 | `risk_response_action_created` | Relates a task/action |
| 11 | `risk_response_started` | Derivable only with an explicit rule |
| 12 | `risk_response_action_completed` | Does not mean total resolution |
| 13 | `risk_review_completed` | Documents exposure/result |
| 14 | `risk_trigger_detected` | May start contingency |
| 15 | `risk_escalated` | Destination and reason |
| 16 | `risk_materialized` | Creates/links an issue or blocker |
| 17 | `risk_residual_assessed` | Recommended before closure |
| 18 | `risk_closure_requested` | Does not close by itself |
| 19 | `risk_closure_validated` | Authority verified the criteria |
| 20 | `risk_closed` | Terminal |
| 21 | `risk_reopened` | Reason + evidence |
| 22 | `risk_retired` | Terminal ≠ Closed |
| 23 | `risk_invalidated` | Terminal, with `reason_code` |
| 24 | `risk_linked_object_changed` | Only if it alters the interpretation of the process |

**Minimum attributes of every event:** `event_id` · `event_type` (versioned) · `occurred_at` ·
`recorded_at` · `organization_id` · `project_id` (mandatory in the pilot) ·
`actor_id`/`actor_type` (or system actor) · `source_system` · `object_refs` (objects + roles) ·
`attributes` (payload) · `schema_version` · `capture_method`
(`direct | mapped | derived | imported`) · `correlation_id` (recommended) ·
`causation_event_id` (optional) · `evidence_refs` (per rule) · `data_quality_flags`.

## 5. Semantic relationships in the Living Graph

| Relationship | From → To |
|---|---|
| IDENTIFIED_IN | Risk → Project / Milestone / Requirement |
| AFFECTS | Risk → object |
| OWNED_BY | Risk → Actor / Role |
| RESPONDED_BY | Risk → Action / Task |
| AUTHORIZED_BY | Response / Closure → Decision |
| TRIGGERED_BY | Risk / Action → Signal / Event |
| MATERIALIZED_AS | Risk → Issue / Blocker |
| EVIDENCED_BY | Event / Finding → Evidence |
| IMPACTED | Materialization → Milestone / Budget / Requirement |
| DEVIATED_FROM | Observed path → Process model / rule |
| REOPENED_AFTER | Risk → Closure event |
| SUPERSEDES | Assessment / Plan → previous version |
| CAUSED_BY_EVENT | Event → Prior event — **ONLY recorded causality** |
| CORRELATED_WITH | Finding → Pattern — analytical, non-causal association |

**Rule (frozen):** causal relationships are reserved for recorded or validated causality;
statistical patterns use correlation.

## 6. D2.4 — Transition invariants (RI-01 … RI-15)

| ID | Invariant | Class |
|----|-----------|-------|
| RI-01 | An operational risk requires `project_id` and `risk_id` | Blocking |
| RI-02 | `risk_assessed` requires method, date, and values | Blocking |
| RI-03 | The owner is never inferred from the creator | Semantic |
| RI-04 | An approved plan requires strategy + accountable owner | Blocking (contextual) |
| RI-05 | `risk_closed` requires request/justification + validation + evidence per governance | Blocking (contextual) |
| RI-06 | `risk_materialized` must relate an issue/blocker/incident or documented impact | Blocking |
| RI-07 | `risk_reopened` requires a reference to the prior closure + `reason_code` | Blocking |
| RI-08 | Revised assessments never delete earlier ones | Historical integrity |
| RI-09 | Completing a mitigation task does **NOT** close the risk | Semantic |
| RI-10 | Date expiration does **NOT** close the exposure | Semantic |
| RI-11 | An invalidated risk leaves performance metrics but counts in registration quality | Analytical |
| RI-12 | An imported event preserves its source record + mapping confidence | Traceability |
| RI-13 | Derived events are never presented as direct facts | Confidence |
| RI-14 | Rules vary per governance profile but are versioned | Configuration |
| RI-15 | Analytical access respects the RBAC of the source objects | Security |

## 7. D2.5 — Evidence & exception model

### 7.1 Deviation classes (8)

| Class | Treatment |
|---|---|
| **Non-compliance** | Finding + corrective action |
| **Authorized exception** | Preserve decision/evidence; not penalized like non-compliance |
| **External execution** | Evidence + `mapped` event |
| **Data gap** | Reduce confidence; data-quality issue |
| **Model mismatch** | Review the model — do not blame the project |
| **Emergency path** | Validate retrospectively |
| **Innovation** | Best-practice candidate |
| **System defect** | Bug — not a user failure |

### 7.2 Rework semantics

**Rework** = repetition/regression that consumes effort due to correction, insufficiency,
rejection, or loss of validity. Examples: closed → reopened → response revised · approved plan
→ rejected by control → re-approved · mitigation completed → evidence rejected → re-executed.

**NOT rework:** a periodic review · `risk_assessment_revised` due to valid new information ·
`risk_owner_changed` due to an approved reorganization.

### 7.3 Evidence types

Documented assessment · governance decision · response tasks and results ·
tests/inspections/verifications · formal communication · operational metric of exposure
reduction · materialization issue/blocker · residual analysis · retirement/invalidation
justification.

### 7.4 Conceptual closure criteria (all apply)

1. Exposure window ended / cause extinct / residual within approved tolerance.
2. Mandatory actions completed, or explicit acceptance of pending ones.
3. Materialized impact transferred to an issue/blocker.
4. Evidence proportional to the governance level.
5. Validation by authority where the model requires it.
6. Differentiated closure reason: mitigated · avoided · accepted · expired ·
   materialized-transferred · retired · invalidated.

## 8. D2.6 — Analytical question catalog & semantic metrics

**Questions:** timeliness (time to assess/assign/respond/escalate/close) · waiting (where
waiting accumulates) · conformance (omitted steps and their context) · ownership (risks
without an owner, and for how long) · response (which strategies verifiably reduce exposure) ·
materialization (which signals precede it) · impact · rework/reopen · closure quality · data
quality · learning (variants with better outcomes) · inter-module (risks → blockers /
decisions / changes).

**Semantic metrics (conceptual definitions; Etapa 3 resolves calendars, time zones,
baselines, censored data):**

| Metric | Conceptual definition |
|---|---|
| Time to assess | `risk_assessed` − `risk_registered` |
| Time without owner | first `risk_owner_assigned` − `risk_registered` |
| Time to approved response | `risk_response_plan_approved` − `risk_registered` |
| Response execution time | response actions start → completion |
| Escalation latency | condition detected → `risk_escalated` |
| Review cadence compliance | reviews completed vs expected per context |
| Materialization rate | materialized / total (contextualized) |
| Closure evidence rate | closures with required evidence / total closures |
| Reopen rate | reopened / closed |
| Residual exposure reduction | assessed exposure before vs after response |
| Schedule impact realized | real impact on milestones/dates from materialization |
| Process fitness | conformance weighted by rule severity |

### 8.1 Event-log quality (10 control dimensions)

Completeness · timestamp validity · actor completeness · object linkage · semantic precision ·
source traceability · uniqueness · ordering confidence · historical coverage · model coverage.

## 9. Isabella contract for this domain

**Isabella knows:** the definition of every concept/state/event/relationship · the difference
risk vs issue vs blocker · the reference model and its version · mandatory/recommended/
contextual rules · log quality · the exact method of every metric · the limits of
interpretation · which actions require human approval.

**In answers she presents:** finding · evidence · impact · confidence · limitations ·
recommendation · navigable links.

**She never** asserts causality from correlation, and she distinguishes **"it did not
happen"** from **"it is not recorded."** (Extends the baseline's D-08: governed, read-only
tools.)

## 10. Open decisions transferred to Phase 2 (recorded as-is — NOT resolved here)

1. Escalated: main state, facet, or event?
2. Reopened: persistent state, or an event returning to Open-Assessed/Response-Planned?
3. Do opportunities share the lifecycle or require variants?
4. When is a signal promoted to a risk, and who can promote it?
5. Aggregated/derived/parent-child risks?
6. Multi-project risk, or a portfolio-risk object?
7. How to represent residual and secondary risk without duplicating semantics?
8. Which closures require independent approval by severity?
9. Which events are reconstructed from audit logs, and which are captured going forward?
10. How to map GitHub/Slack/Teams/email actions without losing source confidence?

## 11. D2.7 — Architecture inputs for the Event Architecture (Phase 2)

What Phase 2 receives from this contract: the 24-event vocabulary with minimum attributes
(§4) · the invariants that event capture must be able to enforce or flag (§6) · the evidence
and deviation model that event payloads must support (§7) · the metric definitions that fix
which timestamps/attributes are mandatory (§8) · the log-quality dimensions the audit must
score (§8.1) · the 10 open decisions (§10) · the current-state divergences to audit (§12).

## 12. Current-state divergences (audited against the real code, 2026-07-11)

> Per PO-01 **the ontology governs over the tables**; these divergences are recorded so
> Etapa 3 / Phase 2 can resolve them explicitly — never silently. Sources audited:
> `supabase/migrations/20260708000000_universal_execution_model.sql` (table `risks`),
> `src/types/execution.ts` (`RiskStatus`), `src/lib/events/registry.ts`,
> `src/lib/execution/task-activity.ts`, risk writers (`import-intelligence/execute.ts`,
> `memory/scribe-actions.ts`, `execution/template-service.ts`, `closeout/actions.ts`).

1. **State vocabulary (5 vs 12).** Current `risks.status` CHECK: `open · mitigating ·
   accepted · resolved · closed`. Missing: Draft, the Open-Unassessed/Open-Assessed
   distinction, Response-Planned vs In-Progress vs Monitoring, Escalated, Materialized,
   Retired, Invalidated, Reopened. `accepted` models a **response strategy as a state**
   (canonically Accept is a Response-taxonomy value; the state would be Monitoring).
   `resolved` has **no canonical equivalent** and overlaps Closed with undocumented semantics.
2. **Transitions are overwritten.** `status` is a single column updated in place; there is no
   risk event history — past transitions are **not reconstructable** (feeds baseline H7 and
   open question 9).
3. **Defaults auto-"assess".** `probability`/`impact`/`severity` have DB defaults (`medium`),
   so a freshly inserted risk looks assessed without any assessment — Open-Unassessed is
   currently **undetectable**, and RI-02 (method, date, values) has no support.
4. **Event naming/coverage.** `src/lib/events/registry.ts` defines risk events in
   **PascalCase** (`RiskIdentified`, `RiskEscalated`, `RiskMitigated`, `RiskMaterialized`,
   `RiskClosed`) vs the canonical `snake_case`; 5 events vs 24; `RiskMitigated` has no
   canonical equivalent (the canon separates action completion, review, and closure). These
   registry events are **not emitted by any current risks-module writer** (referenced only by
   the milestone-flow semantics map and tests).
5. **Risk ≠ issue has no target.** There is **no Issue entity** (CAP-018 Missing, 0%);
   "blockers" are task-level flags (`is_blocked` / status `blocked`, REG-010
   `task-activity.ts`), not first-class objects — so MATERIALIZED_AS / RI-06 have **no valid
   target today**.
6. **Threat-only model.** No Nature (Threat/Opportunity), Source, Knowledge, Proximity,
   Governance level, or Status confidence dimensions. `category` (12 values) approximates a
   **single-valued** impact domain vs the canonical multi-value dimension.
7. **Single response link, no strategy.** `linked_task_id` is a single FK vs RESPONDED_BY
   (multiple actions); `mitigation_plan` is free text; no response-strategy taxonomy.
8. **No decision linkage.** `decisions` exists as a table, but risks have no reference to it —
   AUTHORIZED_BY (plan approval, closure validation) is unsupported (RI-04/RI-05).
9. **Ownership without history.** `owner_user_id` is a single nullable column; owner changes
   overwrite (no `risk_owner_changed` trace). RI-03 (owner ≠ creator) is not enforced
   anywhere.
10. **Closure without validation.** `closeout/actions.ts` **bulk-updates** open risks to
    `resolved` during closeout — no closure request, validation, evidence, or differentiated
    reason (violates the semantics of RI-05 and §7.4; also uses the non-canonical `resolved`).
11. **Soft delete conflates terminals.** `deleted_at` removal is indistinguishable from
    Retired vs Invalidated semantics (no reason codes).
12. **Evidence is origin-only.** `evidence_json` + `origin`/`confidence_score` cover the
    *creation* provenance (Drawing Intelligence, AI, import — a good partial match for
    `capture_method` and PD-012) but there are no per-transition `evidence_refs`.

**Convergences worth keeping:** the `origin`/`confidence_score`/`needs_review` pattern aligns
with `capture_method` + confidence; the PEG seed (`src/lib/events/ingestion.ts` envelope with
subject/actor/causality/evidence fields) is structurally close to §4's minimum attributes; the
existing evidence-provenance rules (PD-012) already embody PO-03/PO-09 for created entities.

## 13. What this document is NOT

A semantic contract only. It does not design physical tables, migrations, algorithms,
enumerations, UI, or implementation; it does not modify the risks module; it does not resolve
the open decisions (§10); it does not authorize Phase 2 work before approval.

## 14. Links

[CAP-045 foundation baseline](CAP-045-process-mining-layer-foundation-baseline.md) (D-06,
D-07, PO principles' parent guardrails) · [05-capability-registry.md](../05-capability-registry.md)
(CAP-045) · [30-product-decision-log.md](../30-product-decision-log.md) (PD-015, PD-016) ·
[00-product-constitution.md](../00-product-constitution.md) (§4 PEG, §9 PIE) ·
[12-living-graph-strategy.md](../12-living-graph-strategy.md) ·
[10-regression-log.md](../10-regression-log.md) (REG-010 blocker semantics) ·
[00-index.md](../00-index.md)

## 15. Last reviewed

2026-07-11 — created (P1-T2, docs-only). Approval pending — see Approval block.
