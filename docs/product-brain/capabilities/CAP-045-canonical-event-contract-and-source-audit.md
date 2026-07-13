# CAP-045 — Canonical Event Contract & Source Audit (Risk-to-Resolution pilot)

> **Phase 2 opening document** for the Living Graph Process Mining Layer: **Part A** freezes
> the **canonical event contract** (immutable envelope, naming, provenance, temporal
> semantics) that P2-T2 will implement; **Part B** is the **read-only audit of existing
> event sources** — classifying each of the 24 canonical pilot events as Available,
> Reconstructable, or Missing. Specification and audit only — **zero product changes**; the
> only implementation authorized is P2-T2, and only over this approved contract.
>
> **Plan traceability:** `ProjectOps360_Import_Plan_v1` · **Phase 2 · Task P2-T1** — "Define
> canonical event contract and audit sources" (consolidates original Stage 3 tasks **S3-T1**
> and **S3-T2**). Depends on the closed Phase 1 / milestone P1-M1:
> [baseline](CAP-045-process-mining-layer-foundation-baseline.md) (PD-015),
> [ontology](CAP-045-process-mining-layer-ontology-risk-to-resolution.md) (PD-016),
> [platform map & validation](CAP-045-process-mining-layer-platform-map-and-validation.md)
> (PD-017) — all Approved.
> **Source of the frozen content:** *ProjectOps360 Process Mining Layer — Stage 3, Canonical
> Event Architecture, julio 2026* + repository audit 2026-07-11 (all sources verified by
> search, not memory).
>
> **Capability:** CAP-045 ([registry](../05-capability-registry.md)) · **Decision:**
> [PD-018](../30-product-decision-log.md).

---

## Approval block

| Field | Value |
|---|---|
| **Approval status** | ✅ **Approved** |
| **Approver** | Efrain Prada — Product Owner |
| **Approval date** | 2026-07-11 (recorded in-session) |
| **Effect** | The canonical event contract is frozen and **P2-T2 (minimum event capture implementation) is authorized ONLY over this contract** (§B.4 scope). The §A.10 resolutions of open decisions **#1, #2, and #11 were approved as proposed** (none returned) and are now **binding**. |

---

## 0. Architectural decisions frozen (Stage 3)

1. **Events are immutable facts.** Never rewritten; corrections are **append-only**
   (compensating events).
2. **Objects and events coexist in the Living Graph.** Business state lives in objects;
   history lives in events.
3. **Command ≠ action ≠ state ≠ event** — four distinct concepts (defined in §A.2).
4. **Object-centric model** (OCEL 2.0 as reference): one event relates to multiple objects
   with roles — no single artificial case ID.
5. **The Process Mining Layer consumes events, never current state.**
6. **Project Memory already exists: the event architecture FEEDS it — it never replaces or
   renames it** (explicit Stage 3 naming decision).
7. Flow vision: `Living Graph → Canonical Event Architecture → Process Mining Layer →
   Isabella → Project Learning System`.

---

# Part A — Canonical event contract (S3-T1)

## A.1 Canonical envelope — field-by-field vs the existing PEG

