# P3-T6 — Controles de correction, idempotency, reconciliation y period close

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T6 — Define correction, idempotency, reconciliation and period-close controls |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P3-T2; P3-T3; P3-T4; P3-T5 |
| Owner | Finance / Controller |
| Accountable | PMO Admin |
| Consultados | Audit; Security; Engineering; Product Architecture |
| Entregable | Control invariant catalog |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P3** |
| Efecto | Define invariantes; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de control

Toda mutación financiera deberá ser retry-safe, authorized, period-aware, traceable, compensable y reconciliable. Posted/active records no se corrigen mediante silent rewrite; se usa reversal, adjustment, reclassification o new version. Los cierres congelan el periodo según authority y solo un controlled reopening permite movimientos que la policy no admita como post-close adjustments.

Los subledgers P3 conservan sus estados de dominio; la evidencia lifecycle se captura en el único `project_event_log`. Existing Event Ingestion Service, dedup key, idempotency fingerprint, compensating events, approval/RACI owners y tenant isolation son la base a extender, no capacidades paralelas.

## 2. Catálogo de invariantes transversales

### 2.1 Identidad y alcance

1. Stable owner record ID, version/movement ID y source identity.
2. `organization_id` y `project_id` deben coincidir en owner, source, approval, evidence y event.
3. Foreign references se validan en el mismo tenant/project salvo relación inter-project aprobada.
4. Source system/document/transaction/line identities no se reutilizan para hechos lógicos diferentes.
5. Legacy/unmapped/unknown permanece explícito; no se inventa mapping.

### 2.2 Authority y SoD

6. Requester/preparer, approver, poster/publisher y reconciler se separan conforme a P0-T3.
7. Authority se revalida al posting por scope, threshold, effective window y policy version.
8. Service accounts pueden postear commands autorizados; no aprueban.
9. Platform admins no heredan autoridad financiera.
10. Break-glass es temporal, mínimo, visible y retrospectively reviewed.

### 2.3 Estado e inmutabilidad

11. Todo command declara expected state/version.
12. Approved-not-posted no afecta posición.
13. Active/posted snapshots y movements son inmutables.
14. Corrections preservan original, reason, authority y compensating link.
15. Event append y owner mutation deberán compartir atomic transaction boundary.

### 2.4 Valores, moneda y tiempo

16. Amount/sign/UOM/tax treatment cumplen policy.
17. No se agregan monedas sin FX provenance.
18. Incurred, document, accounting, effective, due, settlement y recorded dates permanecen separadas.
19. Cada posting se asigna a un fiscal period válido.
20. Totals derivados declaran policy/version, `as_of` y completeness.

## 3. Idempotency contract

### 3.1 Operation identity

Cada command/import usa una clave estable generada por el workflow origen:

`organization + project + command/event type + source operation identity`.

No se permite timestamp fresco, random UUID por retry o UI click como única identidad. Para imports: source system + batch + document + line + source version. Para commands internos: persisted operation ID.

### 3.2 Fingerprint

El fingerprint cubre campos lógicos significativos:

- tenant/project;
- subject/source identity;
- amount/currency/UOM;
- effective/accounting/period semantics;
- from/to state;
- policy/approval/evidence refs;
- canonical payload y object refs.

Campos regenerados como recorded timestamp no alteran fingerprint. El mismo key + mismo fingerprint deduplica; el mismo key con scope o payload diferente falla como `idempotency_scope_conflict` o `idempotency_payload_conflict`.

### 3.3 Resultado de retry

| Caso | Resultado |
|---|---|
| Primer intento completo | Owner mutation + event commit |
| Retry idéntico después de éxito | Devuelve mismo operation/event result; no duplica |
| Retry después de timeout con commit desconocido | Consulta por idempotency key y converge |
| Key igual, payload diferente | Reject/quarantine |
| Concurrent commands con same expected state | Uno gana; otro stale-state conflict |
| Partial failure | Atomic rollback; retry seguro |

## 4. Correction contract

| Tipo | Uso | Efecto |
|---|---|---|
| Reversal | Neutralizar total/parcialmente un posting previo | Movimiento opuesto + compensating event |
| Replacement | Registrar el hecho correcto después de reversal | Nuevo owner record/movement |
| Adjustment | Diferencia autorizada sin eliminar original | Delta explícito |
| Reclassification | Mover valor entre dimensions | Dos lados balanceados |
| Supersession | Reemplazar una versión no transaccional | Nueva snapshot/version |
| Post-close adjustment | Corregir sin reabrir, si policy lo permite | Periodo actual con ref al original |
| Controlled reopening | Permitir posting en periodo cerrado | Approval, scope, window y reclose |

