# P3-T4 — Diseño del ledger de payments y cash flow

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T4 — Design payment and cash-flow ledger |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P3-T3 |
| Owner | Finance / Treasury |
| Accountable | Finance / Controller |
| Consultados | PMO; Accounts Payable; Product Architecture |
| Entregable | Payment and cash-flow timing model |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P3** |
| Efecto | Define contrato y controles; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de arquitectura

Payment y Cash Flow permanecen separados de Actual Cost, incurred timing y accounting period. Un pago liquida una obligación monetaria; no crea ni mueve la fecha económica del costo. Cash Flow es una proyección temporal de entradas/salidas esperadas y realizadas, no una séptima versión de budget o actual.

El *payment/cash-flow ledger* es el subledger de dominio de payment instructions, settlements y cash-flow buckets. La historia lifecycle se registra exclusivamente en `project_event_log`. ProjectOps360° integra y reconcilia referencias de AP/Treasury/bank; no reemplaza ERP AP, treasury management ni banca.

## 2. Objetos canónicos

| Objeto | Propósito |
|---|---|
| Payment Obligation Reference | Vínculo a invoice, contract milestone, retention, tax u obligación |
| Payment Request | Solicitud preparada para aprobación |
| Payment Approval | Decisión de liberar según authority/SoD |
| Payment Instruction | Orden emitida a AP/Treasury/bank |
| Payment Settlement | Confirmación de pago, partial payment, return o reversal |
| Cash-Flow Assumption | Regla de timing, probability y source |
| Cash-Flow Bucket | Monto por period/currency/scenario/state/source |
| Cash-Flow Position | Proyección a un `as_of`, separada por states |
| Cash Reconciliation | Comparación planned/forecast/instructed/settled/source statement |

Cada registro conserva organization/project, payee/legal entity, source invoice/contract/actual refs, amount/currency, due/scheduled/value/settlement dates, bank/AP source IDs, payment method reference no sensible, CBS/WBS/control account, approval, policy, evidence y visibility.

## 3. Estados separados de cash flow

| Estado | Significado |
|---|---|
| Planned | Curva derivada de plan/baseline/estimate assumptions |
| Forecast | Expectativa vigente con probability/timing/source |
| Committed | Curva derivada de contract/PO payment terms |
| Invoiced | Invoice recibido/validado, aún no necesariamente aprobado |
| Approved for payment | Payment release autorizado, no settlement |
| Instructed | Orden enviada a AP/Treasury/bank |
| Paid/settled | Confirmación de salida de caja |
| Returned/reversed | Movimiento compensatorio posterior |

Estos estados no forman una sola transición universal: una posición puede mostrar simultáneamente planned, committed, invoiced y paid para explicar el bridge. Los resolver contracts previenen sumar todas las columnas como si fueran componentes independientes.

## 4. Payment lifecycle

`draft → submitted → validated → approved → scheduled → instructed → partially_settled → settled → reconciled → closed`

Rutas explícitas:

- `rejected` o `withdrawn` antes de instruction;
- `held` por dispute, compliance, funding restriction o incomplete evidence;
- `cancelled` si la instruction no fue settled;
- `returned`, `reversed` o `reissued` después de settlement;
- `exception` por amount/date/payee/source mismatch.

Approved-not-instructed e instructed-not-settled no son pagos realizados.

## 5. Semántica de fechas

| Fecha | Uso |
|---|---|
| Incurred/service date | Cost truth; no cambia por payment |
| Invoice/document date | Source obligation |
| Due date | Contract/AP obligation |
| Forecast payment date | Expectativa de cash |
| Scheduled date | Plan operativo de liberación |
| Instruction date | Orden enviada |
| Bank value/settlement date | Cash realized |
| Accounting date | Posting financiero; puede diferir |
| Recorded at | Ingestion/audit timestamp |

Un settlement tardío cambia cash variance y aging, no Actual Cost histórico. Un prepayment puede generar cash antes del incurred cost y queda vinculado a su future service/contract treatment.

## 6. Forecast cash-flow model

Cada bucket declara:

- scenario/version y `as_of`;
- period granularity/calendar;
- state/source class;
- amount/currency y FX policy;
- probability/confidence cuando aplique;
- source object/version;
- timing method/assumption;
- CBS/WBS/control account;
- inclusion/exclusion y anti-double-count group;
- preparer/reviewer/approval status.

Bridges mínimos:

- planned → current forecast;
- current forecast → committed curve;
- committed → invoiced/due;
- invoiced/approved → instructed;
- instructed → settled;
- prior forecast → actual cash, con timing y amount variance.

Funding schedule puede compararse con cash demand, pero release/availability no se convierte en cash receipt ni payment.

## 7. Currency, netting y signs

- Transaction, payment, bank y reporting currency permanecen separadas.
- FX source/date/rate/policy se conserva por bucket/settlement.
- Gross, tax, withholding, retainage, discount, fee y net paid se reconcilian.
- Returns y reversals usan signs/movements explícitos.
- Netting entre invoices/payments exige policy, legal entity, counterparty y evidence.
- No se almacenan account numbers, credentials, tokens o datos bancarios sensibles en event payloads.

## 8. Ownership, authority y SoD

| Acción | Responsible | Accountable | Control |
|---|---|---|---|
| Preparar cash forecast | PMO / Project Controls | PMO lead | Version/review |
| Validar invoice/payment basis | AP / Finance | Controller | Source evidence |
| Aprobar payment | Authorized approver | Finance / Controller | Requester ≠ approver |
| Emitir instruction | Treasury/AP poster o integration | Treasury authority | Approver ≠ releaser |
| Confirmar settlement | Source integration | Treasury | Stable source identity |
| Reconciliar | Independent Finance/Treasury | Controller | Releaser ≠ reconciler |
| Auditar | Audit | PMO Admin | Read-only |

