# P3-T5 — Diseño de change control, contingency y management reserve

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T5 — Design change control, contingency and management reserve |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P3-T1; P2-T5 |
| Owner | PMO / Project Controls Lead |
| Accountable | Change Control Board / Sponsor |
| Consultados | Project Manager; Finance; Risk Manager; Product Architecture |
| Entregable | Change and reserve governance model |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P3** |
| Efecto | Define contrato y controles; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de arquitectura

Financial Change, Contingency y Management Reserve son objetos gobernados y separados. Un change pending no altera Current Baseline, Funding, Commitment, Actual Cost ni reserva. Contingency cubre incertidumbre/riesgos identificados dentro del alcance aprobado según policy; Management Reserve cubre unknown-unknowns o decisiones de management fuera de la control baseline y permanece bajo Sponsor/Steering authority.

Change/reserve *ledgers* son subledgers de dominio de packages, accounts y movements. Eventos y audit history viven exclusivamente en `project_event_log`. Existing risks, decisions, approval matrix, RACI y baseline lifecycle se reutilizan; no se crea un change engine o approval system paralelo.

## 2. Financial Change Package

Cada package declara:

- stable change ID, version y organization/project scope;
- origin, requestor, reason y urgency;
- scope statement y affected deliverables;
- CBS/WBS/control-account/budget-line refs;
- cost impact por moneda y periodo;
- schedule, resource, procurement/commitment y cash impacts;
- funding request/release/restriction impact;
- contingency o management-reserve treatment;
- risk/opportunity links;
- forecast impact separado del baseline impact;
- alternatives, benefits y consequences of no action;
- evidence, assumptions, confidence y completeness;
- approval route, thresholds, policy/version y effective date;
- implementation/posting plan y verification owner.

Un package puede tener múltiples impacts, pero cada target owner cambia mediante su propio authorized posting enlazado al mismo decision/correlation ID.

## 3. Change lifecycle

`draft → submitted → triaged → assessed → recommended → approved → authorized_for_posting → posted → implemented → verified → closed`

Rutas alternativas:

- `rejected`;
- `withdrawn`;
- `deferred`;
- `superseded`;
- `emergency_authorized` seguida de retrospective review;
- `approved_not_posted`;
- `posting_failed` y retry controlado.

Solo `posted` afecta Current Baseline u otro owner financiero. Approved-not-posted es una decisión pendiente de ejecución y aparece separada en exposure.

## 4. Separación de impactos

| Estado | Baseline | Forecast | Funding | Commitment/Actual | Cash |
|---|---|---|---|---|---|
| Draft/pending | Sin cambio | Potential impact opcional | Sin cambio | Sin cambio | Scenario |
| Assessed/recommended | Sin cambio | Risk/change exposure visible | Request candidate | Sin cambio | Scenario |
| Approved-not-posted | Sin cambio | Awaiting impact explícito | Release/request según workflow separado | Sin cambio | Approved scenario |
| Posted | Nueva baseline version o movement autorizado | Forecast puede actualizarse por versión propia | Movimiento funding separado | Contract/actual owners cambian por sus workflows | Cash version propia |
| Rejected/withdrawn | Sin cambio | Exposure removido con history | Sin cambio | Sin cambio | Sin cambio |

No existe una actualización masiva silenciosa de todas las verdades. La correlación coordina movimientos atómicos/compensables y conserva owners.

## 5. Contingency

### 5.1 Propósito

Contingency es una provisión cuantificada para riesgos/incertidumbre identificados dentro del approved scope. Debe vincularse a risk IDs, model/version, confidence/range, ownership, affected CBS/control accounts y release criteria.

### 5.2 Cuenta y movimientos

`Contingency Account = opening approved amount + transfers in - transfers out - approved drawdowns + approved returns ± corrections`.

Movimientos:

- establish;
- allocate/distribute;
- drawdown;
- transfer;
- return;
- release at risk retirement;
- correction/reversal.

