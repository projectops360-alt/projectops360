# P0-T6 — Aprobación G0 de discovery baseline y charter

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P0 — Discovery, charter and governance baseline |
| Tarea | P0-T6 — Approve discovery baseline and charter |
| Gate | G0 — Discovery baseline approved |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Owner | PMO Admin / Product Owner |
| Accountable / Approver | Product Owner |
| Consultados | PMO / Project Controls; Finance; Engineering |
| Predecesores formales | P0-T2; P0-T3; P0-T4; P0-T5 |
| Charter base | P0-T1 |
| Entregable | G0 approval record |
| Estado | **APROBADO — G0 PASS** |
| Alcance de la aprobación | Discovery baseline y charter; **no autoriza implementación ni despliegue** |

## 1. Registro formal de decisión G0

| Campo | Decisión |
|---|---|
| Decision ID | G0-D1 |
| Decisión | **APPROVE** |
| Baseline aprobada | P0-T1 a P0-T5, consolidadas por este registro P0-T6 |
| Autoridad | Product Owner, conforme al workplan |
| Evidencia de autorización | Instrucción explícita del Product Owner en la tarea: “Approve discovery baseline and charter” |
| Fecha efectiva | 2026-07-21 |
| Consecuencia | Cierra P0 y habilita el trabajo de definición P1 sujeto a sus dependencias y gates |
| Restricción | No habilita schema, migrations, APIs, UI, integraciones runtime, materialización, staging, producción ni deploy |

**Dictamen:** se aprueba el discovery baseline y charter porque objetivo, alcance, ownership, estado actual, non-goals, success measures, boundaries y casos de uso están definidos, consistentes y trazables. La aprobación reconoce explícitamente los gaps actuales; no declara que las capacidades financieras ya existen ni que los controles de producción sean suficientes.

## 2. Paquete de evidencia aprobado

| Baseline | Resultado aceptado | Estado de aceptación |
|---|---|---|
| P0-T1 — Objective, scope and non-goals | Financial Control Engine integrado al Core; scope, authority, exclusiones y success measures | **APPROVED** |
| P0-T2 — Current capability and production data paths | Inventario verificable de rutas existentes, snapshot productivo, 15 hallazgos y restricciones | **ACCEPTED AS CURRENT-STATE EVIDENCE** |
| P0-T3 — Financial RACI and SoD | Ownership financiero, authority matrix, delegación del PM y maker–checker–poster–reconciler | **APPROVED** |
| P0-T4 — Source-of-truth and compatibility boundaries | Current-to-target ownership map, evolución aditiva y prohibición de ledger/status/graph/truth paralelos | **APPROVED** |
| P0-T5 — PMO use cases and control questions | 24 casos priorizados, preguntas de control, estados de confianza y decision support | **APPROVED** |

La aceptación de P0-T2 significa que el diagnóstico es suficientemente confiable para diseñar el target. No significa aceptar como correcto el comportamiento financiero actual ni reducir la severidad de sus hallazgos.

## 3. Charter consolidado aprobado

### 3.1 Problema

ProjectOps360° ya controla alcance, trabajo, relaciones, riesgos, decisiones y ejecución, pero su capacidad financiera actual es una foundation de estimación con rutas desconectadas. No existe todavía una posición profesional y reconciliada que separe funding, Original Budget, Current Baseline, commitments, actuals, accruals, forecast, reserves, changes, cash flow y payments.

La organización necesita controlar esas verdades dentro del mismo Core y conectarlas a WBS/CBS, milestones, tareas, subtareas, recursos, materiales, contratos, riesgos, cambios, decisiones y eventos, sin construir un ERP ni una aplicación paralela.

### 3.2 Objetivo

Diseñar e implementar por fases, y únicamente después de sus gates, un Project Financial Control Engine auditable, versionado, explicable y reconciliable que permita a las autoridades correspondientes responder:

1. cuánto fue autorizado;
2. cuál fue el Original Budget y cuál es la Current Baseline;
3. cuánto está comprometido, incurrido, accrued y pagado;
4. cuánto trabajo/costo resta y cuál es ETC/EAC;
5. qué exposure, changes y reserves existen;
6. cuándo se requiere caja;
7. qué decisión necesita atención y quién tiene autoridad.

### 3.3 Alcance funcional

Se aprueba como alcance objetivo:

- Funding, Estimate/BOE, Original Budget y Current Baseline;
- CBS conectada a WBS y estructura Core;
- Commitments provenientes de Procurement/Contract Management;
- Actual Cost y Accruals provenientes de Finance/ERP;
- Forecast, ETC, EAC y variance control;
- Total cost exposure sin doble contabilización;
- Pending, Approved y Rejected Changes;
- Contingency Reserve y Management Reserve con autoridades diferenciadas;
- Cash-flow forecast y payment visibility separados del costo incurrido;
- control por proyecto y rollup de portafolio sobre la misma verdad;
- trazabilidad a scope, execution, resources, materials, suppliers, contracts, risks y decisions;
- integración con Workboard, Reports, Command Center, Living Graph, Process Mining, Project Memory, Closeout e Isabella mediante resolvers comunes;
- adaptadores por framework sin fragmentar el Core.

### 3.4 Ownership y autoridad

| Verdad / proceso | Owner o autoridad aprobada |
|---|---|
| Funding | Sponsor / Steering |
| Estimate / BOE | PMO / Project Controls con estimadores y cost owners |
| Original Budget | PMO / Project Controls bajo aprobación correspondiente |
| Current Baseline | PMO / Project Controls; PMO Admin o Sponsor según umbral |
| Commitments | Procurement / Contract Management |
| Actual Cost y Accruals oficiales | Finance / Controller |
| Forecast / ETC / EAC | PMO / Project Controls |
| Contingency Reserve | PMO Admin o Sponsor según umbral |
| Management Reserve | Sponsor / Steering |
| Financial Changes | PMO Admin o Sponsor / Steering según impacto acumulado |
| Cash-flow forecast y payments | Finance / Treasury con inputs PMO/Procurement |
| Portfolio decisions | Portfolio Manager recomienda; Sponsor / Steering decide según autoridad |
| Isabella | Advisor read-only; sin autoridad transaccional |

El Project Manager puede consultar, solicitar, justificar y aportar evidencia. Solo puede preparar estimate, forecast, changes, accrual proposals o commitment requests mediante delegación explícita, limitada, versionada, vigente y revocable. Un rol técnico `owner/admin` no concede autoridad financiera.

### 3.5 Source-of-truth y compatibilidad

Se aprueban las siguientes fronteras:

1. cada business fact tendrá un solo owner;
2. `budget_items`, `cost_actuals`, `material_requirements` y `procurement_items` evolucionarán aditivamente;
3. `project_event_log` será el único lifecycle/event ledger canónico;
4. status, health y rollups reutilizarán sus owners existentes;
5. Living Graph continuará como proyección, nunca owner de importes o estados;
6. Budget UI, Reports, Command Center, Closeout, Process Mining e Isabella consumirán resolvers financieros comunes;
7. legacy data sin evidencia no se convertirá en approved truth;
8. la transición deberá ser stable-ID, idempotent, shadow-reconciled, feature-gated y reversible;
9. no habrá dual-write permanente entre dos verdades;
10. `unknown`, `unapproved`, `stale`, `incomplete` y conflictos permanecerán visibles.

### 3.6 Casos de uso aprobados

La baseline incluye 16 casos de proyecto y 8 de portafolio. Cubren autorización de funding, BOE, activación de budgets/baselines, commitments, actuals, accruals, forecast, exposure, changes, reserves, cash flow, cierre, calidad, rollups, intervención y escenarios.

Los casos se aprueban como decisiones de control, no como diseño de pantallas. Cada uno deberá conservar actor, trigger, pregunta, authority, source, evidencia, salida, estado honesto y no-objetivo durante implementación y prueba.

## 4. Estado actual aceptado

### 4.1 Capacidades existentes

- Budget UI gestiona estimate de materiales mediante `material_requirements`.
- Import/template puede crear summary rows en `budget_items`.
- `cost_actuals` existe como estructura, pero no tiene datos productivos demostrados.
- `procurement_items` existe, pero no tiene commitments productivos demostrados.
- Reports, Command Center y Closeout consumen summaries legacy con semánticas todavía no confiables como control financiero.
- Living Graph proyecta materiales; no existe todavía financial event flow canónico operativo.

### 4.2 Snapshot aceptado como evidencia

La auditoría productiva de P0-T2 registró:

- 38 `budget_items`, todos `planned` y con importes financieros en cero;
- 0 `cost_actuals` activos;
- 61 `material_requirements` por USD 9,964.65, sin vínculo a budget items;
- 0 `procurement_items` activos;
- 24 nodos financieros, todos provenientes de materials;
- 0 eventos financieros canónicos;
- el proyecto de esta iniciativa sin fixture financiero.

El snapshot prueba que el sistema no posee aún datos suficientes para validar control financiero, forecast o KPIs. La ausencia de datos reales confiables mantiene bloqueadas las afirmaciones predictivas y las validaciones funcionales posteriores hasta crear datasets controlados y reconciliables.

### 4.3 Hallazgos materiales aceptados para remediación

| Riesgo aceptado en discovery | Tratamiento obligatorio posterior |
|---|---|
| No existen Original Budget y Current Baseline versionados/aprobados | Definir truth, lifecycle, events, policy y migration antes de habilitar |
| `actual_cost` puede divergir entre summary y detail | Owner-write único y reconciliation contract |
| No hay ruta oficial Finance para actuals/accruals | Contrato idempotente y reconciliación con Finance |
| No hay ruta contractual de commitments | Integración con owner Procurement y evidencia contractual |
| RLS actual no implementa authority financiera/SoD | Security model y pruebas negativas antes de cualquier write |
| Budget action usa service role sin validación suficiente de fila/proyecto | Corregir y probar aislamiento antes de producción financiera |
| Consumers usan fallback `forecast = actual` | Eliminar mediante resolver común; forecast ausente = `unknown` |
| No existen eventos financieros canónicos | Extender Event Ingestion Service y registry sin crear segundo ledger |
| Health puede presentar señal positiva sin datos | Añadir estados no-data/unapproved/stale/reconciled al owner existente |
| No existe fixture financiero representativo | Crear datos controlados antes de cálculos, KPIs y gates de calidad |

Estos riesgos no bloquean G0 porque G0 aprueba el entendimiento del problema. Sí bloquean cualquier afirmación de production readiness y deberán quedar trazados en arquitectura, seguridad, implementación y gates posteriores.

## 5. Non-goals aprobados

### 5.1 Exclusiones permanentes

No se autoriza:

- convertir ProjectOps360° en ERP, General Ledger, Accounts Payable, payroll o banking system;
- duplicar Finance/ERP, Procurement/Contract Management o Treasury;
- crear un segundo proyecto, Gantt, event ledger, status engine, graph, approval system o financial truth;
- construir el motor como producto separado del Core;
- tratar historical actuals como forecast final;
- inferir funding desde budget, actuals, cash o payments;
- mezclar costo incurrido, accrual, invoice, payment y cash flow;
- editar silenciosa o destructivamente Original Budget o Current Baseline;
- asumir que todo Project Manager administra presupuesto;
- permitir que Isabella apruebe, postee, reconcilie, publique, libere reservas o modifique baseline;
- inventar fechas, importes, effort, productivity, baselines, accuracy ranges o historical outcomes;
- aplicar AACE 18R-97 como regla universal fuera del adaptador de Process Industries;
- habilitar prediction/optimization sin historial confiable, calibración, validación y human approval.

### 5.2 Restricciones temporales vigentes

Hasta G6 permanecen prohibidos para esta iniciativa:

- código de producto y cambios runtime;
- tablas o migraciones;
- APIs, Server Actions e integraciones;
- componentes UI o modificación de Budget UI;
- materialización de KPIs o forecast;
- operaciones financieras para Isabella;
- despliegues a development compartido, staging o producción.

G0 permite continuar el análisis y diseño de P1 y fases de arquitectura conforme al workplan. No adelanta ni sustituye G1–G6.

## 6. Success measures aprobados

Estas medidas quedan aprobadas como criterios de éxito del producto; **no se declaran alcanzadas en G0**.

