# P1-T1 — Seis verdades financieras canónicas y separación de cash flow

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T1 — Define the six canonical financial truths and cash-flow separation |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P0-T6 / G0-D1 |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin |
| Consultados | Finance / Controller; Product Architecture |
| Entregable | Definiciones canónicas para Funding, Original Budget, Current Baseline, Commitments, Actual Cost, Forecast y Cash Flow |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P1** |
| Efecto | Define semántica y fórmulas; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión canónica

ProjectOps360° reconoce **seis verdades financieras canónicas de control** y una proyección de caja separada:

1. Funding;
2. Original Budget;
3. Current Baseline;
4. Commitments;
5. Actual Cost;
6. Forecast, compuesto por ETC y EAC;
7. Cash Flow, deliberadamente separado de las seis verdades de costo y control.

Estimate / Basis of Estimate, accruals, invoices, payments, changes y reserves son objetos financieros necesarios, pero no sustituyen ni fusionan las seis verdades. Cada importe debe declarar su tipo de hecho; ningún campo genérico `amount`, etiqueta visual o total de reporte puede cambiar esa semántica.

## 2. Contrato común de una verdad financiera

Todo hecho o versión financiera deberá resolver, como mínimo:

| Grupo | Atributos obligatorios |
|---|---|
| Scope | `organization_id`, `project_id`, portfolio/program cuando aplique, CBS y referencias WBS/control account |
| Identidad | Tipo de verdad, canonical object ID, version ID y stable source identity |
| Valor | Importe, moneda de transacción, moneda de proyecto y valor convertido cuando aplique |
| Tiempo | Fecha efectiva, período fiscal/contable o forecast period, `as_of`, `occurred_at` y `recorded_at` según el hecho |
| Estado | Lifecycle state, approval state, reconciliation state y trust state |
| Autoridad | Owner, preparer, approver, poster/publisher y reconciler efectivos |
| Procedencia | Source system, source record/document, método, evidence refs e ingestion/correlation IDs |
| Calidad | Completeness, freshness, confidence y excepciones abiertas |

Los estados `unknown`, `unapproved`, `stale`, `incomplete`, `conflicted` y `not_applicable` son resultados válidos. Nunca se convierten implícitamente en cero.

## 3. Las seis verdades canónicas

### 3.1 Funding

**Definición:** autoridad formal concedida por Sponsor / Steering para comprometer recursos financieros dentro de un alcance, moneda, vigencia y condiciones determinadas.

**Owner de negocio:** Sponsor / Steering. PMO opera y controla el expediente.

**Incluye:** importe autorizado, fuente, condiciones, restricciones, vigencia, asignaciones, suspensiones, reducciones y revocaciones aprobadas.

**No es:** estimate, budget, baseline, cash balance, invoice, payment ni forecast.

**Invariantes:**

- funding solo existe después de autorización válida;
- un importe cargado o una baseline aprobada no crean funding;
- la posición disponible se deriva de autorizaciones y movimientos aprobados, nunca de actuals o payments;
- la autorización original no se sobrescribe; las variaciones son versiones o movimientos trazables.

### 3.2 Original Budget

**Definición:** primera versión presupuestaria formalmente aprobada y activada para el alcance autorizado del proyecto.

**Owner de negocio:** PMO / Project Controls; aprobación conforme a PMO Admin/Sponsor y matriz vigente.

**Incluye:** líneas por CBS/control account, Basis of Estimate, moneda, fecha efectiva, versión, aprobadores y evidencia de cuadratura.

**No es:** estimate en preparación, material takeoff, funding, current baseline mutable ni forecast.

**Invariantes:**

- existe como snapshot inmutable después de activación;
- no se edita para reflejar cambios posteriores;
- su diferencia con la Current Baseline se explica mediante cambios y movimientos aprobados;
- una fila legacy `budget_items` no se promueve a Original Budget sin versión, aprobación y evidencia.

### 3.3 Current Baseline

**Definición:** versión presupuestaria aprobada y vigente contra la cual se controla el desempeño actual.

**Owner de negocio:** PMO / Project Controls; aprobación de PMO Admin o Sponsor según umbral.

**Incluye:** Original Budget más efectos **posteados** de cambios y movimientos de reserva autorizados que la política defina como baseline-affecting.

**No es:** suma de pending changes, latest estimate, forecast, funding o un campo mutable sin historial.

**Identidad de control:**

`Current Baseline(v) = Original Budget + Σ efectos de baseline aprobados y posteados hasta v`

La identidad es un bridge auditable, no una instrucción para sumar filas sin controlar scope, moneda, período, versión o doble conteo.

**Invariantes:**

