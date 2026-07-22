# P1-T5 — State machines financieros e invariantes

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T5 — Define lifecycle state machines and invariants |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P1-T1; P1-T3 |
| Owner | Product Architecture |
| Accountable | PMO / Project Controls Lead |
| Consultados | Finance; Procurement; Security; Engineering |
| Entregable | State diagrams para estimate, budget, baseline, commitment, actual, accrual, payment, change y reserve |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P1** |
| Efecto | Define transiciones e invariantes; no implementa un status engine paralelo |

## 1. Decisión de lifecycle

Cada objeto financiero posee un lifecycle de negocio propio. Estos estados no reemplazan Execution Status, health, risk ni approval authority. Un **financial lifecycle resolver** validará transiciones del dominio y proyectará compatibilidad al status existente cuando sea necesario; no se crea `financial-status-engine`.

Una transición controlada requiere comando autorizado, estado esperado, policy/version, actor, evidence, idempotency key y evento canónico. El cambio de owner y la captura en `project_event_log` deberán ser atómicos en arquitectura posterior.

## 2. Convenciones

| Convención | Significado |
|---|---|
| Terminal | Estado no editable; una corrección usa nueva versión o compensación |
| Reversible | Solo mediante transición explícita y authority definida |
| Superseded | La versión permanece histórica y otra toma vigencia |
| Rejected/Withdrawn | No produce efecto financiero oficial |
| Posted/Published | El efecto fue aplicado por un poster/publisher autorizado |
| Reconciled | Un reviewer independiente cuadró source, scope y amount |

Ningún objeto obtiene approval por cambiar un string de estado. Approval y posting conservan actors, timestamps y policy snapshots separados.

## 3. Estimate / Basis of Estimate

**Ruta principal:**

`draft → prepared → submitted → reviewed → approved_for_budget_proposal → superseded`

**Rutas alternativas:**

- `draft|prepared|submitted → withdrawn`;
- `submitted|reviewed → rejected`;
- `reviewed → prepared` mediante return-for-rework;
- cualquier nueva revisión material crea versión y supersede la anterior aprobada.

**Invariantes:**

- Estimate approval solo confirma aptitud como proposal; no crea Funding, Original Budget ni Baseline.
- BOE, scope maturity, assumptions, exclusions, source dates y estimator son obligatorios para aprobación.
- `material_requirements` y cost library pueden aportar evidencia, no authority.
- AACE class, cuando aplica al framework, se determina por madurez/calidad de entregables y no garantiza accuracy.

## 4. Original Budget

**Ruta principal:**

`draft → submitted → approved → activated`

**Rutas alternativas:**

- `draft|submitted → withdrawn`;
- `submitted → rejected`;
- `submitted → draft` por rework;
- `approved → activation_failed` si posting/reconciliation falla; requiere retry idempotente o nueva decisión.

**Invariantes:**

- antes de `activated`, líneas, currency, period y BOE deben cuadrar;
- preparer ≠ approver ≠ poster;
- después de `activated`, la versión es inmutable y permanece Original Budget del proyecto;
- no existe transición `activated → draft/edited`;
- cambios posteriores pasan por Change + Current Baseline, no por edición del original;
- solo una versión puede activarse como Original Budget por scope canónico, salvo re-charter expresamente gobernado que conserva ambos records.

## 5. Current Baseline

**Ruta por versión:**

`draft → submitted → approved → active → superseded → archived`

**Rutas alternativas:**

- `submitted → rejected|withdrawn|draft`;
- `approved → activation_failed`;
- `active → closed` al cierre final del proyecto, sin perder history.

**Invariantes:**

- solo una versión está `active` por project/scope/currency/effective window;
- activar una nueva versión y supersede la anterior ocurre atómicamente;
- pending/rejected changes no se incorporan;
- toda diferencia con Original Budget tiene bridge a changes/reserve movements posteados;
- no se modifica una baseline activa; se crea nueva versión;
- requester/preparer, approver y poster cumplen SoD y threshold acumulado.

## 6. Commitment

**Pre-commitment:**

`planned → requested → quoted → selected`

Estos estados no son Commitment canónico.

**Commitment contractual:**

`prepared → submitted → approved → posted → open → partially_consumed → fully_consumed → closed`

**Rutas alternativas:**

- `submitted → rejected|withdrawn`;
- `approved → posting_failed`;
- `posted|open|partially_consumed → amended` mediante nueva version/amendment;
- `posted|open|partially_consumed → cancelled` por cancelación autorizada;
- `closed` solo se reabre mediante exception/authority explícita.

**Invariantes:**

- quote, requisition o selection no contribuyen al total canónico;
- contract/PO source identity y version son obligatorios desde `approved`;
- buyer/preparer no aprueba su propia requisición;
- consumption requiere match trazable con actual/receipt y no borra el commitment original;
- amendment/cancellation es movimiento/version, no overwrite;
- `budget_items.committed_cost` solo refleja rollup derivado.

## 7. Actual Cost

**Ruta principal:**

`received → validated → posted → reconciled`

**Rutas alternativas:**

