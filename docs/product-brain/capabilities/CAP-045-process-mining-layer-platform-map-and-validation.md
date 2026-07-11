# CAP-045 — Process Mining Layer · Platform Map & Ontology Validation

> **Phase 1 closing document** for the Living Graph Process Mining Layer: the current-state
> vs target-state **capability map** (D3.1), the **vocabulary alignment** of the canonical
> objects against the real platform (D3.2), and the **validation of the frozen ontology with
> three realistic project cases** (D3.3). Documentation and analysis only — zero code, zero
> migrations, zero UI (baseline decision **D-07**).
>
> **Plan traceability:** `ProjectOps360_Import_Plan_v1` · **Phase 1 · Task P1-T3** — "Map
> platform to vision and ontology; validate with real cases" (consolidates original Stages
> **S1-T2, S2-T2, S2-T3**). Depends on the approved
> [foundation baseline](CAP-045-process-mining-layer-foundation-baseline.md) (PD-015,
> Approved 2026-07-10) and the approved
> [Risk-to-Resolution ontology](CAP-045-process-mining-layer-ontology-risk-to-resolution.md)
> (PD-016, Approved 2026-07-11). Approval of this document **closes Phase 1** and enables
> milestone **P1-M1 — Foundation & Ontology approved**.
>
> **Capability:** CAP-045 ([registry](../05-capability-registry.md)) · **Decision:**
> [PD-017](../30-product-decision-log.md). Code paths and tables cited below were verified
> against the repository on 2026-07-11 (searches, not memory).

---

## Approval block

| Field | Value |
|---|---|
| **Approval status** | ✅ **Approved** |
| **Approver** | Efrain Prada — Product Owner |
| **Approval date** | 2026-07-11 (recorded in-session) |
| **Effect** | Approval closes **Phase 1** (P1-T1 + P1-T2 + P1-T3) and enables milestone **P1-M1**; **Phase 2 — Event Architecture & Process Mining Foundation** formally opens. The D3.1 map becomes the **progress baseline** for the whole plan. The frozen ontology (PD-016) was **not modified** by this validation — gaps/tensions are recorded as open decisions for Phase 2. |

---

## 1. D3.1 — Current-state vs target-state capability map

Mapped over the canonical cognitive stack (baseline vision · Master Book v1):

`Reality → Business Objects → Living Graph → Canonical Event Architecture → Project Memory →
Knowledge Layer → Behavioral Intelligence Engine → Knowledge Reasoning Engine → Isabella →
Organizational Learning`

Registry percentages are quoted as-is from [05-capability-registry.md](../05-capability-registry.md)
(deliberately conservative). **This map is the baseline against which the plan's progress is
measured.**