- solo una versión puede estar activa por proyecto/scope/currency/effective window;
- pending, rejected y withdrawn changes permanecen fuera;
- cada nueva activación conserva y supersede la versión anterior sin alterarla;
- no cambia por el solo hecho de registrar actuals, commitments o forecast.

### 3.4 Commitments

**Definición:** obligación contractual aprobada y posteada proveniente de Procurement / Contract Management, neta de amendments y cancelaciones autorizadas.

**Owner de negocio:** Procurement / Contract Management; PMO reconcilia su efecto de control.

**Incluye:** contrato/PO line, supplier, currency, approved value, amendments, cancelaciones, fechas y referencias de recepción/consumo.

**No es:** requisition, request for quote, quote, estimate, invoice no validada, actual o payment.

**Posiciones derivadas:**

- `Approved Commitment`: valor contractual vigente;
- `Consumed Commitment`: parte vinculada y reconciliada contra actuals/receipts según política;
- `Open Commitment`: valor aprobado vigente menos consumo y cancelaciones reconciliadas.

**Invariantes:**

- cada compromiso conserva contract/source identity;
- actuals vinculados no se suman nuevamente como open commitment;
- cambios contractuales crean una nueva versión/movimiento, no overwrite silencioso;
- `budget_items.committed_cost` será compatibility projection, nunca entrada manual paralela.

### 3.5 Actual Cost

**Definición:** costo incurrido reconocido/posteado por Finance o ERP y normalizado en ProjectOps360° con identidad de transacción, período y procedencia.

**Owner de negocio:** Finance / Controller.

**Incluye:** transacción fuente, importe y moneda originales, accounting date/period, incurred/service date cuando exista, mapping CBS/WBS, posting y reconciliation state.

**No es:** payment, cash disbursement, commitment, estimate, forecast ni accrual pendiente.

**Invariantes:**

- la ausencia de feed o reconciliación no significa actual cero;
- una transacción posteada se corrige por reversa/ajuste compensatorio, no por edición histórica;
- `cost_actuals` es el punto de evolución aditiva del detalle local normalizado;
- `budget_items.actual_cost` será rollup derivado durante el cutover, no segunda verdad editable.

### 3.6 Forecast / ETC / EAC

**Definición:** expectativa versionada, fechada y aprobada del costo al completar, preparada por Project Controls y publicada bajo autoridad PMO.

**Owner de negocio:** PMO / Project Controls. El PM puede aportar o preparar únicamente con delegación explícita.

**Componentes:**

- `ETC`: costo esperado del trabajo restante a partir del `as_of`;
- `EAC`: costo esperado total al completar;
- `Forecast Version`: conjunto coherente de supuestos, método, scope, moneda, período, confidence y aprobaciones.

**Identidad mínima de publicación:**

`EAC = Recognized Cost To Date + ETC`

`Recognized Cost To Date` declara si incorpora accruals aprobados. ETC debe declarar explícitamente qué open commitments, riesgos, changes y escalaciones ya están incluidos. Si esa cobertura no se conoce, EAC queda `incomplete`, no se corrige sumando componentes arbitrariamente.

**No es:** actual acumulado, current baseline, commitment total, funding ni una sustitución automática cuando falta forecast.

**Invariantes:**

- forecast faltante permanece `unknown`;
- cada publicación conserva versión anterior y variance bridge;
- `as_of`, método, owner, coverage y confidence son obligatorios;
- una recomendación de Isabella no se convierte en forecast oficial sin aprobación humana.

## 4. Objetos complementarios sin conflación

| Objeto | Semántica | Relación con las verdades |
|---|---|---|
| Estimate / BOE | Evaluación del costo probable basada en alcance y evidencia | Puede originar propuesta de Original Budget; nunca la activa por sí solo |
| Accrual | Costo incurrido estimado/reconocido pendiente de transacción final | Complementa cost-to-date bajo policy; debe revertirse o matchearse sin duplicar actual |
| Invoice | Documento de cobro | Puede soportar actual/payment workflow; no demuestra por sí solo costo posteado ni pago |
| Change | Solicitud/decisión de variación | Solo `approved + posted` afecta Current Baseline; pending queda separado |
| Contingency Reserve | Reserva para riesgos identificados conforme a autoridad | Sus movimientos pueden afectar baseline/forecast según policy; no es categoría genérica |
| Management Reserve | Reserva ejecutiva para unknown-unknowns | Solo Sponsor/Steering autoriza; permanece separada de contingency |
| Payment | Salida de caja autorizada/realizada | Puede liquidar invoice, pero no define incurred cost |

## 5. Separación obligatoria de Cash Flow

