# CAP-049 — PMO Simulation Foundation V1

**Status:** In production (2026-07-26, PR #213, `a4a9173`) · **Flag:** `PMO_LIVING_GRAPH_ENABLED`
**Surface:** `/[locale]/(app)/pmo-living-graph` → What-if lens · **Access:** role ∈ {owner, admin}
**Tables:** `pmo_simulation_scenarios`, `pmo_simulation_runs` (migration `20260862000000`)

A multivariable scenario builder on the PMO Portfolio Living Graph. It replaces
the uniform-slider what-if with four typed intervention kinds over a
deterministic engine, and it answers a question the two existing dashboards
cannot: *if we change these things at once, what moves — and how do we know?*

---

## 1. The rule that governs everything else

A scenario is a **question about** the portfolio, never an instruction **to** it.

Saving or running one must not move a single task, risk, budget line or
allocation. That guarantee is structural, not procedural:

- nothing in the schema references an operational row in a writable direction;
- intervention targets are ids inside JSONB, resolved read-only by the engine, so
  no foreign key can cascade a change outward;
- there is no "apply to project" path in V1, in the schema or in the code.

`src/lib/pmo-simulation/read-model.server.ts` is the only module that talks to
Supabase, and its sole writes target `pmo_simulation_*`.

---

## 2. Two invariants encoded in the types

Both live in `contracts.ts` rather than in prose, because a convention that
exists only in a comment eventually gets violated.

### 2.1 Units never mix

`SimMetric` carries its own `unit`, and there is no arithmetic in the module that
adds a value of one unit to a value of another. A "total impact" figure silently
combining $50,000 with 12 days is the single most dangerous artefact a simulator
can put in front of a PMO — it is confidently wrong and looks authoritative.

Risk exposure is therefore aggregated **per unit**: `risk_exposure_cost` and
`risk_exposure_days` are two metrics, never one.

### 2.2 Every number states its origin

| Provenance | Meaning |
|---|---|
| `OBSERVED` | Read from a canonical row |
| `ASSUMED` | The user typed it into the intervention. Never written to the domain |
| `DERIVED_PROXY` | Derived by a deterministic, traceable rule from linked records |
| `UNAVAILABLE` | Genuinely not knowable. **Never a zero** |

`UNAVAILABLE` is a first-class outcome, not an error. The UI renders
"Data unavailable"; the export writes those words rather than an empty cell,
because an empty cell in a numeric column is read as zero by whoever sums it next.

---

## 3. Risk exposure — the hybrid policy

`public.risks` has neither a cost column nor a delay column, and V1 deliberately
adds none: a simulation input is not a domain fact, and promoting one would turn
a single person's guess into everyone else's data.

Resolution order, per `risk-exposure.ts`:

1. **`ASSUMED`** — the figures the user typed on the intervention
   (`assumedCostImpact`, `assumedDelayDays`), stored on the intervention and
   never written back to `risks`.
2. **`DERIVED_PROXY`** — a traceable walk over linked tasks, remaining budget and
   CPM float, explicitly labelled as a proxy.
3. **`UNAVAILABLE`** — when neither is possible.

Qualitative severity is **never** mapped to dollars or days. That mapping is
fiction with a decimal point.

---

## 4. Calculation order, and the two deviations

```
0. Baseline CPM ......... FIRST, before any mutation
1. Validate ............. resolve targets, detect contradictions
2. Apply in order ....... budget → resource → schedule → risk
3. Finance (EVM) ........ from the mutated budget lines
4. Capacity ............. from the mutated allocations
5. Schedule (CPM) ....... ONE re-run over the fully-mutated task copy
6. Risk ................. needs the baseline float from step 0
7. Aggregate ............ metrics, chains, coverage
```

**The baseline CPM runs before everything.** Risk day-exposure derives from a
task's float, and float measured on the already-modified schedule would describe
the scenario rather than what the scenario is compared against — measuring the
ruler after bending it.

**The CPM runs once**, after every schedule edit is in place. Re-running per
intervention would let two delays on the same dependency chain each claim the
downstream slip they jointly caused: textbook double counting.

### Hard rules

- **Money never buys time.** A budget increase never shortens a duration. There
  is no crash-cost model and no evidence in this database that money buys time on
  these projects; inferring the link would be the simulator inventing a causal law.
- **Schedule propagation goes only through real `task_dependencies` edges**, by
  re-running the shared `calculateCriticalPath` over a modified copy.
  `recalculateCriticalPath` is deliberately not used — it writes to the database.
- **A resource change touches only genuinely linked tasks.** A resource with no
  linked work produces an explicit "no linked work" outcome, not a portfolio ripple.

---

## 5. Orchestration, not recomputation (ADR-012)

Every engine is the one the product already owns:

| Concern | Reused from |
|---|---|
| Critical path | `lib/execution/critical-path.ts` (pure `calculateCriticalPath`) |
| EVM / forecasts | `lib/financial/calculations.ts` |
| Capacity | the generic hours engine |

CPI, EAC and VAC have exactly one definition in this product. A second one living
in the simulator would eventually disagree with the finance screens on the same
project.

The two capacity engines — generic (hours) and labor/construction (headcount) —
stay separate and labelled. They are never summed.

---

## 6. Earned value has a source

`financial_measurement_snapshots` stores BAC, PV, EV and AC per project per data
date. The simulation read model originally omitted that table and hard-coded
`ev: null`, so every forecast reported "unavailable" even for projects with a
perfectly good measurement on file.

Two rules now govern the read:

- **BAC always comes from the budget lines**, because BAC is what a budget
  intervention *moves*. Read from a snapshot it would freeze at the reporting
  date and the simulated column would never differ from the baseline one.
- **EV and AC travel together** from one reading. Pairing an EV measured at a data
  date with an AC summed from today's budget lines yields a CPI that describes
  neither moment.

A snapshot whose `quality_status` the financial module already flagged as
unusable is not trusted: that is the same "unavailable" wearing a number.

The engine reports which EAC variant it used (`formulaId`), so the glossary can
say *this is the formula the engine used* instead of showing a default it cannot
vouch for.

---

## 7. What the surface must do

| Behaviour | Why |
|---|---|
| A non-computable intervention is **kept** and explained | An intervention that disappears from the results reads as one that had no effect |
| The Run button blocks while any enabled intervention has no target | A target-less intervention is dropped by the parser, so the run would report a result computed from zero interventions while the form still showed one |
| Contradictions are surfaced, not resolved by order | Applying both and keeping the last is internally consistent and quietly wrong |
| Targets are grouped by project | Milestone names collide across projects; a flat list asks the user to aim at an entity they cannot identify |
| More than one scenario, switchable | Comparing options is the entire activity |
| A stored result is read, never recomputed on open | Re-running would measure against today's baseline while the user believes they are looking at what they saved |
| Results expand and export (Excel / CSV / PDF) | A scenario confined to a 320px rail cannot go into a steering committee |

---

## 8. Executable guards

| Guard | Protects |
|---|---|
| `PMO-SIM-NO-SILENT-DROP` | A target-less intervention blocks the run instead of vanishing |
| `PMO-SIM-EVM-SOURCE` | EV read from the measurement table; BAC still moves; EV and AC paired |
| `PMO-SIM-FORMULA-REPORTED` | The engine reports which EAC formula it used |
| `PMO-SIM-MULTIPLE-SCENARIOS` | New/open transitions clear the result **and** the canvas |
| `PMO-SIM-EXPORT-KEEPS-PROVENANCE` | Missing values export as words; provenance survives export |
| `PMO-SIM-TARGETS-GROUPED-BY-PROJECT` | The picker attributes every entity to its project |
| `PMO-SIM-NO-RAW-ERROR-CODES` | Action errors are translated, and the cause is logged server-side |

See [`regression-test-map.md`](../regression-test-map.md).

---

## 9. Security

- Every server action is gated independently by `canAccessPmoLivingGraph`. A route
  gate is not an action gate: a server action reachable from a client bundle is a
  second door into the same data.
- The organization **always** comes from the session. No action accepts an
  organization id from the caller.
- RLS via `is_org_member` on both tables, plus DB triggers that reject a scenario
  whose `project_ids` reach outside its organization — verified functionally in
  production, not merely by the trigger's existence.

---

## 10. Known gaps

- **No "apply to project"**, by design. Promoting a scenario to reality is a
  separate capability with its own approval semantics.
- **Scope is the whole portfolio.** The scope field is shown disabled rather than
  hidden, so the scope of an answer is never a guess. Narrowing it is a design
  decision, not a filter.
- **`confidence` renders but nothing computes it.**
- Acronym component tests are logic-only — no jsdom render test for Escape/touch.