- `received|validated → quarantined` por duplicado, scope, currency, period o source conflict;
- `received|validated → rejected`;
- `posted → adjusted|reversed` únicamente mediante transacción compensatoria ligada;
- `reconciled → reopened_exception` solo por mismatch posterior material y reviewer autorizado.

**Invariantes:**

- source identity/idempotency impide duplicados;
- service account valida/postea pero no aprueba el source transaction;
- una fila posteada no se edita ni se mueve silenciosamente de período;
- reconciliation actor es distinto de preparer/approver/poster;
- un actual sin mapping puede postearse según Finance policy, pero permanece `unmapped/unreconciled` para control;
- payment state no cambia Actual Cost lifecycle.

## 8. Accrual

**Ruta principal:**

`proposed → validated → approved → posted → outstanding → partially_matched → matched → reversed → closed`

**Rutas alternativas:**

- `proposed|validated → rejected|withdrawn`;
- `approved → posting_failed`;
- `outstanding → reversed` en período configurado;
- `matched` enlaza actual replacement y evita doble conteo.

**Invariantes:**

- proposal matemática sin evidencia no se aprueba;
- proposer/preparer ≠ approver/poster/reconciler;
- amount, period, method, reversal policy y evidence son obligatorios;
- matching nunca conserva accrual y actual como reconocidos simultáneamente por el mismo costo;
- closed period policy aplica a posting/reversal;
- accrual no equivale a invoice, actual payment ni cash forecast.

## 9. Payment

**Ruta principal:**

`scheduled → validated → approved → released → settled → reconciled → closed`

**Rutas alternativas:**

- `scheduled|validated → held|rejected|cancelled`;
- `approved → release_failed`;
- `released → returned|failed`;
- `settled → reversed` mediante bank/ERP evidence y compensación.

**Invariantes:**

- invoice/receipt validation y payment release requieren controles separados;
- preparer, approver, releaser/poster y reconciler son principals distintos según policy;
- ProjectOps360° conserva visibility/reference; no se convierte en AP o banking system;
- `settled` requiere source confirmation; una scheduled date no demuestra pago;
- payment no crea ni altera el período de Actual Cost.

## 10. Financial Change

**Ruta principal:**

`draft → submitted → impact_assessed → approved → posted → implemented → closed`

**Rutas alternativas:**

- `draft|submitted|impact_assessed → withdrawn`;
- `submitted|impact_assessed → rejected`;
- `impact_assessed → draft` por rework;
- `approved → posting_failed`;
- `posted|implemented → reversed` solo por change compensatorio autorizado.

**Invariantes:**

- pending change permanece fuera de Current Baseline y posición oficial;
- impacto individual y acumulado determina threshold y evita splitting;
- approval no altera la baseline hasta `posted`;
- cada efecto declara qué verdades modifica: baseline, funding, commitment, forecast, reserve o cash;
- requester no aprueba su propia change;
- reason, affected scope, amount/currency, effective period y decision evidence son obligatorios.

## 11. Reserve y movimientos

### 11.1 Reserve account

`draft → authorized → active → exhausted|released|closed`

### 11.2 Reserve movement

`requested → assessed → approved → posted → reconciled`

Rutas alternativas: `requested|assessed → rejected|withdrawn`; `approved → posting_failed`; `posted → returned/reversed` por movimiento compensatorio.

**Invariantes:**

- Contingency y Management Reserve son accounts distintos con authorities distintas;
- categoría legacy `contingency` no prueba reserve authorization;
- draw/transfer/return requiere source reserve, destination/effect, reason y link a risk/change/decision según policy;
- requester/preparer ≠ approver ≠ poster;
- Management Reserve solo la autoriza Sponsor/Steering;
- un movimiento no puede llevar el saldo por debajo de cero ni exceder authority;
- reserve availability no se infiere desde budget variance.

## 12. Lifecycles complementarios

### 12.1 Funding

`draft → submitted → authorized → active → partially_allocated → fully_allocated → closed`

También puede pasar a `conditioned`, `suspended`, `reduced`, `revoked` o `expired` mediante decisión autorizada. Ningún estado se infiere desde budget/cash.

### 12.2 Forecast

`draft → submitted → reviewed → approved → published → superseded → archived`

Forecast publicado es inmutable; un nuevo ciclo/version lo supersede. Faltante permanece `unknown`, no `actual`.

### 12.3 Financial period

`open → soft_close → closed → reopened → closed`

Reopen requiere Controller + autoridad adicional, reason y audit event.

## 13. Invariantes transversales

1. **Expected-state:** cada comando declara la versión/estado esperado; stale writes fallan.
2. **Deny by default:** una transición no listada está prohibida.
3. **Authority:** actor, delegated scope, threshold y policy se evalúan al ejecutar.
4. **SoD:** requester/preparer, approver, poster/publisher y reconciler respetan P0-T3.
5. **Atomicity:** owner mutation + canonical event + idempotency result forman una unidad.
6. **Immutability:** activated/posted/published/reconciled records no se editan silenciosamente.
7. **Compensation:** corrections referencian el objeto/evento original.
8. **Period lock:** closed-period writes se rechazan salvo adjustment/reopen autorizado.
9. **Scope isolation:** transitions no mueven objetos entre organization/project.
10. **Version uniqueness:** una sola active baseline y una publicación oficial por cycle/scope.
11. **No synthetic approval:** imports, defaults, admin role, service role o AI no crean authority.
12. **Trust honesty:** lifecycle no convierte missing/unmapped/unreconciled en approved/healthy.
13. **Projection discipline:** UI labels, Reports, Graph y legacy status se derivan; no escriben truth.
14. **Event chronology:** `occurred_at`, `recorded_at` y business/accounting dates permanecen separados.

