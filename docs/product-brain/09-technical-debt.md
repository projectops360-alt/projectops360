# 09 — Technical Debt

Structural risks and debt. Each item: description, impact, severity, suggested action. Debt is
not a regression (see doc 10) — it is accepted-but-costly structure.

| ID | Debt | Impact | Severity | Suggested action |
|----|------|--------|----------|------------------|
| DEBT-001 | **`master` vs `feat/rythm` divergence.** A large body of work (RBAC, capacity, refinement, rythm, team) lived only on `feat/rythm`; some was reimplemented on `master`, some lost. | Lost features, security gaps, confusion about "what's real." | **Critical** | Inventory `feat/rythm` vs `master` per capability; decide reconcile/abandon per area; record in registry. |
| DEBT-002 | **RBAC parity gap.** `master` runs permissive org-context auth; full PMO/PM/Team RBAC exists only on `feat/rythm`. | Security/governance (P6) understated; access not enforced as intended. | **Critical** | ADR-008; port or re-decide RBAC on `master`. |
| DEBT-003 | **Two capacity engines.** `lib/capacity` (generic resource capacity) and `lib/labor/capacity` (construction labor) coexist with overlapping concepts. | Duplication, drift, confusion for capacity features. | High | ADR-009 to define boundaries / shared core. |
| DEBT-004 | **`rhythm` vs `rythm` duplication.** Two meeting modules/routes with near-identical names. | User confusion, maintenance cost, naming hazard. | High | ADR-010; consolidate or clearly delineate. |
| DEBT-005 | **Thin automated test coverage on core engines.** Critical Path, Execution Status Engine (prototype), capacity service, Living Graph analysis lack/limited `__tests__`. | Regressions ship silently. | High | Add deterministic unit tests as engines are touched. |
| DEBT-006 | **Status logic duplicated per surface.** Milestone/task/graph status computed in several places (`roadmap/progress`, `graph` page, `health`). | Drift; the Blocked/Waiting bug (REG-006). | High | Centralize on the Execution Status Engine (ADR-006). |
| DEBT-007 | **`status-engine.ts` uncommitted prototype** in the working tree. | Risk of accidental loss (the very problem we are solving). | Medium | Commit as Prototype with doc 18, or remove deliberately. |
| DEBT-008 | **No CI gate tied to the registries.** Nothing enforces "update registry/ADR on change." | Process relies on discipline. | Medium | Lightweight PR checklist / future check. |
| DEBT-009 | **Migration vs code drift risk.** Some migrations were applied to prod while code lived only on a branch (e.g. `20260812`). | Prod schema ahead of `master` code. | Medium | Reconcile migration history with `master` per area. |

> When you fix a debt item, note the commit/PR and move it to a "Resolved" section rather than
> deleting it — the history is valuable.
