# CAP-047 — PMO Process Intelligence Command Center

**Status:** In progress (M1 closed) · **Priority:** P1 · **Flag:** `PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED` (server-side, default OFF)
**Source of truth:** `Project360` spec *PMO Process Intelligence Module Specification v1* (2026-07-23) + Autonomous Master Prompt. This doc freezes the approved scope (M1-T1) and records the binding governance for the autonomous build.

## 1. Vision (frozen)

An executive, data-first PMO dashboard based on process mining. It explains **how work actually flows** across the portfolio: dominant paths, variants, rework, waiting, bottlenecks, financial deviation (EVM), risk propagation, capacity pressure, dependencies and benefits — with Isabella as an evidence-backed virtual PMO director and non-persistent What-if simulation. Professional, light, legible, analytical. **Not a video game**: no galaxies, decorative 3D, particles, neon overload or cinematic effects.

## 2. Non-destructive coexistence (binding — dashboard protection strategy)

- The current **PMO Command Center** (`src/app/[locale]/(app)/page.tsx`, service `src/lib/command-center/service.ts`) remains **fully intact and the default view**. It is a protected surface for this project: no replace/rename/refactor of its behavior.
- The ONLY approved integration point is the smallest safe change inside its `Header()` (page.tsx ~L401-421): a **Current Dashboard | Process Intelligence Beta** switcher, rendered only when `canAccessProcessIntelligence(role)` is true (flag ON **and** role owner/admin).
- The new module lives in an **independent route**: `/[locale]/(app)/process-intelligence` (org-level, matching the org-level scope of the current dashboard — there is no portfolio/program entity today). Lazily loaded; separate components; no destructive shared state. Switching preserves organization + locale + compatible filters; returning is one click.
- Default change to the new dashboard requires UAT + comparison + formal PMO approval — explicitly out of this project.

## 3. In scope / Out of scope (frozen)

**In scope:** process map (discovery/variants/rework/bottlenecks/drill-down org→project→milestone), executive KPI bar, Financial Intelligence & Budget Command Center (baseline/committed/actual/accrued/ETC/EAC/VAC/contingency + full EVM), risk/capacity/dependency/benefit/strategy overlays, Isabella evidence-backed recommendations + governed learning stream, non-persistent What-if, realtime incremental updates, responsive + accessible + tabular fallback, RLS/RBAC tenant safety.

**Out of scope:** modifying the Living Graph; autonomous financial postings; ERP replacement; production deploy/merge/push or flag activation; generalized refactors; unapproved AI actions; unrelated PM modules; making the new dashboard default; automatic model fine-tuning; portfolio/program schema (org-level only in v1).

## 4. Architectural chain (binding)

`Canonical Source of Truth → Project Event Graph (project_event_log) → Projection/engines → Process Intelligence read models → PMO Decision Center UI → Isabella Intelligence`.
Presentational components never query arbitrary tables: they consume typed read models/adapters under `src/lib/pmo-process-intelligence/`. **Reuse before build** (M1-T2 inventory, 2026-07-23):

| Reused as-is (pure) | Where |
|---|---|
| Variant discovery `analyzeVariants` + `sequenceFitness` | `src/lib/process-mining/variants/engine.ts` |
| CPM `calculateCriticalPath` (FS/SS/SF/FF + lag + constraints) | `src/lib/execution/critical-path.ts` |
| `analyzeBetween` (temporal≠causal, evidence chronology) | `src/lib/graph/between-analysis.ts` |
| KPI engine + catalog | `src/lib/kpi/` |
| Root Cause engine | `src/lib/isabella/root-cause/engine.ts` |
| EVM `computeEvmSnapshot` + deterministic forecasts (PV/EV/AC/CV/SV/CPI/SPI/ETC/EAC/BAC/VAC) | `src/lib/financial/calculations.ts` |
| Capacity formulas | `src/lib/capacity/formulas.ts` |
| Graph traversal `buildAdjacency`/`collectReachable` | `src/lib/graph/living-graph-analysis.ts` |
| Realtime signature `computeGraphSignature` | `src/lib/living-graph-realtime-ui/signature.ts` |
| Knowledge OS (packages/versions/localizations/chunks, tiers) | `src/lib/knowledge-os/`, migrations 20260814/15 |
| Financial cockpit projection | `financial_project_cockpit` (migration 20260859) |

**Known gaps to build (orthogonally, never by duplicating):** cross-project (portfolio-level) aggregation over the PEG; PMO KPI catalog extension; recommendation feedback capture (accept/reject/defer + outcome); process↔financial bridge (rework/delay cost); TCPI if absent from calculations.