## 14. Compatibilidad con status actual

| Campo/capacidad actual | Tratamiento |
|---|---|
| `budget_items.status` | Compatibility projection temporal; no combina lifecycle, approval y health en nuevos consumers |
| `material_requirements.status` | Lifecycle operacional de material; no financial truth state |
| `procurement_items.status` | Lifecycle operacional existente; se mapea a pre-commitment/commitment sin sobreinterpretar |
| Execution Status Engine | Conserva execution/dependency status; consume señales financieras resueltas |
| Health/Command Center | Muestra no-data/unapproved/stale/incomplete; no decide lifecycle financiero |
| Living Graph | Proyecta transiciones/eventos; no valida ni ejecuta states |

## 15. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Editar Original Budget activado | Deny; usar change/baseline version |
| 2 | Activar dos baselines simultáneas | Deny; supersede/activate atómico |
| 3 | Quote se marca commitment | Deny; pre-commitment no contribuye |
| 4 | Reintentar actual import con mismo source identity | Idempotent; un solo record/event |
| 5 | Actual posteado cambia de período | Deny; reversing/adjusting transaction |
| 6 | Accrual matcheado y actual se suman juntos | Deny; resolver reemplazo sin doble conteo |
| 7 | Pending change altera baseline | Deny hasta approved + posted |
| 8 | PM solicita y aprueba reserve draw | Deny por SoD/authority |
| 9 | Payment scheduled se presenta como settled | Deny; requiere source confirmation |
| 10 | Forecast publicado se edita | Deny; nueva versión |
| 11 | Service role cambia status a approved | Deny; technical role no concede authority |
| 12 | Isabella ejecuta transición | Deny; solo recomendación/explicación |

## 16. Decisiones P1-T5

| ID | Decisión | Estado |
|---|---|---|
| P1-T5-D1 | Cada objeto posee lifecycle de negocio independiente del execution status/health. | Aprobada |
| P1-T5-D2 | Solo transiciones enumeradas están permitidas. | Aprobada |
| P1-T5-D3 | Original Budget, active baseline y published forecast son inmutables por versión. | Aprobada |
| P1-T5-D4 | Posted actuals/accruals/payments se corrigen por compensación. | Aprobada |
| P1-T5-D5 | Approval y posting son acciones/actors separados. | Aprobada |
| P1-T5-D6 | Closed periods impiden cross-period rewrites silenciosos. | Aprobada |
| P1-T5-D7 | Owner mutation y event capture deberán ser atómicos/idempotentes. | Aprobada |
| P1-T5-D8 | Legacy/UI/Graph status son proyecciones, no owners. | Aprobada |
| P1-T5-D9 | Funding, forecast y period lifecycles complementan el entregable. | Aprobada |
| P1-T5-D10 | AI, service role y admin técnico nunca crean aprobación. | Aprobada |

## 17. Matriz de aceptación P1-T5

| Criterio | Resultado | Evidencia |
|---|---|---|
| Estimate lifecycle definido | PASS | Sección 3 |
| Budget/baseline lifecycles definidos | PASS | Secciones 4–5 |
| Commitment/actual/accrual/payment definidos | PASS | Secciones 6–9 |
| Change/reserve definidos | PASS | Secciones 10–11 |
| Funding/forecast/period complementarios definidos | PASS | Sección 12 |
| Invalid transitions y silent edits impedidos | PASS | Secciones 13 y 15 |
| No second status engine | PASS | Secciones 1 y 14 |
| Criterio original de aceptación | **PASS** | Transiciones inválidas, edits silenciosos y rewrites cross-period quedan prohibidos |

## Nota de cierre lista para ProjectOps360°

P1-T5 completada y validada. Se definieron state machines para Estimate/BOE, Original Budget, Current Baseline, Commitment, Actual Cost, Accrual, Payment, Financial Change y Reserve, más lifecycles complementarios para Funding, Forecast y Financial Period. Original Budget activado, baseline activa y forecast publicado son inmutables por versión; actuals, accruals y payments posteados se corrigen con movimientos compensatorios. Pending changes no afectan baseline, quotes no son commitments y scheduled payments no son pagos liquidados. Toda transición usa expected state, authority, SoD, evidence, idempotency y event capture; owner mutation y evento deberán ser atómicos. Closed periods impiden rewrites silenciosos y solo admiten adjustment o reopen autorizado. `budget_items.status`, UI, health y Living Graph quedan como proyecciones, sin crear un segundo status engine. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T5_Financial_Lifecycle_State_Machines_Invariants.md`.