Reason code, narrative, evidence, original ref, amount/currency, impacted periods, approver, poster y event son obligatorios. Delete físico de records financieros posteados está prohibido.

## 5. Reconciliation framework

### 5.1 Niveles

1. Source control total → imported accepted/quarantined/rejected.
2. Header → lines → movements.
3. Domain owner → derived position.
4. Domain owner → compatibility projection.
5. Cross-domain bridges.
6. Current period → prior period + movements.
7. Project → portfolio rollup por currency/reporting policy.
8. Owner mutation → `project_event_log` event coverage.

### 5.2 Ecuaciones mínimas

| Dominio | Reconciliación |
|---|---|
| Funding | Authorized, released, restricted y remaining por movements/effective period |
| Commitments | Original + amendments - cancellations = current; current - consumed = outstanding |
| Actuals | Source/batch totals = accepted + quarantined/rejected; net actual = postings ± corrections |
| Accruals | Posted - matched - reversed = open accrual |
| Payments | Instruction/settlement/return residual y gross-to-net |
| Cash | Prior forecast bridge y settled source statement |
| Contingency/MR | Opening + increases/transfers - drawdowns/releases/returns = ending |
| Baseline | Prior baseline + approved/posted change effects = new baseline |
| Events | Cada mutation material tiene exactly one canonical event/correlation coverage |

Tolerance es versionada por domain/currency/materiality. Un difference dentro de rounding tolerance se registra; no se borra. Fuera de tolerance abre exception con owner, SLA y disposition.

### 5.3 Reconciliation record

Conserva run ID/version, scope, `as_of`, period, sources, policy/tolerance, control totals, differences, exception IDs, preparer, reviewer, signoff y evidence. Rerun crea nueva version y lineage.

## 6. Financial period lifecycle

`future → open → soft_close → closed → reopened → reclosed`

| Estado | Regla |
|---|---|
| Future | Configuración; no posting salvo policy |
| Open | Postings autorizados permitidos |
| Soft close | Solo queues/batches autorizados; reconciliation en progreso |
| Closed | No standard posting/rewrite |
| Reopened | Scope/time/reason limitados por approval |
| Reclosed | Reconciliación y signoff posteriores obligatorios |

Close exige:

- import queues materialmente resueltas;
- required accruals/reversals procesados;
- commitment, actual, payment y reserve reconciliations;
- exception disposition por tolerance;
- source/event coverage;
- Finance preparer/reviewer y Controller signoff;
- close event con evidence.

Reopening exige reason, affected domains/transactions, named authority, start/end window, impact assessment, expected movements, independent reviewer y reclose deadline.

## 7. Security e isolation

- Service-side writes únicamente por commands/RPCs aprobados; no direct UI write al ledger.
- RLS/authorization combina organization, project, role, delegation y data classification.
- Confidential contracts/payments usan visibility/permission scope.
- Evidence URLs se autorizan; no se incluyen secrets, credentials o raw bank data.
- Logs redactan payload sensible e idempotency internals cuando corresponde.
- Negative tests prueban cross-tenant, cross-project, self-approval, stale state y unauthorized reopen.
- Audit tiene read-only evidence; no obtiene posting rights.

## 8. Observability y exception management

Métricas mínimas:

- dedup rate, payload/scope conflicts y stale-state conflicts;
- import accepted/quarantined/rejected;
- posting/event atomic failures;
- unreconciled amount/count por domain/period;
- aged accruals, open commitments y unmatched settlements;
- approved-not-posted age;
- closed-period attempts y reopen duration;
- SoD/authority denies;
- event coverage/hash/sequence exceptions.

Cada alert enlaza run/operation/subject sin exponer secrets. Reprocess usa la misma idempotency identity; nunca “fix” mediante edición manual del total.

## 9. Pruebas obligatorias para implementación futura

1. Unit tests de fórmulas, signs, tolerance y period rules.
2. Contract tests de owner/event envelopes.
3. Retry después de success, timeout y concurrency.
4. Same key/different payload y same key/different scope.
5. Atomic rollback entre owner mutation y event.
6. Reversal/adjustment/reclassification balance.
7. Closed-period deny y controlled reopen/reclose.
8. Cross-tenant/project negative RLS.
9. SoD/authority/threshold/expiry negative cases.
10. Source→owner→projection→event reconciliation.
11. Legacy backfill con synthetic/unapproved provenance.
12. Performance/replay con deterministic results.

