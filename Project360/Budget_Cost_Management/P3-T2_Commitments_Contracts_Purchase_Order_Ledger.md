# P3-T2 — Diseño del ledger de commitments, contracts y purchase orders

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T2 — Design commitments, contracts and purchase-order ledger |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P3-T1 |
| Owner | Procurement / Contract Management |
| Accountable | PMO / Project Controls Lead |
| Consultados | Finance; Legal; Product Architecture |
| Entregable | Commitment lifecycle and line-level linkage model |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P3** |
| Efecto | Define contrato y controles; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de arquitectura

Commitment es una obligación contractual aprobada y vigente, no una intención de compra, quote, forecast, invoice, payment o actual cost. Procurement / Contract Management conserva la fuente contractual; PMO controla exposición contra baseline; Finance reconcilia consumo y actuals.

El *commitment ledger* es el subledger de dominio de contratos/PO y movimientos de obligación. `procurement_items` evoluciona aditivamente como punto de integración e identidad, mientras `budget_items.committed_cost` se convierte en compatibility projection derivada. Toda historia lifecycle se registra en el único `project_event_log`; no se crea procurement/event ledger paralelo.

## 2. Modelo contractual

| Objeto | Regla |
|---|---|
| Procurement Case | Agrupa sourcing/request/quote sin crear commitment |
| Contract / Purchase Order | Header con supplier, legal entity, currency, terms y versión vigente |
| Contract/PO Version | Snapshot inmutable de original o amendment aprobado |
| Commitment Line | Obligación al nivel contractual mínimo reconciliable |
| Commitment Movement | Original, amendment, cancellation, transfer, consumption o correction |
| Receipt/Service Evidence | Evidencia operacional que puede soportar incurred cost o consumption |
| Commitment Match | Vínculo entre line, receipt/invoice/actual/accrual sin fusionar owners |
| Commitment Position | Proyección original/revised/consumed/cancelled/outstanding a un `as_of` |

Cada línea conserva organization/project, supplier/legal-party refs, contract/PO number y source ID, line number, version, CBS, WBS/control account, budget line, material/service scope, quantity/UOM, amount/currency, effective/service dates, taxes/retention policy, approval, evidence y confidentiality.

## 3. Creación de commitment

No crean commitment:

- purchase requisition o request;
- RFQ/RFP;
- supplier quote o bid;
- recommendation o selected supplier sin award;
- draft contract/PO;
- planned procurement item;
- invoice sin contrato cuando requiere regularización.

Crean commitment únicamente un contract/PO/award **approved + executed/issued + posted** conforme a policy. Si una jurisdicción reconoce una obligación antes de firma, la policy versionada debe definir trigger, authority y evidence; no se infiere por label/status.

## 4. Posiciones y reconciliación

Por contract/PO line, moneda y effective period:

- `Original Commitment = approved original line movements`.
- `Approved Amendments = increases - decreases`.
- `Current Commitment = Original Commitment + Approved Amendments - Approved Cancellations`.
- `Consumed Commitment = matched incurred/actual/accrual amount según consumption policy, neto de reversals`.
- `Outstanding Commitment = Current Commitment - Consumed Commitment`.

Quantity y amount se reconcilian por separado. Una reducción no puede ocultar over-consumption; si consumed supera current, se crea exception visible. Impuestos, retenciones, escalation, allowances y options declaran si están incluidos. No se agregan monedas sin FX provenance.

Consumption no cambia Actual Cost: referencia una obligación consumida por receipt, invoice, actual o accrual aprobado. La policy evita contar simultáneamente receipt, invoice, accrual y actual como cuatro consumos.

## 5. Versioning y amendments

| Acción | Tratamiento |
|---|---|
| Original award | Version 1 inmutable + original movement |
| Amendment aprobado | Nueva version con delta por línea y reason |
| Cancellation | Movimiento negativo aprobado; no borra línea |
| Administrative correction | Nueva versión o adjustment sin alterar valor comercial cuando aplique |
| Reassignment entre CBS/control accounts | Dos movimientos balanceados y evidence |
| Termination | Estado explícito + cancellation/remaining treatment |
| Supersession | Version anterior permanece trazable |

Una amendment draft/pending no modifica current commitment. Change control y contractual amendment se enlazan, pero ninguno reemplaza al otro: financial change autoriza impacto de control; contract/PO amendment modifica obligación legal/comercial.

## 6. Lifecycle

### 6.1 Procurement pre-commitment

`planned → requested → sourcing → quoted → evaluated → selected`

Permanece fuera de commitment hasta award/issue/posting.

### 6.2 Contract/PO

`draft → submitted → approved → executed_or_issued → posted → active → completed | terminated | closed`

Rutas alternativas: `rejected`, `withdrawn`, `cancelled`. Approved-not-issued y issued-not-posted permanecen separados.

### 6.3 Commitment line

`proposed → approved → posted → partially_consumed → fully_consumed → closed`

Amendment, cancellation, reversal y disputed son movimientos/estados explícitos con expected-state.

## 7. Ownership, autoridad y SoD

| Acción | Responsible | Accountable | Control |
|---|---|---|---|
| Solicitar compra | PM/authorized requester | PMO | No crea commitment |
| Preparar contract/PO | Procurement | Procurement lead | Evidence y legal review |
| Aprobar award/PO | Authority según matrix | PMO / authorized sponsor | Requester ≠ approver |
| Ejecutar/emitir | Procurement/authorized signatory | Legal/Procurement authority | Signature authority |
| Postear commitment | Authorized poster/integration | PMO | Approver ≠ poster |
| Registrar consumption match | Finance/Procurement matcher | Finance Controller | No auto-reconciliation |
| Reconciliar | PMO + Finance | PMO lead | Poster ≠ reconciler |