Emergency payment usa break-glass, least privilege, evidence, expiry y retrospective review; no elimina SoD ni deja el evento oculto.

## 9. Eventos canónicos

- `payment_requested`, `payment_approved`, `payment_held`;
- `payment_scheduled`, `payment_instructed`;
- `payment_partially_settled`, `payment_settled`;
- `payment_returned`, `payment_reversed`, `payment_reissued`;
- `cash_forecast_published`, `cash_forecast_superseded`;
- `cash_reconciled`, `cash_exception_opened`.

Events usan Event Ingestion Service, registry y `project_event_log`, con data minimization, permission scope, source identity, dates, amount/currency, authority, evidence, idempotency y compensation.

## 10. Compatibilidad current→target

| Capacidad actual | Decisión |
|---|---|
| `cost_actuals` | Actual Cost owner; payment refs no cambian incurred/accounting semantics |
| `procurement_items` | Contract/PO/payment-term source; no payment owner |
| `budget_items` | No almacena payment/cash truth |
| Funding | Fuente de restrictions/availability; no cash settlement |
| Forecast | Cost forecast separado; puede aportar timing assumptions |
| `project_event_log` | Único lifecycle/event ledger |
| Reports/Living Graph/Process Mining | Proyecciones de cash/payment flow |

Legacy values llamados “paid” o “cash” se clasifican por source/evidence. Sin settlement identity quedan `unverified`, no se promueven.

## 11. Controles y reconciliación

1. Stable AP/bank instruction/settlement identity.
2. Retry-safe imports y payload conflict rejection.
3. Payment approval, release e independent reconciliation.
4. No payment sin obligation/evidence o approved exception.
5. Partial settlements y residual explícitos.
6. Gross-to-net reconciliation.
7. Currency/FX/date provenance.
8. Period/state/source anti-double-count.
9. Sensitive-data minimization y permission scope.
10. Cash buckets reconcile to source statements and movement totals.

## 12. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Actual incurred en marzo, pago en mayo | Actual marzo; cash mayo |
| 2 | Payment aprobado pero no instruido | No paid cash |
| 3 | Instruction emitida sin settlement | Instructed; no settled |
| 4 | Pago parcial 60 de invoice 100 | Settled 60; residual 40 |
| 5 | Bank return posterior | Compensating return; settlement history permanece |
| 6 | Planned, committed e invoiced representan misma obligación | Anti-double-count group; bridge, no suma ciega |
| 7 | Retry del mismo bank transaction | Dedup |
| 8 | Source ID repetido con payee/amount distinto | Conflict/quarantine |
| 9 | Prepayment antes de service | Cash temprano; actual aún no incurrido |
| 10 | PM solicita y libera su pago | Deny por SoD |
| 11 | Event payload contiene bank account completo | Deny/redact |
| 12 | Funding disponible insuficiente | Hold/exception según policy; no alterar actual |

## 13. Decisiones P3-T4

| ID | Decisión | Estado |
|---|---|---|
| P3-T4-D1 | Payment/Cash Flow permanecen separados de Actual Cost. | Aprobada |
| P3-T4-D2 | Planned, forecast, committed, invoiced, approved, instructed y settled son posiciones separadas. | Aprobada |
| P3-T4-D3 | Payment no altera incurred/accounting timing. | Aprobada |
| P3-T4-D4 | Partial/return/reversal preservan movimientos e historia. | Aprobada |
| P3-T4-D5 | Cash bridges aplican anti-double-count. | Aprobada |
| P3-T4-D6 | Treasury/AP conservan source y release authority. | Aprobada |
| P3-T4-D7 | ProjectOps360° integra/controla, no reemplaza banca/AP. | Aprobada |
| P3-T4-D8 | Currency/date/gross-to-net provenance es obligatoria. | Aprobada |
| P3-T4-D9 | Sensitive payment data se minimiza. | Aprobada |
| P3-T4-D10 | Events usan exclusivamente `project_event_log`. | Aprobada |

## 14. Matriz de aceptación P3-T4

| Criterio | Resultado | Evidencia |
|---|---|---|
| Payment no altera incurred-cost timing | PASS | Secciones 1 y 5 |
| Planned y forecast cash están definidos | PASS | Secciones 3 y 6 |
| Committed e invoiced cash están definidos | PASS | Secciones 3 y 6 |
| Paid/settled y reversals están definidos | PASS | Secciones 3–4 |
| Authority/SoD/reconciliation están definidos | PASS | Secciones 8 y 11 |
| Existing owners se preservan | PASS | Sección 10 |
| Criterio original de aceptación | **PASS** | Payment does not alter incurred-cost timing; forecast cash flow supports planned, committed, invoiced and paid states. |

## Nota de cierre lista para ProjectOps360°

P3-T4 completada y validada. Se diseñó el payment/cash-flow subledger manteniendo incurred/service date, accounting period, invoice, payment instruction y settlement como hechos separados. Cash Flow soporta planned, forecast, committed, invoiced, approved-for-payment, instructed, settled y returned/reversed mediante buckets y bridges anti-double-count. Un approval o instruction no equivale a pago; partial settlements conservan residual; returns/reversals son compensatorios. Funding se compara contra demanda de caja sin confundirse con cash receipt o payment. Treasury/AP/Finance aplican maker–checker–releaser–reconciler, currency/FX/gross-to-net provenance y data minimization. ProjectOps360° no reemplaza AP/banca y todos los eventos usan exclusivamente `project_event_log`. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T4_Payment_Cash_Flow_Ledger.md`.
