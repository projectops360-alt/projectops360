# P1-T4 — Semántica de moneda, FX, período fiscal y fechas contables

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T4 — Define currency, FX, fiscal period and accounting-date semantics |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P1-T1 |
| Owner | Finance / Controller |
| Accountable | PMO / Project Controls Lead |
| Consultados | Data Architecture; Product Architecture |
| Entregable | Política canónica de moneda, conversión, períodos y fechas |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P1** |
| Efecto | Define semántica financiera; no configura calendarios ni rates productivos |

## 1. Decisión de política

ProjectOps360° conservará simultáneamente el valor original y cada valor convertido. Ninguna conversión sobrescribe el importe de transacción. Una posición agregada solo es válida cuando todas sus líneas comparten moneda o fueron convertidas mediante una política, fuente, fecha y versión trazables.

Las fechas de incurrencia, documento, posting, accounting period, invoice, vencimiento y payment son distintas. `cost_date` o `created_at` no pueden representar todas ellas.

## 2. Tipos de moneda

| Tipo | Definición | Owner/policy |
|---|---|---|
| Transaction Currency | Moneda original del documento, contrato o transacción | Source system/document |
| Project Currency | Moneda base para control del proyecto | PMO + Finance policy |
| Functional Currency | Moneda funcional de la entidad contable | Finance/ERP |
| Reporting Currency | Moneda solicitada por portfolio/report consumer | Organization/portfolio policy |
| Funding Currency | Moneda de la autorización de funding | Sponsor authorization |
| Cash Currency | Moneda del movimiento/proyección de caja | Treasury/source |

Se utilizan códigos ISO 4217 activos o códigos explícitos de unidades no monetarias aprobadas. Símbolos (`$`) y nombres libres no identifican una moneda.

## 3. Contrato de importe monetario

Todo importe debe poder resolver:

- `amount_original` y `currency_original`;
- precision/scale de origen;
- `amount_project_currency` y project currency cuando fue convertido;
- reporting/functional values solo si la policy lo requiere;
- FX rate ID, source, type, quote convention, rate date y version;
- rounding policy y residual;
- sign semantics, debit/credit o movement direction según el objeto;
- source object/version y evidence.

Un valor convertido es una **representación derivada**. El original permanece inmutable.

## 4. Política FX

### 4.1 Identidad de rate

| Campo | Regla |
|---|---|
| Base/quote | Convención explícita, por ejemplo `1 EUR = x USD` |
| Rate source | Proveedor o tabla oficial aprobada; no UI/AI improvisada |
| Rate type | Spot, daily close, monthly average, budget, forecast, contractual u otro tipo gobernado |
| Rate date | Fecha seleccionada por la semántica del hecho |
| Version | Identifica correcciones/publicaciones del mismo source/date/type |
| Precision | Suficiente para reproducir el cálculo; display rounding ocurre después |
| Approval | Requerida para overrides/manual rates |

### 4.2 Selección de rate por objeto

| Objeto | Fecha/tipo por defecto | Excepciones |
|---|---|---|
| Funding authorization | Effective/authorization date o rate contractual | Policy de Sponsor/Finance documentada |
| Original Budget | Budget FX set congelado con la versión aprobada | Nunca reexpresar la versión original sin vista separada |
| Current Baseline | FX policy de la baseline version | Bridge separa cambio real de currency variance |
| Commitment | Contract/PO posting o contractual rate | Amendments conservan su rate policy |
| Actual Cost | Rate oficial del ERP para accounting/posting period | Se preserva valor funcional reportado por Finance |
| Accrual | Period-end/accounting policy | Reversal/match conserva linkage |
| Forecast | Forecast FX set vigente al `as_of` | Escenarios usan sets separados, no alteran forecast publicado |
| Cash-flow forecast | Cash forecast rate set por payment period | Actual payment usa rate confirmado por Treasury/Finance |
| Portfolio reporting | Reporting rate set aprobado para el corte | No reescribe los owners de proyecto |

### 4.3 Reglas de conversión

1. Nunca convertir dos veces un valor ya convertido sin volver al original.
2. No derivar inverse/cross rates si la policy lo prohíbe; si se deriva, conservar la cadena.
3. Un manual override requiere reason, approver, effective scope y event.
4. Rates faltantes producen `fx_missing/incomplete`, no rate 1.0.
5. Cambios de rate después del cierre generan revaluation/variance o una corrección autorizada; no reescriben el período.
6. Reports separan cost variance, scope variance y currency variance cuando sea material.