El drawdown exige risk/change reference y no crea Actual Cost. Mueve baseline/reserve position solo cuando el change/posting correspondiente se ejecuta.

### 5.3 Controles

- No double count entre line allowances, risk-loaded estimate y contingency.
- No drawdown por “miscellaneous” sin reason/evidence.
- Risks retirados disparan review de release/return.
- Correlation entre risk realization, change approval y reserve movement.
- Totals por moneda y effective period.

## 6. Management Reserve

Management Reserve:

- permanece fuera de la project control baseline hasta release aprobado;
- pertenece a Sponsor/Steering, no al PM;
- no se distribuye automáticamente a control accounts;
- tiene purpose, authority, threshold, effective period, currency y evidence;
- requiere change/management decision para transferirse;
- no se usa para ocultar overrun, variance o scope creep;
- se reporta separada de contingency y undistributed budget.

Movimientos: establish, increase, decrease, release, transfer, return, revoke y correction. Cada release crea trazabilidad entre reserve account, decision, funding/baseline impact y recipient control account.

## 7. Emergency change

Emergency no significa bypass invisible. El flujo exige:

1. emergency reason y harm prevented;
2. named break-glass authority vigente;
3. minimum scope/amount/time;
4. evidence y timestamp;
5. temporary authorization con expiry;
6. event/audit visibility inmediata;
7. retrospective CCB/Sponsor review dentro de SLA;
8. approve, adjust/reclassify o reverse outcome;
9. independent reconciliation;
10. exception si el review vence.

La policy global de seguridad no se deshabilita. El cambio emergency conserva tenant isolation y least privilege.

## 8. Thresholds y anti-splitting

- Thresholds se evalúan por gross impact, net impact y cumulative related impacts.
- Related changes por cause, vendor, scope, period o correlation se agregan.
- Dividir un change para quedar debajo de authority se detecta y escala.
- Amount, schedule, safety, compliance y strategic impact pueden elevar authority.
- Un approver no puede delegar por encima de su propio scope/threshold.
- Approval expiry y conditions se revalidan al posting.

## 9. Ownership y SoD

| Acción | Responsible | Accountable | Control |
|---|---|---|---|
| Solicitar change | PM/authorized requester | PMO | Request no altera owners |
| Preparar assessment | PMO/discipline/cost engineer | PMO lead | Evidence/completeness |
| Revisar risk/contingency | Risk Manager | PMO/CCB | Independent challenge |
| Aprobar change | CCB/Sponsor según threshold | CCB/Sponsor | Requester/preparer ≠ approver |
| Aprobar MR release | Sponsor/Steering | Sponsor | No PM delegation implícita |
| Postear movement/baseline | Authorized poster | PMO Admin | Approver ≠ poster |
| Reconciliar | Finance/independent PMO | Controller/PMO lead | Poster ≠ reconciler |

Isabella puede detectar probable double count, resumir evidence, simular impact y explicar status; no crea, aprueba ni postea.

## 10. Eventos canónicos

- `financial_change_submitted`, `financial_change_assessed`;
- `financial_change_approved`, `financial_change_rejected`, `financial_change_withdrawn`;
- `financial_change_posted`, `financial_change_reversed`;
- `emergency_change_authorized`, `emergency_change_reviewed`;
- `contingency_established`, `contingency_drawn`, `contingency_returned`;
- `management_reserve_established`, `management_reserve_released`, `management_reserve_revoked`;
- `reserve_reconciled`, `reserve_exception_opened`.

Los eventos se registrarán mediante registry/Event Ingestion Service en `project_event_log`, con subject/source refs, approval, authority, risk/change links, amount/currency/period, evidence, causation, idempotency y compensation.

## 11. Compatibilidad current→target

| Elemento actual | Decisión |
|---|---|
| Risks | Owner de risk identity/status; se enlaza, no se copia |
| Decisions | Owner de decision evidence; se referencia |
| `project_approval_matrix` | Authority/threshold base; extensión aditiva |
| P2 baseline versions | Único path de rebaseline por posted change |
| `budget_items` category/metadata | No prueba contingency/MR ni approval |
| Funding subledger P3-T1 | Movimiento separado y correlacionado |
| `project_event_log` | Único event/audit ledger |
| Living Graph/Process Mining | Proyección de flow/impact/handoffs |