| # | Layer | What exists today (verified) | What the target requires | Concrete gap | Closed by |
|---|-------|------------------------------|--------------------------|--------------|-----------|
| 1 | **Reality (capture)** | Manual UI writers; Project Import Intelligence (CAP-040, 75%, `src/lib/import-intelligence`); Scribe voice/notes (CAP-008, 80%, `src/lib/scribe`, `src/lib/memory`); GitHub Intelligence webhook/backfill (`src/lib/github-intelligence`); Rythm meeting audio (dormant pipeline, `src/lib/rythm`) | All process-relevant PM facts observable as events (baseline: Observe) with source confidence | Much of PM reality (email/Slack/Teams, approvals outside the app) is never captured; capture is record-oriented, not event-oriented | **P2** (minimum event capture) · P8 (Stage 18 Communication Intelligence) |
| 2 | **Business Objects** | `projects`, `milestones`, `roadmap_tasks` (+`subtasks`), `task_dependencies`, `risks`, `decisions`, `budget_items`, `stakeholders`, `project_team_members`, `communications`, `documents`, `meetings`… (CAP-017..023, 027, 029, 034, 036, 037 — mostly Implemented 70–90%) | The 12 canonical objects of the ontology (PD-016 §2.3) with their ontological roles | **Issue entity Missing** (CAP-018, 0%); **Process Model Missing**; Requirement not first-class; object-role links absent (see D3.2) | **P2/P3** (per-module ontology extension) |
| 3 | **Living Graph** | CAP-005 (75%): `process_nodes`/`process_edges`/`process_snapshots`, `src/lib/graph`, realtime engine `src/lib/living-graph` (LGRE, Phase 4 closed), milestone-flow UI `src/lib/milestone-flow-ui`, saved layouts (UX-007/PD-008), projection-only rule (REG-018/CAP-001) | Canonical knowledge-graph **container** with navigation Living Graph → PML → module → case; Stage 4's six layers (Object, Relationship, Event, Knowledge, Intelligence, Prediction) | Event/Knowledge/Intelligence/Prediction layers absent; no case-level navigation; relationships limited to dependency/assignment edges (none of the 14 semantic relationships of PD-016 §5) | **P3** (Stages 4–6) |
| 4 | **Canonical Event Architecture** | **PEG seed**: `project_event_log` (migrations `20260830000000`, `20260833000000` realtime), `src/lib/events/` (`registry.ts` **96 event types / 15 categories**, `ingestion.ts` envelope with actor/importance/retention/impact, `backfill.ts` honest backfill, `dual-write.ts`); milestone-flow event semantics (`src/lib/milestone-flow/event-semantics*.ts`) | PD-016 §4 canonical vocabulary: `snake_case` business facts, multi-object `object_refs` with roles, `capture_method`, `evidence_refs`, per-type schema versions; immutable, reconstructable lifecycles | Naming divergence (PascalCase vs `snake_case`); risk coverage 5/24 and **no risks-module writer emits them** (PD-016 §12.4); envelope lacks multi-object `object_refs` roles; state transitions still overwritten in canonical tables | **P2** (this is exactly Phase 2's job) |
| 5 | **Project Memory** | CAP-006/007/008 (80–85%): `project_memory_items`, `project_scribe_items`, vectorization (`src/lib/embeddings`), `traceability_links`, provenance projection (PD-012, `src/lib/provenance`) | Stage 3 decision: the event architecture **feeds** Project Memory — never replaces or renames it | Memory is not fed by canonical events; timeline is record-based | **P2** (feed) · P8 (Stage 19 memory boundaries) |
| 6 | **Knowledge Layer** | **Mostly Missing (~10%)**. Nearby but different-purpose: Knowledge OS (CAP-001, 80%, `src/lib/knowledge-os` — *curated grounding corpus*, not project findings); milestone-flow detectors compute findings transiently (not persisted, no lifecycle) | Stage 5 Knowledge Objects (Finding, Pattern, Best Practice, Lesson Learned, Recommendation, Prediction, Root Cause) with lifecycle Proposed→Validated→Active, evidence and confidence | No persisted, validated, versioned project knowledge objects at all | **P3** (Stages 5–6) |
| 7 | **Behavioral Intelligence Engine** | Partial (~15–20%): **MPF Engine** `src/lib/milestone-flow` (transition builder, metrics calculator, rework/delay/bottleneck/blocker/constraint detectors — milestone domain, read-only); `src/lib/graph/living-graph-analysis.ts` (bottlenecks, what-if); `src/lib/labor/crew-idle-risk.ts` | Stage 7: four families (Discovery, Conformance, Performance, Action) over **canonical events** per module, starting with the Risk pilot; finding lifecycle; versioned scores | Analysis derives from current state, not events; single domain (milestones); **no conformance** (no process models); no finding lifecycle | **P4** (Stage 7) |
| 8 | **Knowledge Reasoning Engine** | Partial seeds (~25%): `src/lib/isabella/{tools, query-engine, process-context, process-intelligence, process-intelligence-runtime, root-cause, recommendations, daily-diagnosis, executive-brief}` — governed tool-use gateway + evidence contract (REG-023 deterministic routing) | Stage 8 pipeline: Question → Intent → KG Navigation → Evidence → Conflict Resolution → Confidence → Recommendation → NL; explicit uncertainty classes | No Knowledge Graph to navigate; reasoning runs over projections/rollups; uncertainty classes partial | **P4** (Stage 8) |
| 9 | **Isabella** | CAP-002 (70–82%): conversation, screen intelligence, deterministic briefing (REG-013), executive brief (REG-023), voice, provenance answers (PD-012), Product-Brain grounding (Dr. Isabella) | Conversational interface of the Reasoning Engine — never bypassing it (Stage 8); **governed read-only PML tools** (baseline D-08, ontology §9 domain contract) | No risk-process domain tools (get_case_timeline, get_process_health for risks); domain contract of PD-016 §9 unimplemented | **P4** (Isabella integration) |
| 10 | **Organizational Learning** | **Missing (0%)**. Closest free-text artifacts: `lessons_learned_notes` column (`20260721000000_delivery_framework.sql`), Closeout lessons section, Blueprint optional lessons summary (PD-011) — none has lifecycle, validation, or confidence | Stage 9: learning lifecycle with scope, confidence, decay, validation (Finding → Pattern → Repeated Evidence → Validated Learning → Practice) | Everything | **P5** (Stage 9) |

**Reading:** layers 1–5 have real substance (the platform's operational body); layers 6–10 are
seeds or missing (the plan's intelligence altitude). This is consistent with the plan's phase
order P2 → P3 → P4 → P5 and with baseline hypothesis H7 (partial history, additional capture
required).

## 2. D3.2 — Canonical object ↔ platform vocabulary alignment

Alignment levels: **Aligned** (concept and record match) · **Partial** (record exists, role
semantics incomplete) · **Divergent** (record exists, semantics conflict) · **Missing** (no
entity today). Risk divergences are **not duplicated** here — the 12 audited findings live in
[PD-016 §12](CAP-045-process-mining-layer-ontology-risk-to-resolution.md) (one source of
truth per finding).

| Canonical object | Current table / type (verified) | Current surface / workflow | Alignment | Divergence notes |
|---|---|---|---|---|
| **Risk** (focal) | `risks` (`20260708000000_universal_execution_model.sql`) · `RiskStatus` (`src/types/execution.ts`) | No dedicated CRUD UI; created by import/Scribe/templates; consumed by briefings, Status, Closeout, LG risk overlay | **Divergent** | **See PD-016 §12** — 12 audited divergences (5 vs 12 states, overwritten transitions, auto-assess defaults, bulk-resolve, etc.) |
| **Project** (mandatory context) | `projects` · `ProjectType` (`src/types/execution.ts`) | Projects list, Command Center | **Aligned** | `project_id` + org RLS everywhere (RI-01 supported). Portfolio scope absent (open decision #6) |
| **Milestone** (impacted/protected) | `milestones` (+ auto-computed status sync) | Roadmap, Living Graph, milestone-flow | **Partial** | Exposure/protection semantics not modeled; only a single `risks.linked_milestone_id` FK (no IDENTIFIED_IN/IMPACTED relations) |
| **Task / Action** (response) | `roadmap_tasks` (+ `subtasks`) — CAP-020 (90%) | Workboard, task detail, Execution Map | **Partial** | No response-role typing (mitigation/prevention/contingency/exploitation); risk→task is a single `linked_task_id` (RESPONDED_BY needs 1:N with roles) |
| **Decision** (control) | `decisions` (`20260607000000_mvp0_baseline.sql`: status `proposed/accepted/rejected/deferred/revoked`, `decided_by`; + `source_type`/`source_record_id`, `20260614000000_decision_log_enhancements.sql`) | Decisions log + detail (SourceEvidence, PD-012) | **Partial** | Decision object healthy; but **no AUTHORIZED_BY link from risk response/closure to a decision** (RI-04/RI-05 unsupported) |
| **Issue / Blocker** (materialization) | **No entity** — CAP-018 Missing (0%); "blocked" = `roadmap_tasks.is_blocked` flag + status `blocked` (REG-010, `src/lib/execution/task-activity.ts`) | Blocked indicators (Workboard/LG/briefings) | **Missing** | MATERIALIZED_AS has no valid target (PD-016 §12.5); blocker-as-flag ≠ Blocker-as-object |
| **Requirement / Deliverable** (affected) | No first-class table. Nearest: `project_backlog_items.item_type` (free text, `20260721000000_delivery_framework.sql`); `material_requirements` is a different domain (construction takeoff) | Delivery → Backlog/Refinement | **Missing** (as canonical role) | Requirement affectation (AFFECTS/IMPACTED on scope/quality) not expressible |
| **Budget Item** (financial impact) | `budget_items` + `cost_actuals` — CAP-027 (40%) | Budget page | **Partial** | No risk↔budget linkage (reserve, response cost, realized loss) |
| **Evidence** (proof) | Distributed: `risks.evidence_json`, drawing evidence, `traceability_links` (`mvp0_baseline.sql`), `project_scribe_items` source chain (PD-012), task/subtask attachments (`src/lib/attachments`), `audit_logs` (`20260617000000_create_audit_logs.sql`) | Provenance UI (decision detail, memory panel) | **Partial** | No unified Evidence reference; **no per-transition `evidence_refs`** (PD-016 §12.12) |
| **Actor / Role** (responsibility) | `profiles`, `organization_members`, `project_team_members` (+RACI, `governance_role`) — CAP-044 directory (`src/lib/people`) | Team, Charter roles, directory | **Partial** | Identity model solid; but actor-on-event is sparse (`created_by`/`decided_by` columns); PEG envelope has actor + system-actor (good seed) |
| **Communication** (context) | `communications` (CAP-026, 30%) + meetings (`lib/rhythm`, CAP-037) | Communications log, Rhythm Center | **Partial** | Matches the ontological role (context, never a substitute for events) but has **no linkage to risks** |
| **Process Model** (reference) | **No entity.** Nearest: `project_delivery_frameworks` (method rules), `project_governance_rules`, milestone-flow `event-semantics-map.ts` (expected semantics, code-level) | Delivery overview, Charter governance | **Missing** | Without a Process Model object, **conformance checking is impossible** — expected by Phase 2/3 (ontology taxonomy: Mandatory/Recommended/Contextual) |

### 2.1 Current vocabulary → canonical term

| Current term (where) | Canonical term (PD-016) | Note |
|---|---|---|
| `status = open` (`risks`) | Open-Unassessed / Open-Assessed | Indistinguishable today (defaults auto-assess — PD-016 §12.3) |
| `status = mitigating` | Response-In-Progress | Collapses Response-Planned / In-Progress / Monitoring |
| `status = accepted` | Response strategy **Accept** (state: Monitoring) | A strategy modeled as a state |
| `status = resolved` | — (no equivalent) | ≈ Closed without validation; non-canonical |
| `status = closed` | Closed | Today without RI-05 (request → validation → evidence) |
| `is_blocked` / status `blocked` (tasks) | **Blocker** (object) / blocked-by-impediment | Flag vs first-class materialization object |
| `RiskIdentified` (`events/registry.ts`) | `risk_registered` | PascalCase vs `snake_case` |
| `RiskEscalated` | `risk_escalated` | idem |
| `RiskMitigated` | — (no direct equivalent) | Canon separates `risk_response_action_completed` / `risk_review_completed` / closure |
| `RiskMaterialized` | `risk_materialized` | idem naming |
| `RiskClosed` | `risk_closed` | idem naming |
| `probability`/`impact`/`severity` defaults | `risk_assessed` values (+ method, date) | Values without an assessment event |
| `category` (single value) | Impact domain (multi-value) | 12 app categories ≈ canonical domains, but single-valued |
| `deleted_at` (soft delete) | Retired / Invalidated | No reason codes; terminals conflated |
| `origin` + `confidence_score` (`risks`) | `capture_method` + mapping confidence | **Convergent** — keep |

## 3. D3.3 — Ontology validation with three realistic cases

Rules observed: sequences use **only** the 24 canonical events (PD-016 §4); every case
respects RI-01..RI-15; the frozen ontology was **not modified** — findings become open
decisions. Format per event: `event (object_refs: object→role)`.

### 3.1 Case A — Software: vendor-dependency risk that materializes

**Narrative.** A SaaS team plans release R12 with a payments feature depending on an external
vendor SDK. At sprint planning the PM registers the risk that the vendor's v2 API (required
for the feature) may be deprecated before GA. The risk is assessed, an owner assigned, and a
mitigation plan (abstraction layer + fallback provider spike) is approved by the steering
decision. Mid-release the vendor announces end-of-life **earlier** than expected: the risk
materializes into a blocker on the integration task, impacting the "Beta cut" milestone. The
work transfers to the blocker; the risk closes as materialized-transferred. Separately, an AI
import had created a duplicate of this risk, which is invalidated.

**Canonical event sequence (risk A1 — the vendor risk):**

1. `risk_signal_detected` (vendor roadmap rumor; Communication→context) — does not start the case
2. `risk_registered` (Project→context; Milestone "Beta cut"→impacted) — RI-01 ✓
3. `risk_classified` (Nature=Threat, Source=External, Impact domain={Schedule, Technical, Vendor}, Proximity=Near-term, Governance=Significant)
4. `risk_assessed` (method=PxI matrix, P=medium, I=high; date) — RI-02 ✓
5. `risk_owner_assigned` (Actor: tech lead — not the registering PM; RI-03 ✓)
6. `risk_response_strategy_selected` (Mitigate)
7. `risk_response_plan_approved` (Decision→control; `decision_id`) — RI-04 ✓ · AUTHORIZED_BY
8. `risk_response_action_created` (Task "abstraction layer"→response; Task "fallback spike"→response) — RESPONDED_BY (1:N)
9. `risk_response_started` (derived from first task's start; `capture_method=derived`, explicit rule) — RI-13 ✓
10. `risk_response_action_completed` (abstraction layer done — **does not close the risk**, RI-09 ✓)
11. `risk_trigger_detected` (vendor EOL announcement; Evidence: vendor bulletin) — TRIGGERED_BY
12. `risk_materialized` (creates/links **Blocker** on integration task; Milestone→impacted) — RI-06 ✓ · MATERIALIZED_AS · IMPACTED · CAUSED_BY_EVENT(→11)
13. `risk_residual_assessed` (remaining exposure now carried by the blocker/issue)
14. `risk_closure_requested` (reason: materialized-transferred)
15. `risk_closure_validated` (PM authority; evidence: blocker link + impact record) — RI-05 ✓
16. `risk_closed` (closure reason = **materialized-transferred**) — see finding F-A1 / open decision #11

**Data gap exercised:** between events 7 and 11 the vendor communication thread lived in
email — no `risk_review_completed` was ever recorded. The reconstruction marks the interval
with `data_quality_flags` and reduces confidence (deviation class **Data gap**, not
non-compliance). **External execution** also appears: the blocker's resolution work happened
in GitHub (mapped events, source confidence preserved — RI-12).

**Risk A2 (duplicate from AI import):** `risk_registered` (capture_method=imported) →
`risk_invalidated` (reason_code=duplicate, references A1) — terminal ✓. RI-11: A2 leaves
performance metrics but counts in registration quality.

**State trajectories.** A1: Open-Unassessed → Open-Assessed → Response-Planned →
Response-In-Progress → **Materialized** → Closed. A2: Open-Unassessed → **Invalidated**.

**Living Graph relationships exercised:** IDENTIFIED_IN, AFFECTS, OWNED_BY, RESPONDED_BY,
AUTHORIZED_BY, TRIGGERED_BY, MATERIALIZED_AS, EVIDENCED_BY, IMPACTED, CAUSED_BY_EVENT.

**Computable metrics:** Time to assess (e4−e2) · Time without owner (e5−e2) · Time to
approved response (e7−e2) · Materialization rate contribution · Closure evidence rate ✓.

### 3.2 Case B — Construction: permit/weather risk with budget reserve, reopened

**Narrative.** A commercial fit-out project registers, during planning (as **Draft** first —
scoping workshop), the risk that the mechanical permit plus a winter-weather window delays the
rooftop HVAC installation milestone. A contingency budget reserve is created. The full normal
path runs: assessment, owner, approved plan (schedule buffer + pre-fabrication), execution,
monitoring with periodic reviews, and a **validated closure with evidence** when the permit
arrives and installation completes inside the window. Weeks later the city **revokes** the
permit over a documentation defect: the closure loses validity and the risk is **reopened**.
A revised assessment supersedes the original; after re-approval and re-inspection the risk is
closed again — a governance-authorized exception allows one skipped review during the
city-response wait.

**Canonical event sequence (abridged where repetition adds nothing):**

1. `risk_registered` (from Draft; Project→context; Milestone "HVAC installed"→protected; Budget Item "contingency reserve"→financial impact) — AFFECTS
2. `risk_classified` (Threat, External, {Schedule, Cost, Compliance}, Governance=**Critical**)
3. `risk_assessed` (method + values) → 4. `risk_owner_assigned` (site manager)
5. `risk_response_strategy_selected` (Mitigate) → 6. `risk_response_plan_approved` (Decision) → 7. `risk_response_action_created` (buffer re-plan; pre-fab tasks)
8. `risk_response_action_completed` → 9. `risk_review_completed` (exposure reduced)
10. **Authorized exception:** one scheduled review skipped while awaiting the city —
    `risk_review_completed` absent for that period **plus** a Decision recording the
    exception (deviation class **Authorized exception**: decision + evidence preserved, not
    penalized as non-compliance) — DEVIATED_FROM (vs review-cadence rule) + AUTHORIZED_BY
11. `risk_residual_assessed` → 12. `risk_closure_requested` → 13. `risk_closure_validated`
    (evidence: permit doc + inspection record — Critical governance demands both, RI-05 ✓)
14. `risk_closed` (reason=mitigated) — **Monitoring → Closed**
15. `risk_reopened` (references closure event 14; reason_code=closure_invalidated —
    permit revoked) — RI-07 ✓ · REOPENED_AFTER
16. `risk_assessment_revised` (new exposure; **does not delete** the original — RI-08 ✓) — SUPERSEDES
17. `risk_response_plan_approved` (remediation of documentation; new decision)
18. `risk_response_action_completed` → 19. `risk_review_completed`
20. `risk_closure_requested` → 21. `risk_closure_validated` (re-inspection evidence) → 22. `risk_closed` (mitigated)

**RI-10 exercised:** the original weather window's calendar expiry did **not** close
anything — closure always went through request → validation → evidence.

**State trajectory:** Draft → Open-Unassessed → Open-Assessed → Response-Planned →
Response-In-Progress → Monitoring → Closed → **Reopened** → Open-Assessed →
Response-In-Progress → Monitoring → Closed. (Reopened routing per open decision #2 —
exercised, works, stays open.)

**Relationships:** IDENTIFIED_IN, AFFECTS (budget), OWNED_BY, RESPONDED_BY, AUTHORIZED_BY,
EVIDENCED_BY, DEVIATED_FROM, REOPENED_AFTER, SUPERSEDES.

**Metrics:** Review cadence compliance (with authorized exception correctly excluded) ·
Reopen rate contribution · Closure evidence rate · Residual exposure reduction (assessed
before/after response) · Time to approved response.

### 3.3 Case C — Hybrid: shared risk escalated to portfolio + opportunity + retirement

**Narrative.** A "smart-office rollout" program has a software workstream (occupancy
analytics app) and a physical workstream (sensor installation across three sites). A supply
shortage risk on sensors threatens both the installation milestone and the software pilot's
data availability; its scope exceeds the project and it is **escalated** to portfolio
authority, which approves a Transfer strategy (vendor contract with penalties). During
execution, the team registers an **opportunity**: buying the newer sensor model in bulk would
cut unit cost and double telemetry resolution (nature=Opportunity, strategy=**Exploit**); it
is exploited and closed when the benefit is contracted. Finally, the analytics workstream
descopes an on-prem integration feature — its integration risk is **retired** (no longer
relevant; explicitly ≠ mitigated).

**Risk C1 (shared supply risk, escalated):**
`risk_registered` (both milestones→impacted) → `risk_classified` ({Schedule, Cost, Benefit},
Scope=**Portfolio** taxonomy value) → `risk_assessed` → `risk_owner_assigned` →
`risk_escalated` (destination: portfolio board; reason: cross-project scope) — **Escalated**
(modeled as facet over Open-Assessed per open decision #1 — exercised, stays open) →
`risk_response_strategy_selected` (Transfer) → `risk_response_plan_approved` (portfolio
decision) → `risk_response_action_created` (contract task) →
`risk_response_action_completed` → `risk_review_completed` → `risk_residual_assessed` →
`risk_closure_requested` → `risk_closure_validated` → `risk_closed` (reason=**avoided** via
transfer; evidence: signed contract).
**Metric:** Escalation latency (escalated − registered).

**Risk C2 (opportunity, Exploit):**
`risk_registered` (nature=Opportunity) → `risk_classified` (Impact domain={Cost, Benefit}) →
`risk_assessed` (upside valuation) → `risk_owner_assigned` →
`risk_response_strategy_selected` (**Exploit**) → `risk_response_plan_approved` →
`risk_response_action_created` (bulk purchase) → `risk_response_action_completed` →
`risk_review_completed` (benefit contracted) → `risk_closure_requested` →
`risk_closure_validated` → `risk_closed` (reason = … **finding F-C2**: no closure reason for
a *realized opportunity* — the frozen list (§7.4: mitigated, avoided, accepted, expired,
materialized-transferred, retired, invalidated) is threat-oriented; "accepted" misstates it).
**States:** Open-Unassessed → Open-Assessed → Response-Planned → Response-In-Progress →
Closed.

**Risk C3 (retired):** `risk_registered` (on-prem integration risk) → `risk_classified` →
`risk_assessed` → `risk_owner_assigned` → `risk_linked_object_changed` (the on-prem
requirement is descoped — alters process interpretation) → `risk_retired` (window/context
gone; explicitly **≠ Closed/mitigated**) — terminal ✓.

**Relationships exercised here:** IDENTIFIED_IN, AFFECTS, OWNED_BY, RESPONDED_BY,
AUTHORIZED_BY, EVIDENCED_BY, IMPACTED, plus **CORRELATED_WITH** (analytical: supply-shortage
signals correlate with installation-delay pattern across the portfolio — association, never
CAUSED_BY_EVENT).

### 3.4 Coverage check (required aspects)

| Required aspect | Case | ✓ |
|---|---|---|
| Normal route with validated closure + evidence | B (events 1–14) | ✓ |
| Materialization → issue/blocker → impact → materialized-transferred | A (events 11–16) | ✓ |
| Reopening (closed → reopened, reason_code) | B (event 15) | ✓ |
| Retirement (≠ closed) | C3 | ✓ |
| Invalidation | A2 | ✓ |
| Opportunity (Exploit/Enhance) | C2 (Exploit) | ✓ |
| Authorized exception | B (event 10) | ✓ |
| Data gap | A (events 7→11 interval) | ✓ |
| Escalation | C1 | ✓ |
| All 14 LG relationships exercised across cases | A+B+C | ✓ |
| All 8 deviation classes probed | Data gap (A), Authorized exception (B), External execution (A/GitHub), Non-compliance & Model mismatch & Emergency path & Innovation & System defect — discussed in findings F-6 | ✓ (4 walked, 4 analyzed) |

### 3.5 Findings table

| # | Aspect | Verdict | Detail |
|---|--------|---------|--------|
| F-A1 | Terminal for materialization: boundary lists `risk_materialized_transferred` as a terminal event, but the 24-event table has **no such event** — the case had to express it as `risk_closed` with closure reason `materialized-transferred` | **Gap** | Inherited inconsistency from the Etapa 2 source document. Registered as **open decision #11** (below). The workaround is expressible and invariant-safe (RI-05/RI-06 hold), so the pilot is not blocked |
| F-C2 | Closure reasons are threat-oriented — no reason for a **realized opportunity** | **Gap** | Registered as **open decision #12**; extends existing open decision #3 (opportunity lifecycle variants) |
| F-1 | Normal route, materialization, reopening, retirement, invalidation | **Confirmed** | All expressible with the 24 events + 12 states; invariants prevented every illegal shortcut (no close without validation, no materialization without blocker link) |
| F-2 | Escalated as facet (open decision #1) | **Confirmed (with note)** | Facet-over-state worked in C1; keeping #1 open for Phase 2 is fine — no new decision needed |
| F-3 | Reopened routing (open decision #2) | **Confirmed (with note)** | B routed Reopened → Open-Assessed naturally after `risk_assessment_revised`; #2 stays open |
| F-4 | Blocker as materialization target | **Tension** | Expressible ontologically, but the platform has **no Issue/Blocker entity** (D3.2) — the pilot's materialization path depends on CAP-018 or an interim decision in Phase 2 (already visible via PD-016 §12.5; no new decision) |
| F-5 | Multi-object `object_refs` with roles | **Confirmed** | Every case needed them (A: task+milestone+blocker on one event) — reinforces H4 (object-centric, OCEL 2.0) |
| F-6 | Remaining deviation classes (Non-compliance, Model mismatch, Emergency path, Innovation, System defect) | **Confirmed (analyzed)** | Each has a clear home: e.g. skipping closure validation where governance requires it = Non-compliance; an expected-model rule wrong for hybrid projects = Model mismatch (revise the model); emergency permit path = validate retrospectively. No expressiveness gaps found |
| F-7 | Portfolio scope (C1) | **Tension** | Taxonomy has Scope=Portfolio and escalation works, but analysis is project-scoped in the baseline (portfolio = future stage; open decision #6) — consistent, no new decision |
| F-8 | Draft state | **Confirmed (with note)** | Only Case B used Draft; current writers (import/Scribe/templates) register directly. Fine — Draft stays configuration-dependent (§3 of the ontology) |

## 4. Verdict

1. **Does the ontology sustain the three project types?** **Yes.** Software, construction,
   and hybrid cases were fully expressible with the frozen vocabulary; the invariants blocked
   exactly the illegal paths they were designed to block, and the deviation classes cleanly
   separated data gaps and authorized exceptions from non-compliance. Two vocabulary gaps
   were found (F-A1, F-C2); both have invariant-safe workarounds and become open decisions —
   **the frozen contract was not modified** (PD-016 rule).
2. **New open decisions for Phase 2** (continuing PD-016 §10's numbering):
   - **#11 — Materialized-transferred terminal:** should `risk_materialized_transferred`
     exist as a distinct terminal **event** (as the boundary implies), or is the canonical
     form `risk_closed` with closure reason `materialized-transferred` (as the 24-event table
     forces today)? The Event Architecture must pick one and version it.
   - **#12 — Opportunity closure reasons:** add realized/not-realized closure reasons for
     `nature=Opportunity` (e.g. *exploited/realized*, *not realized*), or fold them into the
     open decision #3 lifecycle-variant resolution.
3. **Progress baseline confirmed:** the D3.1 map (10 layers, verified evidence, honest
   percentages) is the line against which the plan's progress is measured from Phase 2
   onward. Phase 2 must start from layer 4 (Canonical Event Architecture) exactly as the map
   indicates.

## 5. What this document is NOT

It changes no code, schema, or UI; it does not modify the frozen baseline (PD-015) or
ontology (PD-016); it does not resolve open decisions #1–#12; it does not start Phase 2 work
(authorized only after this approval closes Phase 1 / P1-M1).

## 6. Links

[CAP-045 foundation baseline](CAP-045-process-mining-layer-foundation-baseline.md) ·
[CAP-045 Risk-to-Resolution ontology](CAP-045-process-mining-layer-ontology-risk-to-resolution.md) ·
[05-capability-registry.md](../05-capability-registry.md) ·
[30-product-decision-log.md](../30-product-decision-log.md) (PD-015 · PD-016 · PD-017) ·
[04-module-map.md](../04-module-map.md) · [22-modules.md](../22-modules.md) ·
[00-product-constitution.md](../00-product-constitution.md) ·
[12-living-graph-strategy.md](../12-living-graph-strategy.md) · [00-index.md](../00-index.md)

## 7. Last reviewed

2026-07-11 — created (P1-T3, docs-only) and **approved by the Product Owner in-session the
same day** (see Approval block). **Phase 1 is closed** (P1-T1 + P1-T2 + P1-T3 all approved);
milestone P1-M1 enabled; **Phase 2 — Event Architecture & Process Mining Foundation is
formally open.**