| ID | Success measure | Evidencia futura requerida |
|---|---|---|
| SM-01 | Cada verdad financiera conserva semántica separada y reconciliable | Contract tests y reconciliation scenarios |
| SM-02 | Cada importe declara moneda, período, versión, estado, procedencia y autoridad | Schema/contracts + completeness tests |
| SM-03 | Budget y costos tienen trazabilidad hacia CBS/WBS y ejecución Core | Resolver/graph drill-through tests |
| SM-04 | PMO gobierna budget/forecast y PM opera solo dentro de delegación | Authorization y negative SoD tests |
| SM-05 | Changes, reserves y forecast poseen approval, versioning y audit trail | Lifecycle/event traceability tests |
| SM-06 | Finance, Procurement, Sponsor y Treasury conservan source authority | Integration ownership/reconciliation tests |
| SM-07 | No existe ledger, status engine, graph, approval flow o truth paralelo | Architecture conformance review |
| SM-08 | Legacy behavior migra aditivamente sin pérdida ni reinterpretación silenciosa | Shadow parity, rollback e idempotency tests |
| SM-09 | Consumers muestran la misma posición mediante resolver común | Cross-consumer parity tests |
| SM-10 | Unknown, unapproved, stale e incomplete nunca aparecen como cero o healthy | Trust-state y no-data tests |
| SM-11 | Isabella separa facts, reglas e inferencias y nunca ejecuta autoridad | AI tool authorization/traceability tests |
| SM-12 | Prediction/optimization solo se habilita con calidad y calibración aprobadas | Quality gate y bad-learning prevention tests |

## 7. Condiciones de salida G0

| Condición | Resultado | Evidencia |
|---|---|---|
| Objetivo y problema aprobados | PASS | P0-T1; sección 3 |
| Scope y límites funcionales aprobados | PASS | P0-T1; sección 3.3 |
| Ownership y SoD aprobados | PASS | P0-T3; sección 3.4 |
| Current state auditado y aceptado | PASS | P0-T2; sección 4 |
| Non-goals permanentes y temporales aprobados | PASS | P0-T1; sección 5 |
| Source-of-truth boundaries aprobados | PASS | P0-T4; sección 3.5 |
| Casos PMO representativos aprobados | PASS | P0-T5; sección 3.6 |
| Success measures aprobados y trazables | PASS | P0-T1; sección 6 |
| Riesgos y condiciones carry-forward explícitos | PASS | Secciones 4.3 y 8 |
| Autoridad Product Owner registrada | PASS | Sección 1 |

**Resultado del gate:** **G0 PASS**.

## 8. Condiciones carry-forward obligatorias

1. P1 definirá las financial truths, lenguaje, fórmulas y separación de cash flow sin contradecir este charter.
2. Ninguna fórmula podrá conflar funding, baseline, commitment, actual, accrual, forecast, exposure, reserve o payment.
3. P2 y fases de arquitectura deberán resolver authority, event contracts, integration boundaries y observabilidad antes de writes.
4. La seguridad deberá demostrar tenant/project isolation y SoD con pruebas negativas.
5. La migración deberá preservar IDs, links y datos legacy de forma aditiva, idempotente y reversible.
6. Un dataset controlado deberá cubrir happy paths, errores, duplicados, late arrivals, reversals, currency, periods, changes y reserves.
7. G6 deberá aprobar arquitectura, contratos, seguridad, compatibilidad, migración y test strategy antes de código/runtime.
8. Cualquier cambio de scope, ownership, non-goals o success measures requiere change record y nueva decisión del Product Owner.
9. Los 15 hallazgos P0-T2 deberán mapearse a controles y acceptance tests; ninguno podrá cerrarse solo por documentación.
10. Production data no será modificada para demostrar readiness antes de los gates correspondientes.

## 9. Decisiones P0-T6 / G0

| ID | Decisión | Estado |
|---|---|---|
| P0-T6-D1 | Se aprueba el discovery baseline compuesto por P0-T1–P0-T5. | Aprobada |
| P0-T6-D2 | Se aprueba el charter consolidado de objetivo, scope, ownership, non-goals y success measures. | Aprobada |
| P0-T6-D3 | P0-T2 se acepta como descripción del current state, no como aprobación del comportamiento actual. | Aprobada |
| P0-T6-D4 | Los hallazgos current-state son condiciones carry-forward y bloquean readiness hasta remediación demostrada. | Aprobada |
| P0-T6-D5 | P0 queda cerrado y P1 puede comenzar conforme a dependencias y gates del workplan. | Aprobada |
| P0-T6-D6 | G0 no autoriza implementación; la restricción hasta G6 permanece vigente. | Aprobada |
| P0-T6-D7 | Success measures quedan aprobados como objetivos verificables, no como resultados ya alcanzados. | Aprobada |
| P0-T6-D8 | Toda desviación material del charter requiere change control y nueva aprobación Product Owner. | Aprobada |

## 10. Trazabilidad

