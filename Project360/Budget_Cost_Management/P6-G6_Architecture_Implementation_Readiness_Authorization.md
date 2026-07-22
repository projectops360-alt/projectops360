# P6 — Architecture package and implementation readiness / G6

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P6 — Architecture package and implementation readiness |
| Tareas | P6-T1 a P6-T6 |
| Gate | G6 — Final architecture review and implementation authorization |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-22 |
| Predecesores | G1; G2; G3; G4; G5 |
| Owner | Product Architecture / Product Owner |
| Accountable | Product Owner |
| Consultados | PMO; Finance; Engineering; Security; Controls Assurance |
| Estado | **APROBADO — G6 IMPLEMENTATION AUTHORIZED** |
| Restricción | Implementación solo aditiva, feature-gated, staging-first y reversible |

## P6-T1 — Canonical architecture, capability specification and ADRs

### Current reality

- `budget_items` conserva estimate/summary legacy y stable links.
- `cost_actuals` existe como punto de evolución del actual-detail.
- `material_requirements` y Budget UI soportan material estimating.
- `procurement_items` conserva procurement identity/status.
- `project_event_log` es append-only, idempotent y único Canonical Event Ledger.
- Approval matrix, RACI y project team son governance primitives existentes.
- Command Center, Reports, Budget, Living Graph, Process Mining e Isabella son superficies Core.

### Target capability map

| Capability | Canonical owner |
|---|---|
| Estimate/BOE/classification | Immutable estimate/BOE versions |
| Original Budget/Current Baseline | Immutable baseline versions/lines |
| Funding | Authorization + movements |
| Commitments | `procurement_items` + commitment versions/movements |
| Actual Cost | Hardened `cost_actuals` |
| Accrual | Accrual records/movements |
| Payment/Cash | Payment records/movements + cash projections |
| Change/Reserves | Change packages/impacts + reserve accounts/movements |
| Measurement/Forecast | Snapshots + scenarios derived from owners |
| Reconciliation | Versioned runs/items/exceptions |
| Lifecycle/audit | Existing `project_event_log` only |

### ADRs aprobados

1. **ADR-FIN-001:** additive Core evolution; no separate financial app.
2. **ADR-FIN-002:** one owner per business fact.
3. **ADR-FIN-003:** `project_event_log` remains unique event ledger.
4. **ADR-FIN-004:** immutable snapshots/movements; correction by compensation.
5. **ADR-FIN-005:** server/database authority, not UI-only controls.
6. **ADR-FIN-006:** calculation primitives are pure/versioned and golden-tested.
7. **ADR-FIN-007:** projections expose quality/completeness; no fabricated totals.
8. **ADR-FIN-008:** feature flags split foundation/writers/projections/UI/AI.
9. **ADR-FIN-009:** staging-first; production requires G9.
10. **ADR-FIN-010:** rollback disables capabilities but preserves ledger/history.

### Nota de cierre P6-T1

P6-T1 completada. Se publicó el architecture/capability package con current reality, target owners, non-goals, decisions, risks y phased roadmap sin contradicciones con G1–G5.

## P6-T2 — Additive schema, compatibility and migration sequence

### Additive schema groups

| Grupo | Objetos target |
|---|---|
| Period/control | `financial_periods`, `financial_operation_receipts` |
| Estimating/baseline | `financial_estimate_versions`, `financial_boe_versions`, `financial_baseline_versions`, `financial_baseline_lines` |
| Funding | `funding_authorizations`, `funding_movements` |
| Commitments | additive columns on `procurement_items`; `commitment_movements` |
| Actuals/accruals | additive columns on `cost_actuals`; `financial_accruals`, `accrual_movements` |
| Payments/cash | `financial_payments`, `payment_movements` |
| Changes/reserves | `financial_changes`, `financial_change_impacts`, `reserve_accounts`, `reserve_movements` |
| Measurement | `financial_measurement_snapshots`, `financial_forecast_scenarios` |
| Reconciliation | `financial_reconciliations`, `financial_reconciliation_items` |

No table named `financial_event_log` or generic mutable `financial_ledger` is allowed.