### 5.1 Definición

Cash Flow representa **cuándo** se espera o se realiza un movimiento de caja. Se organiza por cash date/period y moneda. Finance / Treasury valida y publica la posición oficial; PMO aporta el calendario del proyecto.

### 5.2 Cuatro ejes que nunca se fusionan

| Eje | Pregunta | Fecha principal |
|---|---|---|
| Cost incurred | ¿Cuándo se recibió/consumió el bien o servicio? | incurred/service date |
| Accounting | ¿En qué período fue reconocido/posteado? | accounting/posting date |
| Invoice | ¿Cuándo fue facturado y cuándo vence? | invoice/due date |
| Cash | ¿Cuándo se pagará o se pagó? | forecast/actual payment date |

Una transacción puede tener las cuatro fechas y pertenecer a períodos distintos. `actual_cost` no prueba payment; `payment` no cambia el período de costo; cash-flow forecast no sustituye EAC.

### 5.3 Posiciones separadas

- `Cash-flow forecast`: proyección time-phased, versionada y publicada;
- `Scheduled payment`: pago previsto/autorizado aún no liquidado;
- `Actual payment`: movimiento liquidado confirmado por Finance/Treasury;
- `Funding schedule`: disponibilidad temporal de una autorización; no es cash balance;
- `Cash gap`: comparación derivada entre demanda de caja y funding/liquidity schedule bajo la misma moneda y período.

## 6. Métricas derivadas permitidas

Las siguientes métricas son resoluciones, no nuevas verdades:

| Métrica | Contrato |
|---|---|
| Baseline variance | `EAC - Current Baseline`, solo con versiones, scope y moneda comparables |
| Funding headroom | Funding autorizado vigente menos asignaciones/consumos definidos por policy; nunca inferido desde payments |
| Open commitment | Commitment vigente menos consumo/cancelaciones reconciliados |
| Recognized cost to date | Actuals reconciliados más accruals aprobados no reemplazados, según policy versionada |
| Forecast EAC | Recognized cost to date + ETC publicado |
| Cost exposure | Breakdown reproducible de actual, accrual, open commitment, ETC y changes, con inclusiones/solapamientos declarados; no una suma ciega |
| Cash gap | Cash demand publicada menos funding/liquidity schedule comparable |

Todo resolver debe devolver componentes, fórmula/policy version, cobertura, `as_of`, excepciones y provenance. Si no puede demostrar anti-double-count, devuelve `incomplete/conflicted` y no un total definitivo.

## 7. Mapeo current→target

| Elemento actual | Semántica target |
|---|---|
| `material_requirements.estimated_total_cost` | Estimate input; no Funding, Original Budget ni Baseline |
| `budget_items.estimated_cost` | Legacy estimate/compatibility value hasta clasificación y versionado |
| `budget_items.committed_cost` | Compatibility rollup derivado desde commitments reconciliados |
| `budget_items.actual_cost` | Compatibility rollup derivado desde `cost_actuals` reconciliados |
| `budget_items.forecast_cost` | Compatibility rollup desde forecast publicado; `null` sigue `unknown` |
| `budget_items.currency` | Display/legacy currency; insuficiente para política multi-currency |
| `budget_items.status` | Compatibility projection; no lifecycle/approval/health owner universal |
| `procurement_items` | Identidad Procurement evolucionada aditivamente hacia commitment semantics |
| `cost_actuals` | Detalle local normalizado de Actual Cost con source identity y reconciliación |

## 8. Reglas negativas de aceptación

Se rechaza cualquier diseño o cálculo que:

1. infiera funding desde budget, actual, payment o forecast;
2. trate estimate/material takeoff como Original Budget aprobado;
3. edite Original Budget o Current Baseline activa sin versión y change aprobado;
4. cuente una requisition o quote como commitment;
5. permita dos actuals editables (`cost_actuals` y total manual);
6. use `actual = forecast` como fallback;
7. sume actual + commitment completo + ETC sin resolver solapamientos;
8. use payment date como incurred/accounting date;
9. agregue monedas o períodos incompatibles sin policy trazable;
10. convierta `unknown`, `unapproved` o `incomplete` en cero;
11. permita que PM, service account o Isabella adquieran autoridad por conveniencia técnica;
12. cree un segundo ledger, status engine, graph, approval system o truth store.

