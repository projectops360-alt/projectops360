# P3-T3 — Diseño del ledger de actual cost, accrual y reversal

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T3 — Design actual-cost, accrual and reversal ledger |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P3-T1 |
| Owner | Finance / Controller |
| Accountable | Finance / Controller |
| Consultados | PMO; Product Architecture; Audit |
| Entregable | Actual and accrual posting model |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P3** |
| Efecto | Define contrato y controles; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de arquitectura

Actual Cost representa costo reconocido desde una fuente financiera autorizada; Accrual representa costo incurrido estimado/validado aún no sustituido por el actual correspondiente. Incurred evidence, source document, posted actual, accrual, reversal y payment son hechos relacionados pero distintos.

`cost_actuals` se conserva y evoluciona aditivamente como owner local normalizado del detalle de actuals. Accruals y sus movimientos tendrán owner de dominio relacionado, sin crear otro total editable. `budget_items.actual_cost` será compatibility rollup derivado. Toda historia y corrección se registra en el único `project_event_log`.

ProjectOps360° no reemplaza el General Ledger del ERP. Conserva una réplica/control subledger trazable para project controls, reconciliation, forecast, reporting y Process Mining.

## 2. Objetos canónicos

| Objeto | Propósito |
|---|---|
| Actual Source Transaction | Identidad del posting/line en ERP o fuente autorizada |
| Actual Cost Record | Detalle normalizado por project/CBS/WBS/control account |
| Accrual Proposal | Estimación preparada con basis/evidence antes de approval |
| Accrual Posting | Accrual aprobado y posteado para periodo |
| Accrual Match | Vínculo entre accrual y actual/credit que lo reemplaza |
| Reversal | Movimiento que neutraliza total o parcialmente un record previo |
| Adjustment | Movimiento correctivo con reason, authority y periodo |
| Actual Position | Proyección de actuals/reversals/adjustments a un `as_of` |
| Recognized Cost Position | Actuals reconciliados + accruals vigentes según policy |

Todos conservan organization/project, source system/document/transaction/line IDs, amount/currency, debit/credit sign, incurred/service date, document/invoice date, accounting/posting date, fiscal period, recorded timestamp, CBS/WBS/control account/budget refs, supplier/resource, tax/cost type, approval, policy, evidence y provenance.

## 3. Semántica temporal

| Fecha | Significado |
|---|---|
| Incurred/service date | Cuándo se recibió trabajo/bien o nació el costo económico |
| Source document date | Fecha del invoice, journal, timesheet u otro documento |
| Accounting/posting date | Fecha usada por Finance para contabilización |
| Fiscal period | Periodo contable owner de close/reopen |
| Recorded/ingested at | Cuándo ProjectOps360° recibió el hecho |
| Payment/due/settlement date | Pertenece a payment/cash; no altera incurred/accounting |

`cost_actuals.cost_date` permanece legacy source date hasta clasificarlo; no se interpreta automáticamente como accounting, incurred o payment date.

## 4. Actual Cost posting

Un actual válido exige:

1. source system y stable transaction/line identity;
2. organization/project scope validado;
3. amount/currency y sign policy;
4. incurred, document, accounting dates y fiscal period según applicability;
5. CBS/control account y source dimensions, o exception explícita;
6. source evidence/hash/reference;
7. authority del source/poster e ingestion policy;
8. idempotency fingerprint;
9. periodo abierto o controlled adjustment/reopen;
10. balanced batch/reconciliation total cuando el source es batch.

Lifecycle: `received → validated → posted → reconciled → closed`. Alternativas: `quarantined`, `rejected`, `reversed`, `adjusted`. Un record posted no se edita.

## 5. Accrual model

### 5.1 Basis

Cada Accrual Proposal declara service period, calculation method, quantity/progress, commitment/receipt/work evidence, source owner, confidence, expected reversal/match period, CBS/control account, amount/currency y reviewer.