### Migration sequence

1. **M1 foundation:** enums/checks, periods, operation receipts, shared authority helpers.
2. **M2 versions:** estimate/BOE/baseline snapshots and lines.
3. **M3 domain owners:** funding, commitments extension, accrual/payment/change/reserve.
4. **M4 controls:** RLS, write grants, controlled RPCs, append event atomicity.
5. **M5 read models:** deterministic views/functions for positions/reconciliation.
6. **M6 pilot:** explicit backfill candidates and compatibility flags; no automatic promotion.

### Compatibility/rollback

- Existing columns/tables/routes remain.
- New columns nullable or safe-defaulted until backfill.
- Legacy values tagged `legacy_unverified`.
- Backfill has stable source identity, dry-run, counts/totals, idempotency y provenance.
- Shadow reconciliation precedes owner cutover.
- Rollback disables flags/writers/views; never deletes rows/events.
- Destructive cleanup requires separate future gate after consumers cut over.

### Nota de cierre P6-T2

P6-T2 completada. Se aprobó una secuencia M1–M6 aditiva, idempotente, evidence-aware y reversible; no destructive migration ni reinterpretación automática de legacy values.

## P6-T3 — RBAC, RLS, thresholds and threat model

### Capabilities

- `financial.view`
- `financial.prepare`
- `financial.approve`
- `financial.post`
- `financial.reconcile`
- `financial.period.manage`
- `financial.funding.authorize`
- `financial.reserve.release`
- `financial.payment.release`
- `financial.audit.read`

Capabilities se resuelven desde trusted session, organization/project membership, permission level, explicit delegation, authority scope/threshold y effective window. No se aceptan role/capability/org/project enviados por cliente.

### Enforcement layers

1. Server action/API authenticates and resolves org/project context.
2. Pure authorization function checks capability, scope, SoD, threshold, state.
3. Database RLS enforces tenant/project read isolation.
4. Controlled RPC validates authority/idempotency/expected state and performs atomic write+event.
5. Audit/event records outcome and denial reason without secrets.

### Threats y mitigaciones

| Threat | Mitigation |
|---|---|
| Cross-tenant/project IDOR | Trusted scope + RLS + negative tests |
| Self-approval/role stacking | Effective-principal SoD conflict check |
| Threshold splitting | Correlation/cumulative impact aggregation |
| Replay/duplicate import | Operation receipt + dedup fingerprint |
| Stale overwrite | Expected version/state |
| Direct table mutation | Revoke client write; controlled RPC/server path |
| Service-role abuse | Server-only secret, allowlisted command, audit |
| Sensitive contract/payment leakage | Column/payload minimization + permission scope |
| Closed-period manipulation | Period guard + controlled reopen |
| AI action escalation | Read-only tools/refusal; no mutation credentials |

### Nota de cierre P6-T3

P6-T3 completada. Tenant/project isolation, least privilege, SoD, thresholds y threat mitigations quedan testables en server/database; ocultar controles en UI nunca será suficiente.

## P6-T4 — Test strategy and reconciliation gates

| Layer | Verificación |
|---|---|
| Unit | Formula, state transition, signs, currency, idempotency fingerprints |
| Property | Invariants: no NaN/Infinity, balance preservation, monotonic cumulative probability |
| Contract | Typed domain inputs/outputs y event envelopes |
| Migration | Fresh apply, idempotent reapply behavior, legacy shape compatibility |
| Integration | Atomic owner+event, retry, stale state, compensating correction |
| RLS/security | Cross-org/project, unauthorized approval/post/reopen |
| Reconciliation | Source→owner→projection→event and golden totals |
| UI | Role disclosure, responsive, no replaced current functions |
| UAT | PMO/PM/Finance/Procurement/Sponsor end-to-end |
| Regression | Existing full Vitest, typecheck, build, focused E2E |

Every invariant from P1–P4 maps to at least one executable test. G7 requires foundation tests; G8 requires workflow/UAT; G9 requires pilot/non-functional evidence.

### Nota de cierre P6-T4