## 9. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Existe estimate de materiales pero no aprobación | Estimate visible; Original Budget y Funding `unknown/unapproved` |
| 2 | Baseline cambia por pending change | Deny; mostrar impacto potencial separado |
| 3 | PO aprobada y actual parcial están vinculados | Conservar commitment original, calcular consumo/open balance sin duplicar actual |
| 4 | Feed de actuals no llegó | Actual `incomplete/unknown`; no cero |
| 5 | Forecast no existe | EAC `unknown`; no fallback a actual o baseline |
| 6 | ETC no declara si incluye open commitments | EAC `incomplete`; bloquear exposure definitivo |
| 7 | Factura fue recibida pero no pagada | Puede soportar actual/accrual; payment permanece pendiente/unknown |
| 8 | Pago ocurre en período posterior al costo | Cost y cash se reportan en sus períodos respectivos |
| 9 | Portfolio mezcla monedas sin FX policy | Deny total comparable; mostrar breakdown por moneda |
| 10 | Isabella propone escenario | Mostrar recomendación separada; no publicar verdad ni ejecutar transacción |

## 10. Decisiones P1-T1

| ID | Decisión | Estado |
|---|---|---|
| P1-T1-D1 | Se aprueban seis verdades canónicas: Funding, Original Budget, Current Baseline, Commitments, Actual Cost y Forecast. | Aprobada |
| P1-T1-D2 | Cash Flow y Payments permanecen separados de las verdades de costo/control. | Aprobada |
| P1-T1-D3 | Estimate/BOE es input; no constituye autorización, baseline ni forecast. | Aprobada |
| P1-T1-D4 | Original Budget es inmutable y Current Baseline es versionada. | Aprobada |
| P1-T1-D5 | `cost_actuals` evoluciona como actual-detail y los totals legacy son proyecciones. | Aprobada |
| P1-T1-D6 | Commitments provienen de Procurement/Contract authority y conservan source identity. | Aprobada |
| P1-T1-D7 | Forecast faltante permanece `unknown`; EAC publicado exige ETC y coverage explícitos. | Aprobada |
| P1-T1-D8 | Exposure es derivado, policy-versioned y anti-double-count. | Aprobada |
| P1-T1-D9 | Estados de confianza no se convierten en cero. | Aprobada |
| P1-T1-D10 | Ningún consumer o AI puede redefinir una verdad canónica. | Aprobada |

## 11. Evidencia de alineación

- Charter y carry-forward: `Project360/Budget_Cost_Management/P0-T6_G0_Discovery_Baseline_Charter_Approval.md`.
- RACI y SoD: `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md`.
- Source-of-truth boundaries: `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md`.
- Casos PMO y anti-double-count: `Project360/Budget_Cost_Management/P0-T5_Representative_PMO_Use_Cases_Control_Questions.md`.
- Esquema actual: `supabase/migrations/20260708000000_universal_execution_model.sql:179` y `supabase/migrations/20260708000000_universal_execution_model.sql:212`.
- AACE 18R-97 se usa solo como guía del adaptador de Process Industries: estimate class depende principalmente de madurez de definición; no es sinónimo de budget, funding o precisión garantizada.

## 12. Matriz de aceptación P1-T1

| Criterio | Resultado | Evidencia |
|---|---|---|
| Las seis verdades tienen definición y owner separados | PASS | Sección 3 |
| Cash Flow está separado de costo y payment semantics | PASS | Sección 5 |
| Authorization, obligation, incurred cost, payment y forecast no se conflan | PASS | Secciones 3–6 |
| Existe contrato anti-double-count para exposure/EAC | PASS | Secciones 3.6 y 6 |
| Current objects tienen mapeo aditivo | PASS | Sección 7 |
| Estados honestos preservan unknown/unapproved/incomplete | PASS | Secciones 2 y 8 |
| Criterio original de aceptación | **PASS** | Ningún campo o métrica fusiona autorización, obligación, costo incurrido, pago o forecast |

## Nota de cierre lista para ProjectOps360°

P1-T1 completada y validada. Se definieron seis verdades financieras canónicas: Funding, Original Budget, Current Baseline, Commitments, Actual Cost y Forecast/ETC/EAC. Cash Flow y Payments quedaron expresamente separados del costo incurrido, accounting date e invoice lifecycle. Estimate/BOE continúa como input y nunca se promueve automáticamente a funding o baseline. Original Budget es inmutable; Current Baseline es versionada y solo incorpora cambios aprobados y posteados; commitments conservan fuente contractual; `cost_actuals` evoluciona como detalle normalizado; forecast faltante permanece `unknown`. EAC exige ETC, `as_of`, método, coverage y aprobación; exposure se resuelve por componentes con policy versionada y control anti-double-count, no mediante suma ciega. Se mapearon los campos legacy a proyecciones compatibles y se aprobaron 10 decisiones y 10 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T1_Six_Canonical_Financial_Truths_Cash_Flow_Separation.md`.
