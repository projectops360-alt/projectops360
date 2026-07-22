# P4 — Performance measurement and forecast engine / G4

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P4 — Performance measurement and forecast engine |
| Tareas | P4-T1 a P4-T7 |
| Gate | G4 — Measurement and forecast formulas approved |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-22 |
| Predecesor | P3-T7 / G3 PASS |
| Owners | Project Controls Analytics; Risk and Cost Analytics; Controls Assurance / QA |
| Accountable | PMO / Project Controls Lead; PMO Admin para G4 |
| Estado | **APROBADO — G4 PASS** |
| Efecto | Autoriza contratos y golden results; no autoriza persistencia, UI ni producción |

## P4-T1 — Canonical formula contract

### Snapshot de medición

Toda métrica se evalúa sobre un snapshot versionado con `organization_id`, `project_id`, scope/control accounts, baseline version, data date/cut-off, calendar/period, reporting currency, FX policy, actual/accrual policy, progress evidence version, formula version y completeness.

| Métrica | Contrato |
|---|---|
| BAC | Current Baseline aprobada para el scope completo del snapshot |
| PV | Budget time-phased programado hasta el cut-off |
| EV | Budget value ganado por evidencia/método elegible hasta el cut-off |
| AC | Actual Cost reconciliado más accrual elegible conforme a policy |
| CV | `EV - AC` |
| SV | `EV - PV` |
| CPI | `EV / AC`, solo si AC > 0 |
| SPI | `EV / PV`, solo si PV > 0 |

BAC, PV, EV, AC, CV y SV usan una moneda homogénea; CPI/SPI son ratios sin unidad. Missing no se convierte en cero. División por cero produce `unavailable` con reason code, nunca infinito. PV/EV fuera de scope, period o baseline version se rechazan. SPI **no representa días de atraso** y no se transforma en calendar delay sin schedule analysis.

### Limitaciones

- EVM mide performance contra baseline; no demuestra causalidad.
- CPI/SPI agregados pueden ocultar variaciones por control account.
- LOE puede mantener SPI cercano a 1 sin demostrar entrega discreta.
- Cambios pending/rejected no alteran BAC/PV/EV.
- Multi-currency exige FX source/date/rate y una reporting currency.
- Snapshot incomplete conserva métricas parciales con quality state; no fabrica totals.

### Nota de cierre P4-T1

P4-T1 completada. Se aprobaron BAC, PV, EV, AC, CV, SV, CPI y SPI con cut-off, scope, units, currency, null/zero handling, provenance y limitaciones explícitas. SPI queda como índice adimensional, nunca calendar delay.

## P4-T2 — Earned-value methods and evidence

| Método | Cálculo | Elegibilidad/evidencia |
|---|---|---|
| 0/100 | EV 0 hasta completion aceptada; luego budget value completo | Definition of done + acceptance evidence |
| Weighted milestone | Suma de weights completados × budget value | Milestones versionados; weights = 1; acceptance por milestone |
| Units complete | Actual accepted units / total valid units × budget value | UOM homogénea, denominator > 0, quantity evidence |
| Apportioned effort | EV derivado de una actividad discreta relacionada | Link/ratio aprobados; no relación circular |
| Level of effort | EV proporcional al tiempo presupuestado transcurrido | Period/calendar; solo support work elegible |

Reglas:

1. Método se configura por work package/control account antes del periodo medido.
2. Cambio de método exige nueva versión, reason, approval y no reescribe snapshots.
3. Evidence identifica source, reviewer, acceptance date y confidence.
4. Manual percent complete requiere policy y supporting evidence; no es método implícito.
5. Milestone weight negativo, suma distinta de 1 o units denominator cero son invalid.
6. Apportioned effort no puede referenciarse a sí mismo.
7. LOE se reporta separado para evitar falsa señal de performance.
8. Process Mining aporta temporal evidence; no aprueba progress ni inventa completion.

### Nota de cierre P4-T2

P4-T2 completada. Se aprobaron 0/100, weighted milestone, units complete, apportioned effort y level-of-effort con configuración previa, evidence, eligibility, versioning y rejection rules.