| Evidencia | Referencia |
|---|---|
| Contrato P0-T6, owner, acceptance y gate G0 | `Project360/ProjectOps360_Budget_Cost_Management_Workplan_v1.json:175` |
| Problema y objetivo aprobados | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:25` |
| Alcance funcional | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:54` |
| Fronteras de autoridad | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:106` |
| Non-goals y bloqueo hasta G6 | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:121` |
| Success measures originales | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:160` |
| Auditoría del current state | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:18` |
| Snapshot productivo read-only | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:207` |
| Hallazgos y riesgos actuales | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:249` |
| Financial RACI | `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md:104` |
| Segregation of duties | `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md:126` |
| Ownership map y compatibility | `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md:88` |
| Resolver/consumer boundaries | `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md:260` |
| Casos de uso de proyecto | `Project360/Budget_Cost_Management/P0-T5_Representative_PMO_Use_Cases_Control_Questions.md:72` |
| Casos de uso de portafolio | `Project360/Budget_Cost_Management/P0-T5_Representative_PMO_Use_Cases_Control_Questions.md:298` |
| Criterio de aceptación P0-T5 | `Project360/Budget_Cost_Management/P0-T5_Representative_PMO_Use_Cases_Control_Questions.md:627` |

## 11. Matriz de aceptación P0-T6

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe G0 approval record | PASS | Sección 1 |
| Scope está aprobado y trazable | PASS | Secciones 3.3, 7 y 10 |
| Ownership está aprobado y trazable | PASS | Secciones 3.4, 7 y 10 |
| Current state está aceptado y trazable | PASS | Secciones 4, 7 y 10 |
| Non-goals están aprobados y trazables | PASS | Secciones 5, 7 y 10 |
| Success measures están aprobados y trazables | PASS | Secciones 6, 7 y 10 |
| Predecesores P0-T2–P0-T5 están completos | PASS | Sección 2 y matrices de aceptación fuente |
| Charter no contradice source ownership | PASS | Secciones 3.4 y 3.5 |
| Hallazgos no se confunden con aceptación de riesgo productivo | PASS | Secciones 2 y 4.3 |
| Restricción de implementación hasta G6 continúa | PASS | Secciones 1, 5.2, 8 y P0-T6-D6 |
| La aprobación fue emitida por la autoridad requerida | PASS | Sección 1 |
| Cumple criterio original de aceptación | **PASS** | Scope, ownership, current state, non-goals y success measures aprobados y trazables |

## 12. Cierre de P0 y handoff

Con G0 aprobado, P0 queda cerrado como discovery baseline. P1 puede comenzar con la definición canónica del dominio financiero y sus métricas, siempre dentro del charter, RACI, source boundaries y casos PMO aprobados. G0 no concede permiso para escribir código ni modificar ambientes.

El siguiente trabajo deberá referenciar `G0-D1` y demostrar trazabilidad hacia el requisito o riesgo que resuelve. Si una propuesta introduce scope nuevo, cambia ownership, debilita un non-goal, convierte un consumer en source of truth o declara alcanzado un success measure sin evidencia, deberá detenerse y volver a Product Owner.

## Nota de cierre lista para ProjectOps360°

P0-T6 completada y G0 aprobado. El Product Owner aprobó el discovery baseline y charter consolidados de P0-T1 a P0-T5. Quedaron aprobados y trazables el objetivo, alcance, ownership financiero, current state, non-goals, source-of-truth boundaries, 24 casos PMO y 12 success measures. La auditoría current-state se acepta como evidencia del punto de partida, no como aprobación del comportamiento actual: los 15 hallazgos de P0-T2 permanecen como condiciones obligatorias de remediación y bloquean production readiness hasta demostrar controles, reconciliación, seguridad y datos de prueba. PMO / Project Controls conserva budget control y forecast; Finance conserva actuals/accruals; Procurement conserva commitments; Sponsor/Steering conserva funding y management reserve; Treasury conserva payments/cash; el PM opera por delegación y Isabella solo asesora. G0 cierra P0 y habilita P1 conforme al workplan, pero no autoriza código, migraciones, APIs, UI, integraciones, staging, producción ni deploy; esa restricción permanece hasta G6. Se aprobaron 8 decisiones G0 y todos los criterios de aceptación pasaron. Evidencia: `Project360/Budget_Cost_Management/P0-T6_G0_Discovery_Baseline_Charter_Approval.md`.
