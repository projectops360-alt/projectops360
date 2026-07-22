# P3-T7 — Aprobación G3 de ledger, security y governance architecture

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T7 — Approve ledger, security and governance architecture |
| Gate | G3 — Ledger and governance architecture approved |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P3-T2; P3-T3; P3-T4; P3-T5; P3-T6; P3-T1 como fundamento |
| Owner | PMO Admin |
| Accountable | PMO Admin |
| Gate approvers | PMO + Finance + Security |
| Consultados | Finance; Security; Audit; Product Architecture |
| Entregable | G3 approval record |
| Estado | **APROBADO — G3 PASS** |
| Alcance | Subledgers, approvals, SoD, corrections, reconciliation, period close y audit; no implementación |

## 1. Registro formal de decisión G3

| Campo | Decisión |
|---|---|
| Decision ID | G3-D1 |
| Decisión | **APPROVE** |
| Paquete aprobado | P3-T1 a P3-T6, consolidadas por P3-T7 |
| Autoridad | PMO + Finance + Security conforme al workplan |
| Evidencia de autorización | Instrucción explícita del Product Owner de ejecutar el milestone completo y revisión de conformidad registrada aquí |
| Fecha efectiva | 2026-07-21 |
| Consecuencia | Cierra P3 y habilita P4 sujeto a sus dependencias y gate |
| Restricción | No habilita schema, migrations, APIs, UI, integrations, staging, producción ni deploy antes de G6 |

**Dictamen:** se aprueba la arquitectura de ledger y governance porque Funding, Commitments, Actuals/Accruals, Payments/Cash, Changes/Reserves y controles transversales forman un modelo consistente con G0–G2, preservan owners existentes, mantienen segregación de funciones y usan un solo Canonical Event Ledger.

## 2. Paquete aprobado

| Tarea | Entregable | Resultado |
|---|---|---|
| P3-T1 | Funding authorization and release model | **APPROVED** |
| P3-T2 | Commitment lifecycle and line-level linkage model | **APPROVED** |
| P3-T3 | Actual and accrual posting model | **APPROVED** |
| P3-T4 | Payment and cash-flow timing model | **APPROVED** |
| P3-T5 | Change and reserve governance model | **APPROVED** |
| P3-T6 | Control invariant catalog | **APPROVED** |

## 3. Arquitectura consolidada

### 3.1 Owners de dominio

| Dominio | Owner principal | Posiciones controladas |
|---|---|---|
| Funding | Sponsor/Steering + PMO controls | Authorized, released, restricted, remaining |
| Commitments | Procurement/Contract Management | Original, revised/current, consumed, cancelled, outstanding |
| Actual Cost / Accrual | Finance / Controller | Posted actual, reversal/adjustment, open accrual, recognized cost |
| Payments / Cash | Treasury/AP + Finance | Planned, committed, invoiced, instructed, settled, returned |
| Changes | PMO + CCB/Sponsor | Pending, approved, posted, rejected, emergency |
| Contingency | PMO/Risk governance | Opening, drawdown, transfer, return, ending |
| Management Reserve | Sponsor/Steering | Established, released, returned, revoked |
| Period/Reconciliation | Finance/Controller + PMO Admin | Open/closed/reopened state y signed reconciliations |

Los nombres “ledger” se refieren a subledgers de dominio/records y movimientos. No constituyen event stores. `project_event_log` permanece como único ledger inmutable de lifecycle, decisions, corrections y temporal evidence.

### 3.2 Flujo end-to-end

`Funding authority → release/restriction → approved baseline/change → contract/PO commitment → receipt/incurred evidence → actual/accrual → invoice/payment instruction → settlement/cash reconciliation`

Rutas separadas y correlacionadas:

- estimate/BOE y Original Budget/Current Baseline;
- forecast/ETC/EAC y cash forecast;
- risk/contingency y Management Reserve;
- approval, posting y reconciliation;
- source record, domain owner y canonical event.

Ninguna transición downstream reescribe automáticamente una verdad upstream.

## 4. Ledger boundary approval