## P4-T3 — Deterministic EAC and ETC scenarios

Cada escenario produce `scenario_id`, formula/version, BAC/EV/AC, remaining work basis, assumptions, applicability, confidence, source data, quality state, preparer/reviewer y override rationale.

| Escenario | ETC | EAC | Aplicabilidad |
|---|---|---|---|
| Bottom-up | Remaining estimate aprobado | `AC + ETC_bottom_up` | Work remaining re-estimado con evidencia |
| CPI-based | `(BAC - EV) / CPI` | `AC + ETC` | CPI > 0 y cost efficiency representativa |
| CPI/SPI | `(BAC - EV) / (CPI × SPI)` | `AC + ETC` | CPI/SPI > 0 y schedule pressure afecta costo restante |
| PM forecast | Forecast remaining aprobado | `AC + ETC_PM` | Human forecast versionado con assumptions |

También se calcula `VAC = BAC - EAC`. Si denominador ≤ 0, datos faltan o scenario assumptions no aplican, el resultado es unavailable. El scenario recomendado no reemplaza los demás. Human override conserva valor calculado, valor seleccionado, actor, reason, evidence y approval.

### Nota de cierre P4-T3

P4-T3 completada. Bottom-up, CPI-based, CPI/SPI y PM forecast quedan como escenarios comparables, no una predicción única. Cada uno declara fórmula, assumptions, applicability, confidence, source data y override rationale.

## P4-T4 — Probabilistic P50/P80 and sensitivity

El probabilistic EAC modela **remaining cost**, luego suma AC ya incurrido. Un run exige:

- scope, cut-off y baseline/forecast versions;
- distributions documentadas por cost driver/risk;
- units, bounds, central tendency y source evidence;
- correlations/dependencies y rationale;
- risk occurrence/severity treatment;
- escalation/FX policy;
- sample/seed/algorithm version;
- convergence/quality diagnostics;
- exclusions y model limitations.

`P50` y `P80` son cuantiles de la distribución aprobada de EAC; no “probabilidad de éxito” universal ni commitment. Sensitivity identifica drivers mediante método versionado y no se interpreta como causalidad.

Estados de calidad: `available`, `provisional`, `insufficient_inputs`, `invalid_model`, `stale`. Sin distributions, correlations o evidence suficiente, P50/P80 quedan `unavailable`; no se sustituyen por porcentajes fijos ni AI guesses.

### Nota de cierre P4-T4

P4-T4 completada. P50/P80 solo se producen con distributions, correlations, risk/uncertainty evidence, reproducible seed y diagnostics documentados. Datos insuficientes devuelven unavailable honesto.

## P4-T5 — Decision metric catalog

| Métrica | Fórmula/estructura | Guardrails |
|---|---|---|
| TCPI to BAC | `(BAC - EV) / (BAC - AC)` | Denominator > 0 |
| TCPI to EAC | `(BAC - EV) / (EAC - AC)` | Denominator > 0 |
| Period burn rate | `ΔAC / elapsed period units` | Period/calendar y currency explícitos |
| Remaining authorization | Funding authorized - net released | Funding owner, no budget variance |
| Available released funds | Net released - restrictions - governed uses | Policy/version explícita |
| Cost exposure | Actual + eligible accrual + open commitment + uncommitted forecast | Anti-double-count coverage |
| Uncommitted exposure | Forecast remaining no cubierto por open commitments | Coverage map obligatorio |
| VAC | `BAC - EAC` | Scenario/version explícitos |

Cost exposure se presenta siempre por componentes; no es una suma ciega. TCPI > 1 indica eficiencia requerida superior a 1, pero “unrealistic” depende de thresholds históricos/policy versionados. Denominator ≤ 0 genera `unavailable/unattainable`, no ratio engañoso.

### Nota de cierre P4-T5

P4-T5 completada. Se definieron TCPI, burn rate, remaining funds, VAC y exposure decomposition distinguiendo actual, accrual, commitment y uncommitted forecast, con flags explícitos para recovery matemáticamente inválida o improbable.