## 5. Success metrics & acceptance thresholds (M1-T3, from spec §16)

| Metric | Threshold |
|---|---|
| Time to insight | Top-3 threats/opportunities identifiable in < 2 min |
| Evidence traceability | 100% of critical insights traceable to sources/formulas/timestamps |
| Financial reconciliation | 0 difference vs fixtures/official source, or formally documented tolerance |
| Performance | ~55-60 FPS with 50 visible nodes; usable interaction with 200 |
| Accessibility | No keyboard/contrast/fallback blockers; reduced-motion honored |
| PMO preference / Isabella usefulness | Measured in M9 UAT (structured comparison + accepted-recommendation rate) |

## 6. Risk register (top, with mitigation)

| Risk | Level | Mitigation |
|---|---|---|
| Regression of current dashboard | Critical | Isolated module, flag OFF, minimal header integration, non-regression tests |
| Financial double counting | Critical | Reuse canonical financial model; reconciliation fixtures; EVM unit tests |
| Cross-tenant exposure | Critical | RLS/RBAC on every adapter; negative tests; org-scoped read models |
| Recommendations without evidence | Critical | Evidence contract mandatory + blocking test |
| Game-like drift | High | Design gate: light background, minimal motion, data-first review per milestone |
| Incomplete event data | High | Data-quality score surfaced; honest "not computable" states (KPI engine pattern) |
| Realtime render storms | High | Signature-based incremental updates, batching, unsubscribe cleanup (LGRE patterns) |
| Isabella learns wrong patterns | High | Versioned packages, tenant isolation, rollback, no auto weight changes |
| Scope creep in autonomous run | High | Closed milestones (M1-M9), change-control rules below |

## 7. Change control (binding for the autonomous run)

1. No new features mid-task; new ideas are logged here for later evaluation.
2. Changes touching data, security, budget semantics or architecture require an entry in this doc before implementation.
3. Every task ends with evidence: files changed, tests run, open risks.
4. A milestone does not start until the previous milestone's gate passed (independent work may proceed when an area is blocked).
5. Mock data stays isolated and labeled; it never feeds real metrics.
6. The feature flag stays OFF; **no deploy, merge or push without explicit authorization from the Project Owner**.
7. The Living Graph is not modified; any need is solved via contracts/adapters.

## 8. Isabella learning stream (governance)

Per milestone, a versioned knowledge package is produced under `docs/pmo-process-intelligence/isabella-knowledge/` (manifest: `manifest.json` — version, sources, tenant-safety, approval state, ingestion status). Ingestion reuses the Knowledge OS (same mechanism as the product-brain/app-screens corpora) into the **non-production environment first**; packages are global-scope, tenant-safe (no tenant data inside). Runtime learning (recommendation feedback, calibration) is designed in M7 with reviewable versions — no automatic production behavior change, rollback always possible.

## 9. Definition of Done (module)

All global acceptance criteria of the spec (§15) met; `npm run typecheck` · `test:run` · `build` green; current dashboard intact and default (protected by tests); flag OFF; Isabella final snapshot + calibration report; final implementation report with evidence and rollback instructions.

## Milestone log

- **M2 (2026-07-23): CLOSED.** Canonical contracts typed + versioned
  (`contracts.ts`, `PMO_PI_CONTRACT_VERSION`): event contract as a projection
  over the PEG (no second event store), flow read model (nodes/edges/waiting/
  rework/bottleneck/dominant path), evidence package, executive financial
  snapshot and filters. Pure engines: `buildFlowModel` (delegates variants to
  CAP-046), `buildFinancialSnapshot` (delegates ALL EVM math to
  `lib/financial` — CPI/SPI/TCPI/ETC/EAC/VAC; honest unavailable states),
  `scopeToOrganization`/`scopeToProjects` (defense-in-depth tenant barrier).
  Double-counting prevented structurally (separate actuals/commitments/
  accruals + test); baseline history stays in the immutable canonical model
  (read-only). Gates: 19 unit tests green (guards PMO-PI-FLOW-PROJECTION,
  PMO-PI-TENANT-SCOPE, PMO-PI-FINANCIAL-SNAPSHOT), typecheck green, no UI
  yet, no schema changes. Isabella package M2 versioned (pending ingestion).
- **M1 (2026-07-23): CLOSED.** Scope/vision frozen (this doc §1-§4), inventory completed (§4 table), metrics defined (§5), risk register + change control recorded (§6-§7), flag created OFF with guard test `src/lib/pmo-process-intelligence/__tests__/flags.test.ts` (PMO-PI-FLAG-OFF), Isabella knowledge package M1 versioned (pending ingestion). No production behavior changed.