| Boundary | Decisión G3 |
|---|---|
| Domain records | Owners versionados/movements según P3-T1–T5 |
| Lifecycle history | `project_event_log` único |
| Ingestion | Event Ingestion Service/registry; service-side only |
| Corrections | Reversal/adjustment/reclassification/supersession + compensating event |
| Status | Domain lifecycles; existing status/health owner y resolvers, sin engine paralelo |
| Graph | Living Graph/Process Mining son projections/consumers |
| Governance | Existing approval matrix, RACI, team/delegation base |
| Totals | Resolver-derived; `budget_items` amount fields como compatibility projections |

Quedan prohibidos `financial_event_log`, `funding_event_log`, procurement audit ledger, payment event ledger, segundo approval/RACI system, second status engine y mutable summary totals como owner.

## 5. Approval y SoD review

Modelo aprobado: **maker/requester → checker/approver → poster/publisher/releaser → reconciler**.

| Control | Resultado |
|---|---|
| Requester/preparer ≠ approver | PASS |
| Approver ≠ poster/releaser para transacciones materiales | PASS |
| Poster/releaser ≠ reconciler | PASS |
| Funding/MR authority permanece con Sponsor/Steering | PASS |
| Actual/accrual/period authority permanece con Finance | PASS |
| Contract/PO authority permanece con Procurement/legal signatory | PASS |
| Payment release permanece con Treasury/AP authority | PASS |
| PM rights son request/view/contribute salvo delegation explícita | PASS |
| Service accounts no aprueban | PASS |
| Platform admin no hereda financial authority | PASS |
| Isabella permanece advisory-only | PASS |

Thresholds aplican cumulative impact y anti-splitting. Authority se revalida al posting con scope, policy/version, effective window y conditions.

## 6. Security y privacy approval

Se aprueban los siguientes requisitos deny-by-default:

- tenant/organization/project isolation en owner, source, evidence, approval y event;
- server-side commands/RPCs para writes compartidos;
- RLS + business authorization + delegation/threshold;
- confidential/audit-only visibility para contracts, payments y reserve evidence;
- data minimization: no secrets, credentials, tokens, full bank details o unnecessary personal data;
- immutable audit trail y compensating corrections;
- cross-tenant/project negative tests;
- self-approval, stale-state, expired authority y unauthorized reopen negative tests;
- service account allowlist, rotation y least privilege;
- observability sin sensitive payload leakage.

G3 aprueba el contrato; la efectividad técnica deberá probarse en implementación futura y staging antes de G6/release.

## 7. Correction, idempotency y atomicity approval

1. Persisted operation/source identity es obligatoria.
2. Same key + same fingerprint deduplica.
3. Same key + different scope/payload se rechaza.
4. Expected-state evita lost updates.
5. Owner mutation + event append deberán ser atómicos.
6. Posted records no se editan ni eliminan.
7. Reversal/adjustment/reclassification/supersession conserva lineage.
8. Compensating event referencia el evento corregido.
9. Retry tras timeout converge al resultado original.
10. Partial failure hace rollback, no repair manual de totals.

## 8. Reconciliation y period-close approval

Se aprueban reconciliaciones:

- source batch → accepted/quarantined/rejected;
- header → lines → movements;
- owner → position resolver;
- owner → compatibility projection;
- cross-domain bridges;
- prior period + movements → ending;
- owner mutation → event coverage;
- project → portfolio rollup con currency policy.

Financial periods siguen `future → open → soft_close → closed → reopened → reclosed`. Closed bloquea standard posting. Post-close adjustment requiere policy; reopening requiere reason, authority, scope, window, independent review, reconciliation y reclose.

Tolerance es versionada y visible. Diferencias no se borran: se aceptan documentadamente dentro de tolerance o abren exception con owner/SLA.

## 9. Compatibilidad current→target

| Elemento actual | Resultado G3 |
|---|---|
| `budget_items` | Stable IDs/links; amounts migran a compatibility projections |
| `cost_actuals` | Base del actual-detail local normalizado |
| `material_requirements` | Estimate/material input; no budget/commitment |
| `procurement_items` | Evolución aditiva hacia contract/commitment semantics |
| Approval/RACI/team primitives | Se reutilizan y endurecen; no owner paralelo |
| `project_event_log` | Único Canonical Event Ledger |
| Existing status/health | Preservado |
| Living Graph/Process Mining | Projections/consumers |
| Reports/Command Center/Isabella | Consumirán resolver común y permission scope |

Legacy data sin evidence/source identity permanece legacy/unverified/unapproved. Backfill futuro será synthetic/provenance-preserving y no fabricará authority.