Supplier/external users no aprueban ni postean internal commitments. Commercially sensitive payloads usan `confidential` o `audit_only` y permission scope.

## 8. Eventos canónicos

- `procurement_request_created`, `supplier_selected`;
- `contract_awarded`, `purchase_order_issued`;
- `commitment_posted`, `commitment_amended`, `commitment_cancelled`;
- `commitment_consumed`, `commitment_consumption_reversed`;
- `commitment_closed`, `commitment_reconciled`;
- `commitment_exception_opened`, `commitment_exception_resolved`.

Todos se registrarán mediante el Event Ingestion Service en `project_event_log`, con source contract/PO ID, line/version, supplier scope, approval, amount/currency, effective date, evidence, causation y dedup fingerprint. Correcciones usan compensating events.

## 9. Compatibilidad current→target

| Elemento actual | Evolución aditiva |
|---|---|
| `procurement_items` | Conserva IDs/links/status operacional; añade source identity, line/version y commitment semantics |
| `material_requirements` | Input de quantity/material; no obligación |
| `budget_items.committed_cost` | Rollup de compatibilidad derivado, no input manual |
| `cost_actuals` | Owner local de actual detail; se enlaza mediante match |
| `project_approval_matrix` | Authority y thresholds reutilizados |
| `project_event_log` | Único ledger de historia/eventos |
| Living Graph/Reports | Proyectan contract/commitment state; no lo poseen |

Los status actuales de `procurement_items` se mapean de forma explícita. `ordered` puede ser candidate para issued PO, pero no prueba approval/posting sin evidence.

## 10. Controles mínimos

1. Unique source identity por system/legal entity/document/line/version.
2. Idempotency por source transaction y operation.
3. Version snapshots y deltas inmutables.
4. Approval/issue/posting separados.
5. Line-level CBS/WBS/control-account linkage.
6. Currency/UOM/tax/retention policy explícitas.
7. No over-cancellation ni silent negative outstanding.
8. Consumption matching anti-double-count.
9. Confidentiality, tenant isolation y least privilege.
10. Reconciliation header→lines→movements→projection→source evidence.

## 11. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Quote aceptada informalmente sin PO/contract ejecutado | No commitment |
| 2 | PO original 100 y amendment +20 | Original 100; revised/current 120 |
| 3 | Cancellation 15 sobre current 120 | Cancelled 15; current 105 |
| 4 | Consumed 70 sobre current 105 | Outstanding 35 |
| 5 | Invoice y actual representan el mismo costo | Un solo consumption match |
| 6 | Amendment pending +25 | No cambia current commitment |
| 7 | Retry de PO source line/version | Dedup |
| 8 | Misma source identity con amount diferente | Conflict; quarantine |
| 9 | Cancellation deja current menor que consumed | Exception; no ocultar |
| 10 | PM solicita y aprueba su PO | Deny por SoD |
| 11 | Línea confidential consultada por stakeholder externo | Deny/masked |
| 12 | `budget_items.committed_cost` difiere del resolver | Reconciliation failure; owner permanece subledger |

## 12. Decisiones P3-T2

| ID | Decisión | Estado |
|---|---|---|
| P3-T2-D1 | Commitment nace solo de obligación contractual aprobada, emitida/ejecutada y posteada. | Aprobada |
| P3-T2-D2 | Contract/PO versions y commitment movements son inmutables. | Aprobada |
| P3-T2-D3 | Original, revised, consumed, cancelled y outstanding permanecen separados. | Aprobada |
| P3-T2-D4 | Consumption usa matching gobernado y evita double count. | Aprobada |
| P3-T2-D5 | `procurement_items` evoluciona aditivamente como identidad/owner local. | Aprobada |
| P3-T2-D6 | `budget_items.committed_cost` es compatibility projection. | Aprobada |
| P3-T2-D7 | Procurement, PMO y Finance conservan funciones separadas. | Aprobada |
| P3-T2-D8 | Confidencialidad contractual es deny-by-default. | Aprobada |
| P3-T2-D9 | Correcciones usan version/reversal/adjustment. | Aprobada |
| P3-T2-D10 | Eventos usan únicamente `project_event_log`. | Aprobada |

## 13. Matriz de aceptación P3-T2

| Criterio | Resultado | Evidencia |
|---|---|---|
| Original y revised commitment están definidos | PASS | Secciones 2–5 |
| Consumed, cancelled y outstanding están definidos | PASS | Sección 4 |
| Contract/PO evidence y line-level linkage están definidos | PASS | Secciones 2 y 9 |
| Approval/posting/SoD están definidos | PASS | Secciones 6–7 |
| Source identity e idempotency están definidos | PASS | Secciones 8 y 10 |
| Existing procurement/budget paths se preservan | PASS | Sección 9 |
| Criterio original de aceptación | **PASS** | Original, revised, consumed, cancelled and outstanding commitment values reconcile to contract/PO evidence. |

## Nota de cierre lista para ProjectOps360°

P3-T2 completada y validada. Se diseñó el commitment subledger con Contract/PO headers, versiones inmutables, líneas y movimientos originales, amendments, cancellations, consumption y corrections. Una request, quote, selection o draft no crea commitment; solo una obligación aprobada, ejecutada/emitida y posteada. Original, revised/current, consumed, cancelled y outstanding se reconcilian por línea, moneda, UOM, periodo y evidencia contractual. Receipt, invoice, accrual y actual se vinculan mediante matching anti-double-count sin fusionar owners. `procurement_items` evoluciona aditivamente; `budget_items.committed_cost` queda como proyección derivada. Procurement, PMO, Finance y Legal mantienen authority/SoD y los eventos usan exclusivamente `project_event_log`. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T2_Commitments_Contracts_Purchase_Order_Ledger.md`.