### 5.2 Lifecycle

`draft → submitted → reviewed → approved → posted → partially_matched → fully_matched → reversed → closed`

Rutas explícitas: `rejected`, `withdrawn`, `expired`. Approved-not-posted no aumenta recognized cost.

### 5.3 Reversal y matching

- auto-reversal solo si una policy aprobada lo define y crea movimiento/evento trazable;
- actual posterior se matcha contra el accrual antes de calcular exposición;
- matching puede ser parcial y conserva residual;
- reversal no borra proposal, posting ni approval;
- unmatched/aged accruals generan exception;
- accruals no sustituyen invoice, commitment ni payment owners.

## 6. Balance y fórmulas

Por moneda, scope y `as_of`:

- `Net Actual Cost = posted actuals + posted adjustments - posted reversals/credits`.
- `Open Accrual = posted accruals - matched amounts - accrual reversals`.
- `Recognized Cost To Date = reconciled Net Actual Cost + eligible Open Accrual`, conforme a policy versionada.
- `Unreconciled Difference = source control total - normalized/project control total`.

El cálculo declara si taxes, overhead, credits, retainage y accruals están incluidos. No se suma actual + invoice + payment. No se convierte multi-currency sin rate/source/date/policy.

ProjectOps360° puede aplicar balancing por batch/source totals y signed lines para control, sin pretender ser un General Ledger de doble partida.

## 7. Correcciones

| Caso | Tratamiento |
|---|---|
| Duplicate source transaction | Dedup/quarantine; no segundo actual |
| Error antes de posting | Reject/correct draft |
| Error después de posting | Reversal total/parcial + replacement/adjustment |
| Reclasificación CBS/WBS | Dos movements balanceados; original permanece |
| Periodo cerrado | Post-close adjustment o controlled reopening |
| Source correction posterior | Nueva source transaction enlazada al original |
| Currency correction | Reverse/repost con FX provenance |

Un UPDATE de amount, date, source identity o project scope sobre un posted record está prohibido.

## 8. Ownership, authority y SoD

| Acción | Responsible | Accountable | Control |
|---|---|---|---|
| Preparar accrual | PMO/authorized cost engineer | Finance reviewer | Preparer no aprueba/postea |
| Aprobar accrual | Finance / Controller | Finance / Controller | Authority/threshold |
| Importar/postear actual | Authorized Finance integration/poster | Finance / Controller | Service account no aprueba |
| Postear accrual/reversal | Authorized poster | Finance / Controller | Approver ≠ poster cuando material |
| Reconciliar | Independent Finance/PMO control | Controller | Poster ≠ reconciler |
| Auditar | Audit | PMO Admin | Read-only |

PM y Isabella no postean actuals. Isabella puede explicar variances, aged accruals o reconciliation exceptions con permission scope.

## 9. Eventos canónicos

- `actual_received`, `actual_validated`, `actual_posted`, `actual_rejected`;
- `actual_reversed`, `actual_adjusted`, `actual_reclassified`;
- `accrual_submitted`, `accrual_approved`, `accrual_posted`;
- `accrual_matched`, `accrual_reversed`, `accrual_closed`;
- `actuals_reconciled`, `reconciliation_exception_opened`.

El owner mutation y event append deberán ser atómicos en implementación. Events usan el registry/Event Ingestion Service y `project_event_log`, incluyendo source IDs, period, amount/currency, authority, evidence, dedup y compensating reference.

## 10. Compatibilidad current→target

| Elemento actual | Evolución |
|---|---|
| `cost_actuals` | Base del actual-detail local; añade source identity, dates/period, posting/reversal y reconciliation semantics |
| `budget_items.actual_cost` | Compatibility rollup derivado |
| `procurement_items` | Commitment/procurement source; no actual owner |
| Timesheets/invoices/imports | Sources/candidates; pasan validation e ingestion |
| `project_event_log` | Único lifecycle/event ledger |
| Reports/Forecast/Closeout | Consumers del resolver financiero |