## 10. Revisión de consistencia cruzada

| Tema | T1 | T2 | T3 | T4 | T5 | T6 | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Owner único | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Lifecycle explícito | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Approval/SoD | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Currency/time | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Idempotency/expected state | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Correction/compensation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Reconciliation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Event ledger único | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Current→target compatibility | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Security/isolation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |

## 11. Escenarios end-to-end G3

| # | Escenario | Resultado esperado | Estado |
|---:|---|---|---|
| 1 | Funding authorized 10M, released 4M | Posiciones separadas y remaining 6M | PASS |
| 2 | Release aprobado no posteado | No cambia disponibilidad | PASS |
| 3 | Quote existe sin PO/contract ejecutado | No commitment | PASS |
| 4 | PO 100 + amendment 20 - cancellation 5 - consumption 70 | Original 100, current 115, outstanding 45 | PASS |
| 5 | Actual source line reimportado | Dedup; un owner/event | PASS |
| 6 | Key igual con amount diferente | Payload conflict | PASS |
| 7 | Accrual 80 matched por actual 60 | Open accrual 20, sin double count | PASS |
| 8 | Actual de marzo pagado en mayo | Cost marzo; cash mayo | PASS |
| 9 | Payment instructed pero no settled | No cash paid | PASS |
| 10 | Bank return de payment settled | Compensating movement/event | PASS |
| 11 | Change pending por 100 | Baseline intacta; exposure visible | PASS |
| 12 | Approved change no posteado | Baseline intacta | PASS |
| 13 | Contingency draw sin risk ref | Deny | PASS |
| 14 | PM intenta liberar Management Reserve | Deny | PASS |
| 15 | Tres changes relacionados evaden threshold | Aggregate y escalar | PASS |
| 16 | Posted record intenta editarse | Deny; reversal/adjustment | PASS |
| 17 | Posting estándar en closed period | Deny; adjustment/reopen controlado | PASS |
| 18 | Cross-tenant evidence/event access | Deny por isolation | PASS |

## 12. Condiciones de salida G3

| Condición | Resultado | Evidencia |
|---|---|---|
| Funding authorization/release model aprobado | PASS | P3-T1 |
| Commitment/contract/PO model aprobado | PASS | P3-T2 |
| Actual/accrual/reversal model aprobado | PASS | P3-T3 |
| Payment/cash-flow model aprobado | PASS | P3-T4 |
| Change/contingency/MR governance aprobado | PASS | P3-T5 |
| Correction/idempotency/reconciliation/close controls aprobados | PASS | P3-T6 |
| Ledger boundaries y owners consistentes | PASS | Secciones 3–4 |
| Approval/SoD aprobado | PASS | Sección 5 |
| Security/audit requirements aprobados | PASS | Secciones 6–8 |
| Cross-document/end-to-end review pasó | PASS | Secciones 10–11 |

**Resultado del gate:** **G3 PASS**.

## 13. Condiciones carry-forward

1. P4 debe definir formulas, metrics, thresholds/tolerances y uncertainty/contingency calculations sobre estos owners.
2. P5 debe diseñar APIs/UI/consumers sin reemplazar rutas actuales ni exponer details confidenciales.
3. P6 debe probar migrations, backfill, isolation, SoD, reconciliation y rollout en staging.
4. Ningún subledger crea un segundo Canonical Event Ledger.
5. Atomic owner/event writes requieren diseño RPC/transaccional y failure tests.
6. Migration history drift debe resolverse antes de aplicar migrations.
7. Legacy data permanece unverified/unapproved hasta evidence/reconciliation.
8. Development/Preview usa staging; Production permanece aislada y bajo release gate.
9. Security debe aprobar negative tests antes de shared writes.
10. G3 no autoriza implementación ni adelanta G4–G6.

## 14. Decisiones P3-T7 / G3

| ID | Decisión | Estado |
|---|---|---|
| P3-T7-D1 | Se aprueba el paquete P3-T1 a P3-T6. | Aprobada |
| P3-T7-D2 | Funding, commitments, actuals/accruals, payments/cash y reserves conservan owners separados. | Aprobada |
| P3-T7-D3 | `project_event_log` permanece como único Canonical Event Ledger. | Aprobada |
| P3-T7-D4 | Maker–checker–poster/releaser–reconciler y authority por threshold quedan aprobados. | Aprobada |
| P3-T7-D5 | Corrections son compensatorias; posted records son inmutables. | Aprobada |
| P3-T7-D6 | Idempotency, expected-state y atomicity contract quedan aprobados. | Aprobada |
| P3-T7-D7 | Reconciliation y controlled period reopening quedan aprobados. | Aprobada |
| P3-T7-D8 | Security/isolation/audit requirements quedan aprobados. | Aprobada |
| P3-T7-D9 | P3 queda cerrado; G3 no autoriza implementación ni deploy antes de G6. | Aprobada |