## 5. Calendarios y períodos

### 5.1 Entidades

| Entidad | Definición |
|---|---|
| Fiscal Calendar | Secuencia versionada de fiscal years/periods para una entidad/policy |
| Accounting Period | Período donde Finance reconoce/postea la transacción |
| Control Period | Ventana de Project Controls para baseline/forecast/reporting |
| Forecast Period | Bucket futuro del ETC/EAC o cash flow |
| Reporting Period | Período solicitado por consumer, con mapping explícito |

Una organización puede usar calendario mensual, 4-4-5 u otro esquema. El sistema no asume que mes calendario = período fiscal.

### 5.2 Estados de período

`open → soft_close → closed → reopened → closed`

- `soft_close` permite operaciones definidas por policy y marca la posición provisional;
- `closed` rechaza posting ordinario;
- `reopened` exige Controller + autoridad adicional, reason y audit event;
- cerrar o reabrir no borra ni modifica history.

### 5.3 Cross-period corrections

Una corrección de un período cerrado se registra como:

- reversing/adjusting transaction en un período abierto, referenciando el original; o
- posting en período reabierto bajo autorización explícita.

Nunca se cambia silenciosamente `accounting_period` de una transacción posteada.

## 6. Semántica de fechas

| Fecha | Pregunta que responde | Owner/source |
|---|---|---|
| `service_or_incurred_date` | ¿Cuándo se recibió/consumió el bien o servicio? | Operational evidence / Finance policy |
| `transaction_date` | ¿Cuándo ocurrió el documento/transacción fuente? | Source system |
| `document_date` | ¿Qué fecha declara el documento? | Invoice/contract/document |
| `invoice_date` | ¿Cuándo fue emitida la factura? | Supplier/AP source |
| `posting_date` | ¿Cuándo fue posteada en el sistema contable? | ERP/Finance |
| `accounting_period_id` | ¿En qué período fue reconocida? | Finance/Controller |
| `due_date` | ¿Cuándo vence la obligación de pago? | Contract/invoice |
| `scheduled_payment_date` | ¿Cuándo se prevé pagar? | AP/Treasury plan |
| `payment_date` | ¿Cuándo se liquidó el pago? | Treasury/ERP/bank source |
| `effective_from/to` | ¿Cuándo aplica una autorización/versión? | Business approval |
| `forecast_as_of` | ¿Qué información conocía el forecast? | PMO publication |
| `occurred_at` | ¿Cuándo ocurrió el evento de negocio? | Event source |
| `recorded_at` | ¿Cuándo ingresó al ledger? | Event ingestion service |
| `ingested_at` | ¿Cuándo llegó el dato externo? | Integration pipeline |

No se completan fechas faltantes usando `created_at`, fecha actual o otra fecha cercana. La ausencia se declara.

## 7. Aplicación por verdad financiera

### Funding

Conserva authorization/effective dates, vigencia, funding currency y schedule opcional. La fecha de pago no demuestra disponibilidad de funding.

### Original Budget y Current Baseline

Cada versión congela moneda base, FX set, effective date y control period. Una vista a rates actuales es una reexpresión, no la versión original.

### Commitment

Conserva document/approval/posting dates, expected fulfillment y currency contractual. Invoice, receipt y payment dates son relaciones distintas.

### Actual / Accrual

Conserva incurred/service, transaction, posting y accounting period. Accrual tiene reversal/match period. Actual payment permanece fuera.

### Forecast

Conserva `as_of`, cycle, publication date, forecast periods y FX set. Cambiar rates crea una versión/escenario, no edita la publicación previa.

### Cash Flow / Payment

Usa scheduled/actual payment dates y cash periods. Una curva forecast es versionada; un pago liquidado proviene de fuente oficial.

## 8. Rounding y reconciliación

- Cálculos internos usan precision definida por currency/rate policy.
- Rounding de línea y total deben declarar orden/método.
- Residuales se conservan en una línea/account control designado, no se pierden.
- Reconciliación compara original, converted y source totals dentro de tolerancias aprobadas.
- Un reporte no fuerza cuadratura cambiando importes; muestra `rounding_difference` o exception.

## 9. Compatibilidad current→target