**Rule: one pipeline.** The contract is implemented by **extending the existing PEG
ingestion gateway** (`src/lib/events/ingestion.ts` → `project_event_log`, migration
`20260830000000_project_event_log.sql`) — never by a second event pipeline (CLAUDE.md rule
#5; PD-016 declared the PEG a convergence). Correspondence, verified against
`EmitEventInput`/`NormalizedRow` and the table DDL:

| # | Canonical attribute (PD-016 §4) | PEG today (verified) | Verdict |
|---|---|---|---|
| 1 | `event_id` | `event_id` (PK) | **Reuse** |
| 2 | `event_type` (versioned) | `event_type` + `event_schema_version` (validated ≥1) | **Reuse** |
| 3 | `occurred_at` | `occurred_at` (input; defaults now) | **Reuse** |
| 4 | `recorded_at` | `recorded_at` (DDL, `DEFAULT now()`) | **Reuse** |
| 5 | `organization_id` | `organization_id` (required, validated) | **Reuse** |
| 6 | `project_id` (mandatory in pilot) | `project_id` (required, validated; per-project `sequence_number`) | **Reuse** |
| 7 | `actor_id` / `actor_type` (or system actor) | `actor_id` + `actor_type` (`VALID_ACTOR_TYPES`, includes system/ai) | **Reuse** |
| 8 | `source_system` | `source_module` + `source_entity_type`/`source_entity_id` | **Reuse** (name mapped; richer) |
| 9 | **`object_refs` (objects + roles)** | Single subject (`subject_type`/`subject_id`) + ad-hoc payload ids (e.g. `payload.milestone_id`) | **EXTEND — the one structural gap.** Add a normalized side table `project_event_objects (event_id, object_type, object_id, role)` (OCEL-style); the existing subject remains the **primary** object (backward compatible; no rewrite of history) |
| 10 | `attributes` (payload) | `payload` (jsonb; envelope-duplication guarded) | **Reuse** |
| 11 | `schema_version` | `event_schema_version` | **Reuse** |
| 12 | **`capture_method`** (`direct\|mapped\|derived\|imported`) | Partially expressed via `event_lifecycle_class` (BUSINESS/SYSTEM/AI/DERIVED/EXTERNAL/SYNTHETIC_BACKFILL) + `provenance.backfilled` | **EXTEND (normalize):** `provenance.capture_method` with the four canonical values + a deterministic mapping to lifecycle class (direct→BUSINESS/SYSTEM live; mapped→BUSINESS from technical source; derived→DERIVED or SYNTHETIC_BACKFILL; imported→EXTERNAL/import) |
| 13 | `correlation_id` (recommended) | `correlation_id` (+ `saga_id`, `case_id` — extra, kept) | **Reuse** |
| 14 | `causation_event_id` (optional) | `caused_by uuid[]` (array — richer) | **Reuse** — with the PD-016 §5 rule: **recorded causality only, never inferred** |
| 15 | `evidence_refs` (per rule) | `provenance.evidenceRefs` — already **enforced for HIGH/CRITICAL** events (`requiresEvidence`) | **Reuse** (normalize shape: `{type, id, url?}`) |
| 16 | **`data_quality_flags`** | Only `confidence` (0–1) exists | **EXTEND:** `provenance.data_quality_flags: string[]` with the normalized vocabulary of §A.7 |

**PEG capabilities beyond the contract (kept, they strengthen it):** per-project
`sequence_number` (unique), tamper-evident `event_hash`/`previous_event_hash` chain,
`dedup_key` idempotency (unique partial index), compensating events
(`is_compensating_event`/`compensates_event_id`), importance + evidence enforcement,
retention classes, visibility/`permission_scope`, projection `invalidation_tags`,
`impact_*` columns.

**Verdict: 13/16 attributes reuse the PEG as-is; 3 are additive extensions (object_refs
side table, normalized capture_method, normalized quality flags). No second pipeline.**

## A.2 Command ≠ action ≠ state ≠ event (definitions, frozen)

| Concept | Definition | Example (pilot) | Lives in |
|---|---|---|---|
| **Command** | An *intent* to change something; can fail, be rejected, or be retried | "Close this risk" (button press, API call) | Application layer — **never** in the event log |
| **Action** | The *execution* of work by an actor; has duration, may produce several events | Executing the mitigation task | Tasks/actions records; summarized by events |
| **State** | The *current condition* of an object, derived from its history | `Open-Assessed` | Objects (today: `risks.status`); target: **reconstructed from events** |
| **Event** | An *immutable past fact* that occurred at a point in time | `risk_assessed` | `project_event_log` — append-only |

Rules: a command that fails produces **no** business event (optionally a SYSTEM_EVENT for
observability). A UI edit is a command; only its **semantic business effect** becomes an
event (§A.3). State is never written into the log as truth — `from_state`/`to_state` are
contextual snapshots, not owners.

## A.3 Taxonomy: business vs technical events

- **Business events** — past-tense business facts a PM recognizes (`risk_registered`,
  `risk_closed`). Only these feed the Process Mining Layer.
- **Technical events** — row updates, syncs, recalculations, logins. They stay out of the
  mining log or enter as SYSTEM_EVENTs excluded from process reconstruction.
- **Mapping rule:** a technical change enters the log only when a deterministic rule
  translates it into a semantic fact (e.g. linked task status→`in_progress` ⇒ derived
  `risk_response_started` **only** under the explicit rule of PD-016 event #11), with
  `capture_method=mapped|derived` and quality flags.
- **`record_updated` (generic) is forbidden** for mining (PD-016 §4). The PEG already
  enforces registry membership + past-tense naming (`validateProjectEvent`); the canonical
  registry will never define a generic update type.

## A.4 Naming & the PascalCase migration

**Canonical convention (frozen):** `snake_case`, noun + semantic past-tense verb, business
fact (never a UI action), one `event_schema_version` per type.

The current registry (`src/lib/events/registry.ts`, 96 types / 15 categories) uses
**PascalCase** — PD-016 divergence #4. Migration strategy (implemented in P2-T2):

1. **History is never rewritten** (immutability): existing rows keep their PascalCase
   `event_type`.
2. The registry adds the **canonical snake_case types for the risk pilot** (the 24 of
   PD-016) with a **read-time alias map** for the legacy risk types:
   `RiskIdentified → risk_registered` · `RiskEscalated → risk_escalated` ·
   `RiskMaterialized → risk_materialized` · `RiskClosed → risk_closed` ·
   `RiskMitigated → deprecated` (no canonical equivalent — PD-016 §12.4; no new emissions;
   projections map it conservatively to `risk_response_action_completed` with a
   `legacy_ambiguous_semantics` quality flag).
3. New emissions in the pilot use **only** snake_case canonical types.
4. Non-pilot domains (Task*, Milestone*, …) migrate per-module in their own phases — out of
   the pilot's scope.

## A.5 Temporal semantics

- **`occurred_at`** = business time (when the fact happened); **`recorded_at`** = log time.
  Both always stored (UTC, ISO-8601). Source-local timezone context, when known, goes in
  `provenance.source_timezone`.
- **Ordering:** the per-project `sequence_number` is the authoritative **log order**;
  business order is `occurred_at` and carries **ordering confidence** (§A.7) when events
  arrive late or share coarse timestamps.
- **Late registration** is legitimate (`recorded_at ≫ occurred_at`): allowed, flagged
  (`late_recorded`), never blocks ingestion.
- **Derived events** are marked (`capture_method=derived`, lifecycle DERIVED_EVENT or
  SYNTHETIC_BACKFILL_EVENT + `provenance.backfilled=true` + mandatory reduced `confidence` +
  `provenance.derivation_rule`) — the PEG already validates the backfill variant. Derived
  events are **never presented as direct facts** (RI-13).

## A.6 Event lifecycle rules

- **Immutability:** no UPDATE/DELETE on `project_event_log` — corrections are **compensating
  events** referencing the corrected `event_id` (`compensates_event_id`; existence of the
  prior event is verified — already implemented). Projections apply corrections; the
  original fact remains.
- **Idempotency:** stable `dedup_key` = hash(project, type, source module/entity,
  occurred_at, correlation, backfill-marker, payload-hash) with a unique partial index —
  re-emission returns the existing event (already implemented; frozen as contract).
  Compensating events are never deduped.
- **Tamper evidence:** per-project hash chain (`event_hash`/`previous_event_hash`) — kept.
- **Retention & archiving:** registry retention classes (e.g. AUDIT, LEARNING) govern
  minimum retention; pilot events default to AUDIT-grade retention. Physical archiving
  policy is deferred to operations (plan P10) — the contract only fixes: **archived ≠
  deleted**, and archived events remain reconstructable.

## A.7 Quality framework

- **Normalized `data_quality_flags` vocabulary** (extensible, versioned):
  `missing_actor` · `approximate_timestamp` · `late_recorded` · `derived` · `backfilled` ·
  `imported` · `single_source` · `ordering_uncertain` · `incomplete_payload` ·
  `unknown_reason` · `legacy_ambiguous_semantics` · `mapping_low_confidence`.
- **Per-event scoring:** flags + `confidence` position each event against the 10 quality
  dimensions of PD-016 §8.1 (completeness, timestamp validity, actor completeness, object
  linkage, semantic precision, source traceability, uniqueness, ordering confidence,
  historical coverage, model coverage).
- **Per-source/per-module scoring:** the **data-readiness score** aggregates dimension
  coverage over a module's event stream (0–1 per dimension + weighted global). Below a
  configurable threshold the module's analysis is declared **unavailable, not partial**
  (open question #6 of the baseline; guardrail: *no invented transitions* — a low score
  reduces claims, never fabricates data). Part B computes today's score for Risks (§B.3).

## A.8 Security

- **Tenant isolation:** `organization_id` NOT NULL + RLS on `project_event_log` (existing).
- **RBAC inheritance (RI-15):** analytical reads respect the boundaries of the **source
  objects** — an event about a risk is visible only to principals who can see that risk;
  `visibility` + `permission_scope` (existing columns) carry narrower scopes. Project
  isolation applies to all mining queries; aggregation views obey PO-10 / P10 (process — not
  surveillance: no individual rankings).

## A.9 Projection contract toward the Process Mining Layer

The PML **consumes**: the ordered event stream (+ sequence, hashes), `object_refs` with
roles, quality metadata (flags, confidence, readiness), and the reference models when they
exist. The PML **does NOT consume**: current-state tables (`risks.status`…), UI state, or
rollups — state is **reconstructed from events** per the PD-016 state machine. The Living
Graph projects events/relationships for navigation (LG = container/consumer — Constitution
§7; ADR-020 direction); Project Memory is **fed** by events (decision §0.6), remaining the
canonical per-project memory.

## A.10 Proposed resolutions of blocking open decisions — **approve individually**

> Etapa 2 explicitly deferred these to this stage. They are **proposals**: each becomes
> binding only with the Product Owner's approval, recorded inside PD-018. Non-blocking open
> decisions (#3–#8, #10) remain open — none blocks the envelope.

- **#1 — Escalated: state, facet, or event? → PROPOSED: event + facet, not a main state.**
  `risk_escalated` (event) sets an **escalation facet** (`escalated=true`, destination,
  reason) over whichever active state the risk is in; de-escalation is a compensating or
  explicit return event. *Why:* escalation coexists with any active state
  (Open-Assessed/Response-In-Progress/Monitoring) — modeling it as a 13th exclusive state
  forces false transitions; the P1-T3 hybrid case (C1) validated the facet reading. The
  12-state vocabulary is unchanged; "Escalated" in it is documented as facet-backed.
- **#2 — Reopened: persistent state or returning event? → PROPOSED: event that returns to an
  active state.** `risk_reopened` (reason_code + prior-closure reference, RI-07) returns the
  risk to **Open-Assessed** when a valid assessment exists, else **Open-Unassessed**;
  `reopened_count` is a derived attribute. *Why:* a state expresses *current condition* —
  "reopened" is a historical fact, not a condition; the P1-T3 construction case (B) walked
  exactly this path naturally. "Reopened" remains in the state table as a **transitory
  marker**, per its own frozen note ("transitory or event — open decision").
- **#11 — `risk_materialized_transferred`: own terminal event or closure reason? →
  PROPOSED: `risk_closed` with mandatory `closure_reason`, no 25th event.** `risk_closed`
  carries a required payload attribute `closure_reason ∈ {mitigated, avoided, accepted,
  expired, materialized_transferred}` (retirement and invalidation keep their own terminal
  events). *Why:* one closure event keeps RI-05 (request → validation → evidence) as a
  single uniform gate for every closure; mining segments by attribute; a separate terminal
  would fragment closure invariants and contradict the 24-event table. The boundary's
  `risk_materialized_transferred` is thereby interpreted as `risk_closed` +
  `closure_reason=materialized_transferred` (as exercised in P1-T3 Case A).

---

# Part B — Audit of current event sources (S3-T2, read-only)

Sources audited (all verified in-repo on 2026-07-11): `risks` DDL
(`20260708000000_universal_execution_model.sql` — **no `created_by`**, no history, status
overwritten); `audit_logs` (`20260617000000_create_audit_logs.sql` — scope: decisions,
documents, traceability_links, communication_items, action_items — **risks are NOT
audited**); `project_event_log` + `src/lib/events/*` (dual-write maps only
task/milestone/decision/communication node events; backfill covers
project/milestone/task/dependency/decision/document/drawing — **no risk emissions
anywhere**; the 5 PascalCase Risk* registry types have **no writers**); risk writers —
`import-intelligence/execute.ts` (+ `project_import_created_records` rollback trail,
`20260710000000`), `memory/scribe-actions.ts` (+ `project_scribe_items.created_entity_*`
chain, `20260805000000`/`20260810000000`), `execution/template-service.ts`,
`closeout/actions.ts` (bulk `status:"resolved"`); `drawing_insights` via
`risks.source_insight_id`; task events in the PEG for linked tasks; `task-activity.ts`
(REG-010 blocker semantics).

## B.1 Matrix — the 24 canonical events

Classes: **Available** (fact recorded today with sufficient semantics → map) ·
**Reconstructable** (derivable with documented confidence → derived backfill + flags) ·
**Missing** (no trace; state overwritten → forward capture only, no invented
reconstruction).

| # | Canonical event | Class | Concrete source (verified) | Confidence | RI verifiability today |
|---|---|---|---|---|---|
| 1 | `risk_signal_detected` | **Reconstructable (partial)** | Only for drawing-origin risks: `risks.source_insight_id` → `drawing_insights` row (created_at, evidence). Other origins: no signal concept | Medium (DI-origin only) | — |
| 2 | `risk_registered` | **Available (mapped)** | `risks` row: `created_at` + `origin` + `organization_id`/`project_id`. Actor: **absent on the table** (no `created_by`); recoverable for Scribe-origin (`project_scribe_items.created_entity_*` + capture actor) and import-origin (`project_import_created_records` + job actor) | High (fact/time) · Low (actor for manual/template) | RI-01 ✓ (NOT NULL org/project) |
| 3 | `risk_classified` | **Reconstructable (low)** | Current `category`/`severity` values only — initial vs later-changed indistinguishable (`updated_at` is a single overwritten timestamp) | Low; changes: Missing | — |
| 4 | `risk_assessed` | **Missing** (as event) | `probability`/`impact`/`severity` exist but DB defaults (`medium`) make assessed vs unassessed **indistinguishable** (PD-016 §12.3); no method, no date | — | RI-02 ✗ (method/date/values unverifiable) |
| 5 | `risk_assessment_revised` | **Missing** | Values overwritten in place; no assessment history | — | RI-08 ✗ |
| 6 | `risk_owner_assigned` | **Reconstructable (low)** | `owner_user_id` (current value only); assignment moment unknown (`updated_at` approximate) → flags `approximate_timestamp` | Low | RI-03 ✗ (creator unknown — no `created_by` to compare) |
| 7 | `risk_owner_changed` | **Missing** | No ownership history | — | — |
| 8 | `risk_response_strategy_selected` | **Missing** | No strategy field; `mitigation_plan` is free text (presence ≠ strategy taxonomy) | — | — |
| 9 | `risk_response_plan_approved` | **Missing** | No decision linkage from risks (PD-016 §12.8) | — | RI-04 ✗ |
| 10 | `risk_response_action_created` | **Reconstructable (medium)** | `risks.linked_task_id` → `roadmap_tasks.created_at` (+ `TaskCreated` backfill events in PEG) | Medium (single-task limit) | — |
| 11 | `risk_response_started` | **Reconstructable (medium, derived)** | Linked task's `TaskStatusChanged`→in-progress in `project_event_log` (live dual-write). Historical: **not reconstructable** — the backfill deliberately does NOT invent TaskStarted (`backfill.test.ts`) | Medium (live-era only) | RI-13 ✓ (derived is marked) |
| 12 | `risk_response_action_completed` | **Reconstructable (medium)** | Linked task `TaskCompleted` (backfill from `status=done`; live dual-write) | Medium | RI-09 enforceable in projection |
| 13 | `risk_review_completed` | **Missing** | No review records linked to risks (meetings exist but are not linked) | — | — |
| 14 | `risk_trigger_detected` | **Missing** | No trigger concept | — | — |
| 15 | `risk_escalated` | **Missing** | No escalation data; registry type `RiskEscalated` exists but is **never emitted** | — | — |
| 16 | `risk_materialized` | **Missing** | No `materialized` status; **no Issue/Blocker entity** to link (CAP-018; PD-016 §12.5) | — | RI-06 ✗ |
| 17 | `risk_residual_assessed` | **Missing** | No residual concept | — | — |
| 18 | `risk_closure_requested` | **Missing** | No closure request record | — | — |
| 19 | `risk_closure_validated` | **Missing** | No validation record | — | RI-05 ✗ |
| 20 | `risk_closed` | **Reconstructable (low–medium)** | `status ∈ {resolved, closed}` + `updated_at` (approximate moment); closure reason unknown (`unknown_reason`); Closeout **bulk-resolve** batches identifiable only circumstantially | Low–Medium | RI-05 ✗ retroactively |
| 21 | `risk_reopened` | **Missing** | A closed→open overwrite leaves no trace | — | RI-07 ✗ |
| 22 | `risk_retired` | **Missing** | `deleted_at` conflates retired / invalidated / plain deletion (PD-016 §12.11) | — | — |
| 23 | `risk_invalidated` | **Missing** | Same conflation; no reason codes | — | RI-11 ✗ |
| 24 | `risk_linked_object_changed` | **Missing** | `linked_task_id`/`linked_milestone_id` overwritten in place | — | — |

**Tally: 1 Available · 6 Reconstructable (1 partial, 2 low, 3 medium) · 17 Missing.**
This **empirically answers open decision #9**: reconstruction from existing data covers only
registration, the response trail via linked-task events, and approximate closures — all
other events must be **captured going forward**.

## B.2 What today's sources can support (per invariant)

Verifiable now: **RI-01** (structure), **RI-12** (import trail exists), **RI-13** (PEG marks
derived/backfill), **RI-15** (RLS structure). Enforceable forward, unverifiable
retroactively: RI-02, RI-04, RI-05, RI-07, RI-08, RI-09, RI-10. Blocked by missing entities:
RI-06 (needs the Issue/Blocker materialization target — CAP-018 or an interim Phase 2
decision).

## B.3 Data-readiness score — Risks module (today)

Scored on the 10 dimensions of PD-016 §8.1 (0–1, honest):

| Dimension | Score | Basis |
|---|---|---|
| Completeness | 0.25 | 7/24 events with any trace |
| Timestamp validity | 0.45 | `created_at` solid; everything else `updated_at`-approximate |
| Actor completeness | 0.20 | No `created_by` on risks; Scribe/import chains partially recover actors |
| Object linkage | 0.45 | project/milestone/task single FKs; no roles, no multi-object |
| Semantic precision | 0.25 | 5 conflated statuses; `resolved` non-canonical; strategy-as-state |
| Source traceability | 0.70 | **Strongest dimension**: `origin`/`confidence_score`/`evidence_json` + Scribe/import provenance chains (PD-012) |
| Uniqueness | 0.90 | PK-backed records; no duplicate-event risk (no events yet) |
| Ordering confidence | 0.20 | Single overwritten timestamps |
| Historical coverage | 0.20 | Transitions unrecoverable for all pre-existing risks |
| Model coverage | 0.10 | No Process Model entity (PD-017 D3.2) — conformance impossible |
| **Global (weighted)** | **≈ 0.30 — LOW** | Partial analyses only; several analyses must be declared **unavailable** rather than partial (guardrail: no invented transitions) |

## B.4 Minimum events P2-T2 must capture (pilot scope — "only what the first pilot needs")

Priority list, driven by the pilot's analytical questions (PD-016 §8: timeliness, ownership,
closure quality, reopen rate) and the invariants they unlock:

**Direct capture (new emissions from the risks writers):**
1. `risk_registered` — with real actor (fixes the missing-actor gap at the source)
2. `risk_assessed` — method + values + date (unlocks RI-02, Time-to-assess, real
   Open-Unassessed detection)
3. `risk_owner_assigned` / `risk_owner_changed` — ownership questions, RI-03
4. `risk_response_plan_approved` — with optional decision ref (RI-04, Time-to-approved-response)
5. `risk_closure_requested` · `risk_closure_validated` · `risk_closed` (with
   `closure_reason`) — the RI-05 closure gate + closure-quality metrics
6. `risk_reopened` — reason_code + prior-closure ref (RI-07, reopen rate)
7. `risk_materialized` — interim materialization target per CAP-018 status (records the
   fact + impact even while the Blocker entity is pending)

**Derived (no new capture — mapped from existing PEG task events under explicit rules):**
8. `risk_response_action_created` / `risk_response_started` /
   `risk_response_action_completed` — from linked-task events (`capture_method=derived`).

**Deferred (not needed for the first pilot loop):** `risk_signal_detected`,
`risk_classified` (changes), `risk_trigger_detected`, `risk_review_completed`,
`risk_residual_assessed`, `risk_escalated`, `risk_retired`/`risk_invalidated` (captured when
their UI/flows exist), `risk_linked_object_changed`.

## B.5 Historical risks & limitations (H7 verdict)

**H7 is confirmed, with nuance.** The current history supports: honest backfill of
`risk_registered` (high confidence), the response trail where `linked_task_id` + task
events exist (medium), and approximate closures (low, reason unknown). It does **not**
support reconstruction of assessments, ownership changes, escalations, reopenings,
validations, or materializations — and per the frozen guardrail these are **never
invented**: pre-pilot risks will show partial trajectories with explicit
`data_quality_flags`, and metrics over the pre-capture era must disclose reduced coverage
(data-readiness §B.3). The pilot's real analytical value starts at forward-capture
activation (P2-T2), exactly as the baseline anticipated ("capture only the events the first
pilot requires").

---

## Implementation record

| Field | Value |
|---|---|
| **P2-T2 implemented** | 2026-07-12 — minimum event capture (PR `feat/p2-t2-risk-event-capture`) |
| **Feature flag** | `RISK_EVENT_CAPTURE_PROJECT_IDS` (env, server-evaluated, per-project list; **default OFF — unset in production**). Flag off ⇒ risk writers behave byte-identically to pre-P2-T2. |
| **Migration** | `20260844000000_project_event_objects.sql` — the single additive table (`project_event_objects`, RLS mirroring `project_event_log`). No columns added to `risks`. |
| **Registry** | 13 canonical snake_case pilot types (10 direct + 3 derived) with RI-enforcing `requiredPayload`; 5 legacy PascalCase types **deprecated for new emissions** with the read-time alias map (`resolveCanonicalEventType`); `CLOSURE_REASONS`, `CAPTURE_METHODS`, `DATA_QUALITY_FLAGS` vocabularies; `isPastTenseName` extended to snake_case. |
| **Writers instrumented** | Scribe (`memory/scribe-actions.ts`), Import (`import-intelligence/execute.ts`), Template (`execution/template-service.ts`) → `risk_registered`; Closeout (`closeout/actions.ts`) → `risk_closed` (+ the three affordance actions). All flag-gated fire-and-forget through the single PEG gateway. |
| **Affordances (the only three, flag-gated)** | Closure-reason select · explicit **Assess** confirmation (method + current values → `risk_assessed`) · **Materialize/Reopen** panels — all inline on the Closeout risk lines (the only risk action surface today, REG-017 precedent). |
| **Derived trail** | Ingestion-gateway hook (live task events only, never backfill) → `risk-derived-bridge.ts`: `TaskCreated/TaskStatusChanged(→in_progress)/TaskCompleted` on `risks.linked_task_id` → the three `risk_response_*` events with `capture_method=derived`, reduced confidence, recorded causation. RI-09 by construction. |
| **Backfill** | `mapRiskToEvents` — `risk_registered` only (flag-gated scanner); actor recovered exclusively via Scribe/import chains, otherwise `missing_actor`; idempotent (dedup + backfill marker). **No other reconstruction.** |
| **Tests** | 75 new (flag boundary, payload invariants RI-02/RI-07/#11, deprecation + aliases, builders/flags, derived mapping + RI-09, backfill guards); 2 existing ingestion tests deliberately migrated from the deprecated `RiskIdentified` to canonical `risk_registered` (same intent: HIGH-evidence gate). Suite: 171 files / 1908 tests green. |

## C. What this document is NOT

No code, no migrations, no triggers/listeners, no UI. The audit was strictly read-only.
P2-T2 implements **only** what this contract specifies, only after approval, and only the
minimum capture list (§B.4). Project Memory remains fed, never replaced (§0.6). Open
decisions #3–#8 and #10 remain open.

## D. Links

[CAP-045 baseline](CAP-045-process-mining-layer-foundation-baseline.md) ·
[CAP-045 ontology](CAP-045-process-mining-layer-ontology-risk-to-resolution.md) (§4, §6,
§8.1, §11, §12) ·
[CAP-045 platform map](CAP-045-process-mining-layer-platform-map-and-validation.md) (D3.1
layer 4) · [00-product-constitution.md](../00-product-constitution.md) (§4 PEG) ·
[12-living-graph-strategy.md](../12-living-graph-strategy.md) ·
[10-regression-log.md](../10-regression-log.md) (REG-010) ·
[30-product-decision-log.md](../30-product-decision-log.md) (PD-015…PD-018) ·
[00-index.md](../00-index.md)

## E. Last reviewed

2026-07-11 — created (P2-T1, docs-only, read-only audit) and **approved by the Product Owner
in-session the same day**, including the §A.10 resolutions of open decisions #1, #2, and #11
(see Approval block). **P2-T2 — Implement minimum event capture is authorized** over this
contract only.

---

## F. Extension — Living Graph consumes the canonical event store as a projection (2026-07-12)

This section registers an **extension** of the approved CAP-045 contract (no
decision in §A is changed). It records how the Living Graph adds an "events"
view that is a **read-only projection** over the canonical event store — and the
binding semantic separation between temporal adjacency and explicit causality.

### F.1 What the Living Graph consumes

The Living Graph already renders an **operational projection**
(`process_nodes` / `process_edges`). The new "events" view adds a **second,
independent projection** built from the canonical event store:

```
Canonical Event Store ──► Event Relationship Projection ──► LivingGraphData ──► Living Graph events view
(project_event_log +       (pure, in-memory, read-only)       (canonicalEvents +       (React Flow nodes/
 project_event_objects)                                       eventRelationships)       edges, flag-gated)
```

- `project_event_log` remains the **canonical, append-only source of truth**.
- `project_event_objects` supplies the event↔object relationships.
- The projection is **pure and in-memory** (`src/lib/graph/event-relationship-projection.ts`):
  no Supabase, no I/O, no mutation of inputs, deterministic ids. It is **never
  persisted** — there is no second event store and no copy of events into
  `process_nodes` / `process_edges`.
- The loader (`src/lib/graph/event-relationship-loader.ts`) reads through the
  **authenticated, RLS-governed client** scoped by `organization_id` +
  `project_id`; it **never constructs an admin/service-role client** for an
  ordinary read. The read is bounded by an explicit documented limit and reports
  truncation (never silently truncated).

### F.2 Temporal adjacency ≠ causality (binding)

This is the core semantic rule of the extension, and it is enforced in code:

- **Temporal relationships** (`project_sequence_next`, `object_sequence_next`)
  encode **ORDER ONLY**. They are `evidence = deterministic_projection`.
- **Causal relationships** (`caused_by`) are emitted **ONLY when the source
  explicitly recorded them** in `project_event_log.caused_by`. They are
  `evidence = explicit`.
- **Compensation** (`compensates`) is emitted **ONLY when
  `is_compensating_event` + `compensates_event_id` are recorded**. `evidence = explicit`.
- **We NEVER infer causality from temporal proximity.** Two adjacent events with
  no recorded `caused_by` produce a **temporal** edge only, never a causal one.
  The `evidence` field on every relationship is the audit trail that proves this.
- **Nothing is invented**: no events, actors, causes, confidence, or data-quality
  flags are synthesized. Fields absent from the log stay null/empty. The
  `late_recorded` flag is derived from the **recorded** `occurred_at` /
  `recorded_at` values only — it is never recalculated or invented.

### F.3 Isolation from the operational analyses (binding)

The event-relationship layer is **isolated by construction** from the operational
analyses the Living Graph already runs (critical path, bottleneck, cycle
detection, milestone metrics, task/blocker counts, workforce/labor capacity,
readiness, variance, simulation). Three discrimination helpers enforce it:

- `isExecutionRelationship(edge)` — true for a `process_edges`-sourced edge
  (carries `edgeType`, never `relationshipClass`).
- `isTemporalRelationship(rel)` — true for an event relationship (carries
  `relationshipClass`, never `edgeType`).
- `isCanonicalEventNode(node)` — true for a canonical-event node (carries
  `eventId`, never an operational `nodeType`).

Operational analyses run over `process_nodes` / `process_edges` **only**. The
event layer feeds **only** the "events" view (and a future timeline overlay that
declares it supports canonical events). Milestones and activities views are
**untouched** — the three projections coexist.

### F.4 Feature flag

`LIVING_GRAPH_EVENT_RELATIONSHIPS_PROJECT_IDS` (server-side, **default OFF**,
CSV of project IDs or `all`). **Independent** of `RISK_EVENT_CAPTURE_PROJECT_IDS`
— capturing events and rendering them as a graph projection are two separate
concerns. Flag OFF ⇒ the Living Graph is **byte-identical** to before: the
"events" view keeps its current timeline/process behavior, no canonical-events
view, no event-relationship edges, no new controls. The flag gates only the
read-only projection; it never gates event capture and never writes to the log.

### F.5 What this extension does NOT do

No new tables, no migrations, no writes to `project_event_log` /
`project_event_objects` / `process_nodes` / `process_edges`, no backfill, no
Process Mining metrics / Variant Analysis / Root Cause Miner, no new UI outside
the Living Graph, no change to RI-05, no enabling of `risk_closed`, no redesign of
the event store, no change to any approved §A decision.

### F.6 Regression protection

Row `LG-EVENT-RELATIONSHIPS / CAP-045 §C` in
[regression-test-map.md](../regression-test-map.md), protected by:
`src/lib/graph/__tests__/event-relationship-projection.test.ts` (projection
contract, 13 cases), `src/lib/graph/__tests__/event-relationships-view.test.ts`
(flag + discrimination + analysis isolation), and
`src/lib/graph/__tests__/event-relationship-loader.test.ts` (read-scope +
no-admin-client). CI green (typecheck + `test:run` + build).