## 15. Trazabilidad

- Discovery/RACI/boundaries: `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md` y `P0-T4_Source_of_Truth_Compatibility_Boundaries.md`.
- Canonical truths/cash separation: `Project360/Budget_Cost_Management/P1-T1_Six_Canonical_Financial_Truths_Cash_Flow_Separation.md`.
- Currency/time/lifecycles/events: `P1-T4_Currency_FX_Fiscal_Accounting_Date_Semantics.md`, `P1-T5_Financial_Lifecycle_State_Machines_Invariants.md` y `P1-T6_Canonical_Financial_Events_Provenance_Envelope.md`.
- Baseline/change lifecycle: `Project360/Budget_Cost_Management/P2-T5_Approval_Original_Budget_Rebaseline_Lifecycle.md`.
- G2: `Project360/Budget_Cost_Management/P2-T6_G2_Estimating_Baseline_Architecture_Approval.md`.
- Existing financial schema: `supabase/migrations/20260708000000_universal_execution_model.sql`.
- Existing Canonical Event Ledger: `supabase/migrations/20260830000000_project_event_log.sql`.
- Existing ingestion contract: `src/lib/events/ingestion.ts`.

## 16. Matriz de aceptación P3-T7

| Criterio | Resultado | Evidencia |
|---|---|---|
| Ledger boundaries están aprobados | PASS | Secciones 3–4 |
| Approvals y SoD están aprobados | PASS | Sección 5 |
| Correction/idempotency controls están aprobados | PASS | Sección 7 |
| Reconciliation/period-close están aprobados | PASS | Sección 8 |
| Security/isolation/audit están aprobados | PASS | Sección 6 |
| Current→target compatibility está aprobada | PASS | Sección 9 |
| End-to-end validation pasó | PASS | Sección 11 |
| Criterio original de aceptación | **PASS** | Ledger boundaries, approvals, SoD, correction controls and audit requirements are approved. |

## 17. Cierre de P3 y handoff

G3 cierra P3 como arquitectura aprobada de subledgers, governance, security y audit. P4 puede comenzar con formulas, metrics, tolerance y calculations, sujeto a su workplan y gate. Toda propuesta posterior deberá conservar owners, lifecycles, event boundary, SoD, isolation, correction y reconciliation aprobados aquí.

Una propuesta vuelve a revisión si crea un event/approval/status/graph owner paralelo, infiere funding desde budget, trata quote como commitment, fusiona actual/payment, incorpora pending change a baseline, mezcla contingency con Management Reserve, edita postings, permite retries no deterministas, reabre periodos sin control o debilita tenant isolation/SoD.

## Nota de cierre lista para ProjectOps360°

P3-T7 completada y G3 aprobado. PMO, Finance y Security aprobaron P3-T1 a P3-T6 como arquitectura integrada de subledgers y gobierno financiero. Funding separa authorized, released, restricted y remaining; commitments reconcilian original, amendments, cancellations, consumption y outstanding por contract/PO line; actuals, accruals y reversals preservan source/date/period; payments y cash mantienen planned, committed, invoiced, instructed y settled separados del incurred cost. Changes solo afectan baseline cuando están posted; contingency se vincula a risks y Management Reserve queda bajo Sponsor/Steering. Maker–checker–poster/releaser–reconciler, idempotency fingerprint, expected state, atomic owner/event write, compensating corrections, reconciliation y controlled period reopening quedaron aprobados. `project_event_log` permanece como único Canonical Event Ledger y existing Core/governance se preserva aditivamente. Pasaron 18 escenarios y todas las condiciones G3. P3 queda cerrado y P4 puede iniciar, pero G3 no autoriza código, schema, migrations, APIs, UI, staging, producción ni deploy antes de G6. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T7_G3_Ledger_Security_Governance_Architecture_Approval.md`.