| Elemento actual | Gap | Decisión |
|---|---|---|
| `budget_items.currency` | Una moneda display por fila | Preservar; añadir contrato multi-currency de forma aditiva después de G6 |
| `cost_actuals.currency` | Moneda original sin converted values/rate | Preservar; extender source/rate/date/period provenance |
| `cost_actuals.cost_date` | Fecha única ambigua | Tratar como legacy source date hasta clasificar; no asumir accounting/payment |
| `procurement_items.currency` | Moneda de línea sin contract FX policy | Preservar y enlazar source/contract policy |
| `material_requirements` | Estimate UI presenta USD fijo | Mantener estimate semantics; moneda debe volverse explícita en arquitectura posterior |
| `created_at/updated_at` | System timestamps | Nunca reemplazan business/accounting dates |

## 10. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | EUR actual se reporta en USD sin rate source/date | Deny total convertido; `fx_missing` |
| 2 | Budget usa rate congelado y actual usa ERP rate | Allow; separar currency variance |
| 3 | Forecast cambia de FX set | Crear nueva versión/escenario; preservar anterior |
| 4 | Cost incurred en enero, posteado en febrero y pagado en marzo | Reportar cada eje en su período correcto |
| 5 | Se intenta editar accounting date de período cerrado | Deny; ajustar/revertir o reabrir con autoridad |
| 6 | Portfolio agrega USD y CAD como si fueran iguales | Deny; breakdown o conversión aprobada |
| 7 | Rate faltante se reemplaza por 1 | Deny; estado incomplete |
| 8 | Payment date se usa como actual cost date | Deny; mantener objetos/fechas separados |
| 9 | 4-4-5 period se agrupa por mes calendario | Solo con mapping/report policy explícita |
| 10 | Redondeo deja residual material | Mostrar/reconciliar residual; no ocultarlo |

## 11. Decisiones P1-T4

| ID | Decisión | Estado |
|---|---|---|
| P1-T4-D1 | Transaction, project, functional, reporting, funding y cash currencies son roles separados. | Aprobada |
| P1-T4-D2 | El importe original nunca se sobrescribe por conversión. | Aprobada |
| P1-T4-D3 | Toda conversión conserva source/type/date/version/quote/precision. | Aprobada |
| P1-T4-D4 | Rate faltante produce estado incomplete, no 1.0. | Aprobada |
| P1-T4-D5 | Fiscal, accounting, control, forecast y reporting periods se distinguen. | Aprobada |
| P1-T4-D6 | Incurred, posting, invoice, due y payment dates son distintas. | Aprobada |
| P1-T4-D7 | Closed-period corrections usan adjustment/reversal o reopen autorizado. | Aprobada |
| P1-T4-D8 | Legacy `currency/cost_date` se preservan pero no se sobreinterpretan. | Aprobada |

## 12. Matriz de aceptación P1-T4

| Criterio | Resultado | Evidencia |
|---|---|---|
| Transaction/project/reporting currencies están separadas | PASS | Sección 2 |
| FX source/date/type/version son obligatorios | PASS | Sección 4 |
| Fiscal/accounting/forecast periods están definidos | PASS | Sección 5 |
| Incurred/posting/invoice/payment dates son distintas | PASS | Sección 6 |
| Cross-period rewrite está impedido | PASS | Sección 5.3 |
| Current schema tiene estrategia aditiva | PASS | Sección 9 |
| Criterio original de aceptación | **PASS** | Monedas, FX y fechas/períodos conservan semánticas distintas |

## Nota de cierre lista para ProjectOps360°

P1-T4 completada y validada. Se definieron transaction, project, functional, reporting, funding y cash currencies como roles distintos. Todo importe conserva valor y moneda originales; cada conversión registra rate source, type, quote, date, version, precision y rounding, y un rate faltante produce `fx_missing/incomplete`, nunca 1.0. Se separaron fiscal, accounting, control, forecast y reporting periods, incluyendo estados open/soft-close/closed/reopened. También se distinguieron incurred/service, transaction, document, invoice, posting, due, scheduled payment, payment, effective, as-of, occurred, recorded e ingestion dates. Una corrección cross-period usa reversa/ajuste o reapertura autorizada, sin reescritura silenciosa. Los campos legacy `currency`, `cost_date` y timestamps se preservan, pero no se sobreinterpretan. Se aprobaron 8 decisiones y 10 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T4_Currency_FX_Fiscal_Accounting_Date_Semantics.md`.