P6-T4 completada. Se aprobó estrategia unit/property/contract/migration/integration/RLS/reconciliation/UI/UAT y regression; cada invariant y approval boundary tiene verificación ejecutable antes de release.

## P6-T5 — Flags, pilot, observability and rollback

### Independent flags

| Flag | Default | Scope |
|---|---|---|
| `FINANCIAL_FOUNDATION_ENABLED` | false | Read contracts/schema availability |
| `FINANCIAL_WRITERS_ENABLED` | false | Controlled mutations |
| `FINANCIAL_PROJECTIONS_ENABLED` | false | Read models/reconciliation |
| `FINANCIAL_UI_ENABLED` | false | Budget/cockpit surfaces |
| `FINANCIAL_ISABELLA_ENABLED` | false | Read-only AI tools |
| `FINANCIAL_PILOT_PROJECT_IDS` | empty | Explicit project allowlist |

Enforcement es server-side; UI mirrors state. Production remains off until G9.

### Observability

- command success/deny/error/dedup/conflict;
- owner/event atomicity failures;
- reconciliation differences y stale projections;
- approved-not-posted/aged accrual/period exceptions;
- cross-tenant/SoD denial counts;
- query latency/error budget;
- rollout cohort y feature state;
- no sensitive payloads.

### Rollback

1. Disable UI/AI.
2. Disable writers.
3. Keep projections read-only if healthy.
4. Revert consumer to compatibility path.
5. Preserve all owner/event records.
6. Reconcile/repair by compensating movement or code fix.
7. Never down-migrate/delete history during incident.

### Nota de cierre P6-T5

P6-T5 completada. Foundation, writers, projections, UI e Isabella pueden activarse independientemente por pilot allowlist; failures son observables y rollback preserva toda historia.

## P6-T6 — Final review and implementation authorization

### Readiness review

| Área | Evidencia | Resultado |
|---|---|---|
| Canonical architecture | G1–G3 + P6-T1 | PASS |
| Formulas/golden data | G4 | PASS |
| PMO/Core UX | G5 | PASS |
| Data/migrations | P6-T2 | PASS |
| Security/threat model | P6-T3 | PASS |
| Test/reconciliation strategy | P6-T4 | PASS |
| Flags/rollback/observability | P6-T5 | PASS |
| No parallel owners | ADR-FIN-001–003 | PASS |
| Staging-first boundary | ADR-FIN-009 | PASS |

### Authorization

| Campo | Decisión |
|---|---|
| Gate | G6 |
| Decisión | **AUTHORIZE P7–P9 EXECUTION** |
| Approvers | Product Owner + PMO Admin + Finance + Engineering + Security + Controls Assurance |
| Resultado | **G6 PASS** |
| Restrictions | Additive only; staging first; flags off by default; no production before G9 |

### Stop conditions

- Environment resolves to production during development/stage command.
- Migration history drift or unknown destructive diff.
- RLS/SoD negative test failure.
- Owner/event atomicity failure.
- Golden formula mismatch.
- Unreconciled material totals.
- Secret exposure.
- Existing Core regression.

### Nota de cierre P6-T6

P6-T6 completada y G6 aprobado. Architecture, security, data, formulas, UX, tests y rollout están aprobados. P7–P9 cambian de deferred a executable bajo staging-first, feature flags off-by-default y stop conditions; producción sigue prohibida hasta G9.

## Matriz de aceptación P6

| Tarea | Criterio original | Resultado |
|---|---|---|
| P6-T1 | Reality/target/non-goals/contracts/decisions/risks/roadmap explícitos y consistentes | PASS |
| P6-T2 | No destructive migration; explicit idempotent evidence-aware backfill | PASS |
| P6-T3 | Isolation/least privilege/SoD server+DB testables | PASS |
| P6-T4 | Cada invariant/boundary tiene executable verification | PASS |
| P6-T5 | Independent activation, visible failures, history-preserving rollback | PASS |
| P6-T6 | Architecture/security/data/formulas/UX/tests/rollout approved | PASS |

No se modificó schema, base de datos ni producción y no se realizó deploy durante P6. El gate G6 autoriza comenzar implementación P7 únicamente bajo las restricciones aprobadas.