Legacy actuals sin source identity/period/evidence permanecen `legacy_unverified` o se backfillan con provenance; no se fabrican approvals ni posting dates.

## 11. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Mismo ERP line importado dos veces | Dedup; un actual |
| 2 | Idempotency key reutilizada con amount distinto | Conflict/quarantine |
| 3 | Accrual aprobado pero no posteado | No recognized cost |
| 4 | Accrual 80, actual matched 60 | Open accrual 20 |
| 5 | Actual posteado se intenta editar | Deny; reversal/adjustment |
| 6 | Reclass 50 de CA-A a CA-B | Movimientos balanceados; project total sin cambio |
| 7 | Accounting date cae en periodo cerrado | Deny o controlled adjustment/reopen |
| 8 | Payment ocurre un mes después | Actual/incurred date no cambia |
| 9 | Actual sin CBS mapping | Quarantine/exception; no asignación silenciosa |
| 10 | Service account intenta aprobar accrual | Deny |
| 11 | Poster reconcilia su propio batch material | Deny/independent review |
| 12 | `budget_items.actual_cost` difiere del resolver | Reconciliation failure; no sobrescribir owner |

## 12. Decisiones P3-T3

| ID | Decisión | Estado |
|---|---|---|
| P3-T3-D1 | Incurred evidence, actual, accrual, reversal, source document y payment son distintos. | Aprobada |
| P3-T3-D2 | `cost_actuals` evoluciona como actual-detail owner local. | Aprobada |
| P3-T3-D3 | Posted actual/accrual records son inmutables. | Aprobada |
| P3-T3-D4 | Correcciones usan reversal/adjustment/reclassification. | Aprobada |
| P3-T3-D5 | Accrual matching evita double count con actuals. | Aprobada |
| P3-T3-D6 | Fechas y fiscal period conservan semánticas separadas. | Aprobada |
| P3-T3-D7 | Finance conserva authority y SoD. | Aprobada |
| P3-T3-D8 | `budget_items.actual_cost` es projection derivada. | Aprobada |
| P3-T3-D9 | ProjectOps360° controla/reconcilia; no reemplaza ERP GL. | Aprobada |
| P3-T3-D10 | Lifecycle events usan únicamente `project_event_log`. | Aprobada |

## 13. Matriz de aceptación P3-T3

| Criterio | Resultado | Evidencia |
|---|---|---|
| Incurred cost y posted actual están separados | PASS | Secciones 1–4 |
| Accrual y reversal están definidos | PASS | Secciones 5–7 |
| Source document/identity es trazable | PASS | Secciones 2 y 4 |
| Balance y period semantics están definidos | PASS | Secciones 3 y 6 |
| Authority/SoD/reconciliation están definidos | PASS | Secciones 8 y 11 |
| Existing actual path se preserva | PASS | Sección 10 |
| Criterio original de aceptación | **PASS** | Incurred cost, posted actual, accrual, reversal and source document are distinct, balanced and period-aware. |

## Nota de cierre lista para ProjectOps360°

P3-T3 completada y validada. Se diseñó el actual-cost/accrual subledger conservando `cost_actuals` como owner local normalizado y `budget_items.actual_cost` como proyección derivada. Incurred/service evidence, source document, posted actual, accrual, reversal, accounting period y payment permanecen separados. Actuals exigen source identity, dates, period, dimensions, currency, evidence e idempotency; accruals tienen basis, approval, posting, match y reversal explícitos. Posted records son inmutables y toda corrección usa reversal, adjustment o reclassification balanceada. Recognized Cost To Date combina actuals reconciliados y open accruals elegibles bajo policy versionada, sin double count. Finance conserva autoridad y reconciliación independiente; eventos usan exclusivamente `project_event_log`. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T3_Actual_Cost_Accrual_Reversal_Ledger.md`.