## P4-T6 — Golden datasets

El dataset aprobado está en `Project360/Budget_Cost_Management/reference/P4_Golden_Financial_Calculations_v1.json`. Incluye:

1. normal performance;
2. incomplete evidence;
3. zero denominators/pre-start;
4. overrun/unattainable TCPI;
5. multi-currency normalized snapshot;
6. deterministic probabilistic distribution.

Expected results se calcularon independientemente con precisión decimal y tolerance `0.000001`. Los casos contienen inputs, expected values/reason codes y formula version. La implementación P7 deberá consumirlos sin modificar expected outputs.

### Nota de cierre P4-T6

P4-T6 completada. Se creó golden data para casos normal, incomplete, zero-value, overrun, multi-currency y probabilistic con expected outputs independientes y tolerance aprobada.

## P4-T7 — G4 validation and approval

### Resultados de validación

| Control | Resultado |
|---|---|
| Formula contract completo | PASS |
| EV methods/evidence elegibles | PASS |
| EAC/ETC scenarios reproducibles | PASS |
| P50/P80 unavailable cuando faltan inputs | PASS |
| Decision metrics y unrealistic recovery flags | PASS |
| Golden JSON parseable | PASS |
| Normal expected results | PASS |
| Zero/incomplete reason codes | PASS |
| Overrun/TCPI behavior | PASS |
| Multi-currency normalized outputs | PASS |
| Weighted quantiles P50/P80 | PASS |

### Escenarios aprobados

| # | Escenario | Resultado |
|---:|---|---|
| 1 | BAC 1000, PV 400, EV 350, AC 375 | CPI 0.933333; SPI 0.875; CV -25; SV -50 |
| 2 | AC = 0 | CPI unavailable, no infinity |
| 3 | PV = 0 | SPI unavailable, no calendar-delay claim |
| 4 | Missing EV evidence | EV y dependent metrics unavailable |
| 5 | Pending change | BAC unchanged |
| 6 | LOE package | Time-phased EV, quality warning |
| 7 | Overrun AC > BAC | TCPI-to-BAC unattainable |
| 8 | Multi-currency without FX | Snapshot invalid/incomplete |
| 9 | Same currencies normalized | Metrics reproducible |
| 10 | CPI scenario with CPI ≤ 0 | Unavailable |
| 11 | P50/P80 without distributions | Unavailable |
| 12 | Weighted outcomes with cumulative 0.5/0.8 | P50/P80 exact |

### Decisión G4

| Campo | Decisión |
|---|---|
| Gate | G4 |
| Decisión | **APPROVE** |
| Approvers | Project Controls + Finance + Cost Engineering + Product Architecture |
| Resultado | **G4 PASS** |
| Restricción | No autoriza persistencia/UI/production; habilita P5 |

### Nota de cierre P4-T7

P4-T7 completada y G4 aprobado. Todas las fórmulas reproducen golden results con tolerance definida y documentan limits, null/zero states, currency y cut-off. G4 habilita P5, pero no autoriza implementación ni producción.

## Matriz de aceptación P4

| Tarea | Criterio original | Resultado |
|---|---|---|
| P4-T1 | Inputs, cut-off, null/zero, units y limitations explícitos; SPI no es calendar delay | PASS |
| P4-T2 | Cinco EV methods requieren configuration/evidence | PASS |
| P4-T3 | Cada scenario declara formula, assumptions, applicability, confidence, sources y override | PASS |
| P4-T4 | P50/P80 requieren distributions/correlations/uncertainty/risk; insufficient = unavailable | PASS |
| P4-T5 | Metrics separan actual, commitment y uncommitted exposure; unrealistic recovery visible | PASS |
| P4-T6 | Expected outputs independently calculated/approved | PASS |
| P4-T7 | All formulas reproduce approved golden results and limitations | PASS |

No se modificó schema, base de datos ni producción y no se realizó deploy. P4 se limita a contratos, golden data y aprobación G4.