## 10. Compatibilidad con plataforma actual

| Capacidad actual | Uso |
|---|---|
| Event Ingestion Service | Gateway único, validation/normalization/dedup |
| `project_event_log.dedup_key` | Idempotent event identity |
| Idempotency fingerprint existente | Base para scope/payload conflict |
| Compensating events | Correcciones sin rewrite |
| `project_approval_matrix` / RACI/team | Authority y SoD base |
| `budget_items` totals | Compatibility projections reconciliadas |
| Process Mining/Living Graph | Consumers de events/projections |

P3 define contratos target; no declara que el schema actual ya implemente todos los controles. Las extensiones se diseñarán después de G6, de forma aditiva, feature-gated y contra staging.

## 11. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Import batch se reintenta idéntico | Un solo set de records/events |
| 2 | Key igual con amount diferente | Payload conflict |
| 3 | Key igual en otro project | Scope conflict/deny |
| 4 | Dos posters usan misma expected version | Uno commit; otro stale-state |
| 5 | Owner write funciona y event falla | Atomic rollback |
| 6 | Posted actual se corrige | Reversal + replacement/adjustment |
| 7 | Reclass cambia project total | Deny; debe balancear |
| 8 | Standard posting en closed period | Deny |
| 9 | Reopen sin expiry/reviewer | Deny |
| 10 | Reopen autorizado, posting y reclose | Allow con full evidence |
| 11 | Projection difiere del owner | Exception; no overwrite owner |
| 12 | Usuario de otra organización consulta contract/payment | Deny |

## 12. Decisiones P3-T6

| ID | Decisión | Estado |
|---|---|---|
| P3-T6-D1 | Toda mutación es retry-safe y expected-state aware. | Aprobada |
| P3-T6-D2 | Same key/same fingerprint deduplica; conflicts se rechazan. | Aprobada |
| P3-T6-D3 | Posted records se corrigen por movimientos, no rewrite. | Aprobada |
| P3-T6-D4 | Owner mutation y event append deberán ser atómicos. | Aprobada |
| P3-T6-D5 | Cada dominio tiene ecuación y reconciliation record versionado. | Aprobada |
| P3-T6-D6 | Closed periods requieren adjustment policy o controlled reopening. | Aprobada |
| P3-T6-D7 | Reopen es limitado, aprobado, reconciliado y reclosed. | Aprobada |
| P3-T6-D8 | Security/SoD/isolation son deny-by-default y se prueban negativamente. | Aprobada |
| P3-T6-D9 | Existing ingestion/governance/ledger se reutilizan. | Aprobada |
| P3-T6-D10 | Observability y exception queues son parte del control. | Aprobada |

## 13. Matriz de aceptación P3-T6

| Criterio | Resultado | Evidencia |
|---|---|---|
| Imports son retry-safe | PASS | Sección 3 |
| Correcciones no hacen silent rewrite | PASS | Sección 4 |
| Ledgers/subledgers reconcilian | PASS | Sección 5 |
| Period close/reopen está controlado | PASS | Sección 6 |
| Security/SoD/audit están definidos | PASS | Secciones 7–9 |
| Existing controls se preservan | PASS | Sección 10 |
| Criterio original de aceptación | **PASS** | Imports are retry-safe; corrections use reversal/adjustment rather than silent rewrite; ledgers reconcile; closed periods require controlled reopening. |

## Nota de cierre lista para ProjectOps360°

P3-T6 completada y validada. Se aprobó un catálogo de 20 invariantes para stable identity, tenant/project scope, authority/SoD, expected state, inmutabilidad, amount/currency y period semantics. Cada command/import usa operation identity persistida y fingerprint canónico: retries idénticos deduplican, mientras key reutilizada con scope o payload diferente falla. Owner mutation y canonical event deberán ser atómicos. Posted records se corrigen con reversal, replacement, adjustment, reclassification o supersession; nunca silent rewrite/delete. Funding, commitments, actuals/accruals, payments/cash, reserves y baseline tienen ecuaciones y reconciliation records versionados. Periods siguen future/open/soft-close/closed/reopened/reclosed; reopening exige authority, scope, expiry, reconciliation y reclose. Se definieron negative security/SoD tests, observability y exception queues reutilizando Event Ingestion Service, governance y `project_event_log`. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T6_Correction_Idempotency_Reconciliation_Period_Close_Controls.md`.