Legacy “contingency” en una línea se trata como allowance/classification candidate hasta demostrar reserve account, policy, risk basis y approval.

## 12. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Change pending por 100 | Baseline sin cambio; potential impact visible |
| 2 | Change aprobado pero no posteado | Approved-not-posted; baseline sin cambio |
| 3 | Posted change +40 | Nueva baseline version mediante P2-T5 |
| 4 | Rejected change | History preservada; sin impact |
| 5 | Contingency draw sin risk/change ref | Deny |
| 6 | Management Reserve liberada por PM | Deny |
| 7 | Risk allowance ya incluido y contingency lo duplica | Exception/deny |
| 8 | Tres changes relacionados bajo threshold individual | Aggregate y escalar |
| 9 | Emergency change sin retrospective review | Exception/hold/required review |
| 10 | Correction edita reserve movement | Deny; reversal/adjustment |
| 11 | Sponsor release MR a control account | Allow con change, authority y posting |
| 12 | Isabella intenta aprobar change | Deny; advisory only |

## 13. Decisiones P3-T5

| ID | Decisión | Estado |
|---|---|---|
| P3-T5-D1 | Pending, approved, posted, rejected y emergency changes permanecen distintos. | Aprobada |
| P3-T5-D2 | Solo posted change afecta Current Baseline. | Aprobada |
| P3-T5-D3 | Contingency se vincula a riesgos identificados y policy. | Aprobada |
| P3-T5-D4 | Management Reserve se gobierna separadamente por Sponsor/Steering. | Aprobada |
| P3-T5-D5 | Reserve movements son inmutables y reconciliables. | Aprobada |
| P3-T5-D6 | Emergency conserva evidence, expiry, review y SoD. | Aprobada |
| P3-T5-D7 | Thresholds aplican cumulative impact y anti-splitting. | Aprobada |
| P3-T5-D8 | Risks, decisions, approvals y baseline owners existentes se reutilizan. | Aprobada |
| P3-T5-D9 | Isabella permanece advisory-only. | Aprobada |
| P3-T5-D10 | Events usan exclusivamente `project_event_log`. | Aprobada |

## 14. Matriz de aceptación P3-T5

| Criterio | Resultado | Evidencia |
|---|---|---|
| Pending, approved, rejected y emergency están separados | PASS | Secciones 3 y 7 |
| Approved-not-posted no altera baseline | PASS | Sección 4 |
| Contingency está vinculada a risks | PASS | Sección 5 |
| Management Reserve está separada | PASS | Sección 6 |
| Authority/SoD/anti-splitting están definidos | PASS | Secciones 8–9 |
| Existing owners se preservan | PASS | Sección 11 |
| Criterio original de aceptación | **PASS** | Pending, approved, rejected and emergency changes remain distinct; contingency is tied to identified risks; management reserve is separately governed. |

## Nota de cierre lista para ProjectOps360°

P3-T5 completada y validada. Se diseñó un Financial Change Package versionado que separa draft, pending, assessed, approved, approved-not-posted, posted, rejected, withdrawn y emergency. Solo un posted change puede crear una nueva Current Baseline version; cada impacto en funding, commitment, forecast, reserve o cash conserva su owner y movement correlacionado. Contingency queda vinculada a riesgos identificados, model/version y drawdown criteria; Management Reserve permanece separada, fuera de la control baseline hasta release del Sponsor/Steering. Emergency changes exigen break-glass limitado, evidence, expiry y retrospective review. Thresholds agregan impactos relacionados y evitan splitting. Existing risks, decisions, governance y baseline lifecycle se reutilizan; Isabella sigue advisory-only y eventos usan exclusivamente `project_event_log`. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T5_Change_Control_Contingency_Management_Reserve.md`.
