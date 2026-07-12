# CAP-046 — Project Intelligence Engine (Variants · Root Cause Miner · KPI Engine)

> Three analytical features ordered by the Product Owner (2026-07-11, in-session):
> **F1 Execution Variant Analysis**, **F2 Root Cause Miner**, **F3 KPI Calculation
> Engine** — reconciled with the frozen canonical event contract (PD-018) so they
> **consume the existing Project Event Graph** and never create a parallel event
> pipeline. An external research plan proposing a new `event_log` table + DB
> triggers + Python microservice was reviewed and **rejected as-written** (it
> conflicted with PD-018 §A.1 "one pipeline", the object-centric model §0.4, and
> the business-event taxonomy §A.3); its salvageable methodology (variant metrics,
> influence scoring, expression sandboxing) is adopted here in contract-compliant
> form.
>
> **Capability:** CAP-046 ([registry](../05-capability-registry.md)) · **Decision:**
> [PD-019](../30-product-decision-log.md).

---

## Approval block

| Field | Value |
|---|---|
| **Approval status** | ✅ **Approved** |
| **Approver** | Efrain Prada — Product Owner |
| **Approval date** | 2026-07-11 (ordered in-session: "vamos a realizar estas 3 nuevas features, las necesito ya") |
| **Effect** | Implementation of F1/F2/F3 is authorized under the architecture rules below. PD-018 remains untouched; P2-T2 remains the next Process Mining Layer plan task and is **not** displaced by this capability. |

## Conflict review (pre-implementation, 2026-07-11)

Verified against the live repo before any code:

- **Open PRs:** only #134 (dev-only GitHub Intelligence visual harness) — no overlap.
- **Phase 5 Isabella root cause** (`src/lib/isabella/root-cause/`, merged): qualitative,
  conservative, evidence-chain engine. **F2 complements it with a statistical layer and
  never replaces it** (CLAUDE.md rule 5 — consolidate, don't fork).
- **P2-T2 (risk event capture):** no conflict — F1/F2/F3 read whatever business events the
  PEG holds; when P2-T2 adds risk events they are absorbed with zero changes here.
- **MPF Engine** (`src/lib/milestone-flow/`): milestone-level transition analytics; F1
  operates at whole-case sequence level over the same event source — distinct layer,
  same single source of events.
- **KPI dictionary** (`src/lib/reports/kpi-dictionary.ts`): pure metadata; F3 uses it as
  seed catalog, does not duplicate it.

## Architecture rules (binding)

1. **Event source = `project_event_log` (PEG) only.** No new event table, no DB triggers,
   no second ingestion path (PD-018 §A.1). Readers follow the MPF read-only adapter
   pattern (`src/lib/milestone-flow-ui/load-projection.ts`): RLS-scoped client,
   deny-by-default tenant validation, SELECT only.
2. **Engines are pure, deterministic TypeScript** under `src/lib/process-mining/` (F1, F2)
   and `src/lib/kpi/` (F3). No Python microservice at current scale; PM4Py/FastAPI is
   recorded as **Future Research** with an explicit trigger (event volume or algorithmic
   need — e.g. inductive miner / conformance alignments — beyond deterministic TS).
3. **Only BUSINESS_EVENT lifecycle-class events feed mining** (PD-018 §A.3). Derived and
   compensating events are respected per contract semantics (never counted as direct
   facts; compensations excluded from sequences).
4. **Case framing (F1):** the pilot process type `project_lifecycle` uses the project as
   the case object — a real domain object, not an artificial case id; the engine is
   written against a generic `caseId` so future object-centric framings (per-risk,
   per-milestone) reuse it unchanged (PD-018 §0.4 compatible).
5. **F2 emits evidence only — never recommendations** (roadmap requirement; mirrors the
   Isabella root-cause engine's conservatism). Findings carry influence score, sample
   size, confidence, and concrete case references. No individual-person rankings
   (process — not surveillance, PO-10).
6. **F3 never evaluates user expressions with `eval`/`new Function`.** Sandboxed
   expression parsing (`expr-eval`) + function/variable allow-list + AST validation.
   Statistical functions are pure TS over allow-listed datasets. NL-to-KPI goes through
   structured output validated against the same allow-list before persisting.
7. **RBAC:** analytical reads inherit source-object boundaries (PD-018 §A.8 / RI-15);
   org from auth context, never from the request body.
8. **i18n:** all user-facing surfaces ship EN + ES keys (UX-012).

## Feature scope

### F1 — Execution Variant Analysis (`src/lib/process-mining/variants/`)
Discover real execution paths from PEG business events: variant discovery (unique
activity sequences per case), frequency, avg/median case duration, rework rate
(events − unique activities), success semantics, reference (most successful) variant,
per-project assignment + deviations vs reference (skipped/inserted activities).

### F2 — Root Cause Miner (`src/lib/process-mining/root-cause/`)
Statistical layer over canonical data: dimensions (owner, milestone, category/type,
phase) × problem types (delay, blockage, rework). Rate-ratio + correlation + coverage →
**Influence Score (0–100)** with confidence gated by sample size. Output feeds Isabella
and UI as evidence packets; hands off to the qualitative engine, never contradicts it
silently.

### F3 — KPI Calculation Engine (`src/lib/kpi/`)
Single-definition KPI layer: `kpi_definitions` (org-scoped, versioned) + safe expression
evaluation with SUM, AVG, COUNT, MEDIAN, PERCENTILE, CORRELATION, TREND,
MOVING_AVERAGE, FORECAST (linear) over registered datasets; seeded from the reports KPI
dictionary; reusable by dashboards, alerts, Isabella, reports. NL-to-KPI as a validated
translation step.

## Non-goals (this capability)
No second event pipeline · no Postgres partitioning yet (revisit ≥50M event rows) · no
Python/PM4Py service · no automatic recommendations in F2 · no auto-created alerts ·
no modification of PD-016/PD-018 vocabulary or of the Process Mining Layer plan sequence.

## Links
[PD-018 event contract](CAP-045-canonical-event-contract-and-source-audit.md) ·
[30-product-decision-log.md](../30-product-decision-log.md) ·
[milestone-process-flow-engine-architecture.md](../milestone-process-flow-engine-architecture.md) ·
[isabella-root-cause-constraint-analysis-engine.md](../isabella-root-cause-constraint-analysis-engine.md) ·
[18-execution-status-engine.md](../18-execution-status-engine.md) (REG-010 metric source rules)

## Last reviewed
2026-07-11 — created with the PO's in-session authorization; F1 implementation started
the same day.
