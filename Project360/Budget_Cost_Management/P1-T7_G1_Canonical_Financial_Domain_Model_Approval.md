# P1-T7 — Aprobación G1 del modelo financiero canónico

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T7 — Approve canonical financial domain model |
| Gate | G1 — Canonical financial model approved |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P1-T2; P1-T3; P1-T4; P1-T5; P1-T6; P1-T1 como fundamento |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin |
| Gate approvers | PMO + Finance + Product Architecture |
| Consultados | Finance; Product Architecture; Security |
| Entregable | G1 approval record |
| Estado | **APROBADO — G1 PASS** |
| Alcance de aprobación | Lenguaje y dominio financiero canónico; no autoriza implementación ni despliegue |

## 1. Registro formal de decisión G1

| Campo | Decisión |
|---|---|
| Decision ID | G1-D1 |
| Decisión | **APPROVE** |
| Paquete aprobado | P1-T1 a P1-T6, consolidadas por este registro P1-T7 |
| Autoridad de gate | PMO + Finance + Product Architecture conforme al workplan |
| Evidencia de autorización | Instrucción explícita del Product Owner de completar el milestone, incluida la tarea “Approve canonical financial domain model”, y revisión de conformidad registrada en este documento |
| Fecha efectiva | 2026-07-21 |
| Consecuencia | Cierra P1 y habilita P2 sujeto a sus dependencias y gates |
| Restricción | No habilita schema, migrations, APIs, UI, integrations, materialización, staging, production ni deploy antes de G6 |

**Dictamen:** el modelo financiero canónico queda aprobado porque sus verdades, jerarquías, dimensiones, moneda/tiempo, lifecycles, eventos, ownership, isolation y compatibilidad son internamente consistentes, trazables al G0 y no introducen owners paralelos.

## 2. Paquete de evidencia aprobado

| Tarea | Entregable | Resultado |
|---|---|---|
| P1-T1 | Seis verdades financieras y cash-flow separation | **APPROVED** |
| P1-T2 | CBS ontology y WBS/control-account linkage | **APPROVED** |
| P1-T3 | Dimensiones y traceability references | **APPROVED** |
| P1-T4 | Currency, FX, fiscal period y accounting-date semantics | **APPROVED** |
| P1-T5 | Lifecycle state machines e invariants | **APPROVED** |
| P1-T6 | Canonical event vocabulary y provenance envelope | **APPROVED** |

## 3. Modelo consolidado aprobado

### 3.1 Verdades y objetos

| Categoría | Objetos aprobados | Owner principal |
|---|---|---|
| Autorización | Funding | Sponsor / Steering; PMO controla expediente |
| Control presupuestario | Original Budget; Current Baseline | PMO / Project Controls |
| Obligación | Commitment | Procurement / Contract Management |
| Costo incurrido | Actual Cost; Accrual complementario | Finance / Controller |
| Expectativa | Forecast / ETC / EAC | PMO / Project Controls |
| Caja | Cash Flow; Payment | Finance / Treasury |
| Preparación | Estimate / BOE | Cost Engineering / PMO |
| Gobierno | Change; Contingency Reserve; Management Reserve | PMO/Sponsor según authority |

Cash, payment, invoice, accounting recognition y cost incurred permanecen separados. Estimate no crea autorización. Forecast no tiene fallback. Pending changes no cambian baseline.

### 3.2 Estructura y trazabilidad

- CBS es la jerarquía financiera; WBS permanece en el Core.
- Control account conecta CBS, scope WBS, responsabilidad y período.
- Una financial line tiene posting node principal y puede enlazar varios elementos de ejecución.
- No se fuerza una línea por task.
- Links informativos no distribuyen importes; allocations explícitas cuadran 100%.
- Drill-down llega desde portfolio/project hasta source document/event/evidence.
- `organization_id + project_id` gobiernan aislamiento de facts y links.

### 3.3 Moneda y tiempo

- Transaction, project, functional, reporting, funding y cash currencies son roles distintos.
- El importe original nunca se sobrescribe.
- Cada conversión conserva source/type/date/version/quote/precision.
- Fiscal, accounting, control, forecast y reporting periods son distintos.
- Incurred, transaction, invoice, posting, due y payment dates son distintos.
- Closed-period corrections usan adjustment/reversal o reopen autorizado.

### 3.4 Lifecycle y eventos

- Cada objeto posee lifecycle explícito con deny-by-default.
- Approval, posting/publishing y reconciliation son funciones separadas.
- Versiones activadas/posteadas/publicadas son inmutables; corrections compensan.
- Owner mutation y event append deberán ser atómicos e idempotentes.
- `project_event_log` permanece como ledger único.
- Process Mining, Living Graph, Reports e Isabella consumen resolvers/projections.

## 4. Fórmulas y separaciones aprobadas

| Posición | Contrato aprobado |
|---|---|
| Current Baseline | Original Budget + efectos aprobados y posteados conforme a policy/version |
| Open Commitment | Commitment aprobado vigente menos consumo/cancelaciones reconciliados |
| Recognized Cost To Date | Actuals reconciliados + accruals aprobados no reemplazados, según policy |
| EAC | Recognized Cost To Date + ETC publicado |
| Baseline Variance | EAC - Current Baseline comparable |
| Cost Exposure | Breakdown policy-versioned con inclusiones/solapamientos declarados; nunca suma ciega |
| Cash Gap | Cash demand publicada - funding/liquidity schedule comparable |

Las fórmulas son contratos conceptuales de P1. P4 deberá especificar cálculo, materialidad, tolerancias y pruebas antes de implementación.

## 5. Conformidad con ownership y SoD

| Control | Resultado |
|---|---|
| PMO controla budget/baseline/forecast | PASS |
| Finance controla actuals/accruals/periods | PASS |
| Procurement controla contract/PO/commitments | PASS |
| Sponsor controla funding/management reserve/thresholds | PASS |
| Treasury controla payment/cash official | PASS |
| PM actúa por consulta/solicitud y delegación acotada | PASS |
| Requester/preparer, approver, poster y reconciler se separan | PASS |
| Service account solo postea bajo contrato | PASS |
| Isabella permanece read-only advisor | PASS |

## 6. Conformidad con current→target boundaries

| Boundary | Resultado |
|---|---|
| `budget_items` conserva IDs/links y evoluciona aditivamente | PASS |
| `cost_actuals` es punto de evolución del actual-detail local | PASS |
| `material_requirements` permanece estimate/material truth | PASS |
| `procurement_items` evoluciona hacia commitment semantics | PASS |
| `project_event_log` permanece único ledger | PASS |
| Execution Status/Health owners permanecen únicos | PASS |
| `process_nodes/process_edges` permanecen projections | PASS |
| Existing governance primitives se reutilizan/extienden | PASS |
| Reports/UI/Graph/Isabella no se convierten en truth owners | PASS |

## 7. Revisión de consistencia cruzada

| Regla | T1 | T2 | T3 | T4 | T5 | T6 | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Un owner por hecho | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Organization/project isolation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| No double-count | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Unknown no es cero | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Versioning/immutability | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Source/evidence/provenance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Authority/SoD | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| No second ledger/status/graph/truth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Additive compatibility | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| PMO como actor primario | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |

## 8. Escenarios end-to-end del gate

| # | Escenario | Resultado esperado | Resultado |
|---:|---|---|---|
| 1 | Estimate/material takeoff sin approval | No funding/budget/baseline | PASS |
| 2 | Original Budget intenta editarse tras activation | Deny; change + new baseline version | PASS |
| 3 | Commitment y actual parcial comparten contract line | Open balance sin duplicar actual | PASS |
| 4 | Actual llega sin CBS mapping | Preserve + exception; no certified rollup | PASS |
| 5 | Accrual recibe actual correspondiente | Match/reverse sin doble conteo | PASS |
| 6 | Forecast falta | `unknown`; no fallback | PASS |
| 7 | Pending change pretende alterar baseline | Deny hasta approved + posted | PASS |
| 8 | Actual/payment tienen fechas distintas | Cost/cash en períodos separados | PASS |
| 9 | Portfolio mezcla monedas sin FX policy | Deny comparable total | PASS |
| 10 | PM sin delegación publica forecast | Deny | PASS |
| 11 | Service account intenta aprobar actual | Deny | PASS |
| 12 | Isabella recomienda reserve draw | Recomendación visible; no transaction | PASS |
| 13 | Retry de import usa misma idempotency identity | Un owner write + un event | PASS |
| 14 | Corrección intenta editar event history | Deny; compensating event | PASS |
| 15 | Graph tiene links múltiples al mismo hecho | Contar una vez por canonical identity | PASS |
| 16 | Closed-period actual cambia accounting date | Deny; adjustment/reopen autorizado | PASS |
| 17 | Legacy budget row carece de approval evidence | `legacy_unapproved/unmapped` | PASS |
| 18 | Consumer convierte missing feed en cero/healthy | Deny; incomplete/unknown | PASS |

## 9. Condiciones de salida G1

| Condición | Resultado | Evidencia |
|---|---|---|
| Seis verdades y cash separation aprobadas | PASS | P1-T1 |
| CBS/WBS/control account aprobado | PASS | P1-T2 |
| Dimensiones/trazabilidad/isolation aprobadas | PASS | P1-T3 |
| Currency/FX/period/date policy aprobada | PASS | P1-T4 |
| Lifecycles/invariants aprobados | PASS | P1-T5 |
| Events/provenance/ledger boundary aprobados | PASS | P1-T6 |
| Definiciones y fórmulas son consistentes | PASS | Secciones 3–7 |
| Ownership y SoD son consistentes | PASS | Sección 5 |
| Existing Core y data paths se preservan | PASS | Sección 6 |
| Revisión end-to-end completada | PASS | Sección 8 |

**Resultado del gate:** **G1 PASS**.

## 10. Condiciones carry-forward obligatorias

1. P2 debe diseñar estimating/baseline architecture usando este lenguaje sin reinterpretar Estimate, Original Budget o Current Baseline.
2. P3 debe materializar ownership, authority, integration y ledger architecture sin crear owners paralelos.
3. P4 debe formalizar fórmulas, tolerancias, exposure/forecast measurement y pruebas anti-double-count.
4. P5 debe integrar Budget UI, Reports, Command Center, Living Graph, Process Mining e Isabella sobre resolvers comunes.
5. Security debe demostrar tenant/project isolation y SoD con pruebas negativas antes de writes compartidos.
6. Migration debe clasificar legacy rows como unknown/unapproved/unmapped hasta evidencia válida.
7. Development/Preview usarán staging; Production seguirá aislada y solo se actualizará mediante release aprobado.
8. No migrations se aplicarán mientras exista drift de migration history sin reconciliar.
9. AACE 18R-97 se limita al adaptador de Process Industries y no define una precisión garantizada ni el Core universal.
10. G1 no adelanta G2–G6 y no autoriza implementación.

## 11. Decisiones P1-T7 / G1

| ID | Decisión | Estado |
|---|---|---|
| P1-T7-D1 | Se aprueba el paquete P1-T1 a P1-T6 como modelo financiero canónico. | Aprobada |
| P1-T7-D2 | G1 confirma consistencia de truth, dimensions, lifecycle, events y ownership. | Aprobada |
| P1-T7-D3 | Cash/cost/payment y estimate/budget/baseline permanecen separados. | Aprobada |
| P1-T7-D4 | CBS se conecta a WBS/Core sin duplicarlo. | Aprobada |
| P1-T7-D5 | Currency/time semantics y closed-period rules son obligatorios. | Aprobada |
| P1-T7-D6 | `project_event_log` y existing status/graph/governance permanecen únicos. | Aprobada |
| P1-T7-D7 | Legacy data no se promueve sin evidence/approval/mapping. | Aprobada |
| P1-T7-D8 | P1 queda cerrado y P2 puede comenzar conforme a dependencias. | Aprobada |
| P1-T7-D9 | G1 no autoriza implementación ni deployment antes de G6. | Aprobada |

## 12. Trazabilidad

- G0 y carry-forward: `Project360/Budget_Cost_Management/P0-T6_G0_Discovery_Baseline_Charter_Approval.md`.
- Current-state evidence: `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md`.
- Authority/SoD: `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md`.
- Source boundaries: `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md`.
- PMO use cases: `Project360/Budget_Cost_Management/P0-T5_Representative_PMO_Use_Cases_Control_Questions.md`.
- Current financial schema: `supabase/migrations/20260708000000_universal_execution_model.sql:179`.
- Existing event ledger: `supabase/migrations/20260830000000_project_event_log.sql:10`.
- Existing ingestion service: `src/lib/events/ingestion.ts`.
- Existing status owner: `src/lib/execution/status-engine.ts`.

## 13. Matriz de aceptación P1-T7

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe G1 approval record | PASS | Sección 1 |
| Definitions son consistentes | PASS | Secciones 3–4 y 7 |
| Dimensions y isolation son consistentes | PASS | Sección 3.2 y P1-T3 |
| Lifecycles e invariants son consistentes | PASS | Sección 3.4 y P1-T5 |
| Events/provenance son consistentes | PASS | Sección 3.4 y P1-T6 |
| Ownership/SoD son consistentes | PASS | Sección 5 |
| Compatibility/no-parallel owners se preservan | PASS | Sección 6 |
| End-to-end validation pasó | PASS | Sección 8 |
| Criterio original de aceptación | **PASS** | Definitions, dimensions, lifecycles, events y ownership aprobados |

## 14. Cierre de P1 y handoff

Con G1 aprobado, P1 queda cerrado como canonical financial language. P2 puede comenzar con estimating and baseline architecture, sujeto a sus tareas, revisión y gate G2. Toda propuesta posterior deberá citar una decisión P1, mantener owners y separaciones aprobadas, y demostrar si agrega una capacidad o simplemente proyecta una verdad existente.

Una propuesta vuelve a revisión si fusiona verdades, redefine un owner, crea ledger/status/graph/approval paralelos, altera Core/WBS, debilita isolation/SoD, introduce una fórmula no versionada o interpreta legacy data como approved.

## Nota de cierre lista para ProjectOps360°

P1-T7 completada y G1 aprobado. PMO, Finance y Product Architecture aprobaron el paquete P1-T1 a P1-T6 como modelo financiero canónico. Quedaron aprobadas seis verdades — Funding, Original Budget, Current Baseline, Commitments, Actual Cost y Forecast/ETC/EAC — con Cash Flow/Payments separados. CBS se conecta a WBS mediante control accounts y links explícitos sin duplicar el Core ni forzar budget por task. Las dimensiones soportan drill-down y portfolio rollup con organization/project isolation. Monedas, FX, fiscal/accounting/forecast periods y business/payment dates conservan semánticas separadas. Lifecycles son deny-by-default, versionados e inmutables; corrections compensan. El vocabulario financiero usa `project_event_log` y Event Ingestion Service existentes con provenance, authority, evidence e idempotency. Se validaron 18 escenarios y todas las condiciones G1 pasaron. P1 queda cerrado y P2 puede iniciar, pero G1 no autoriza código, migrations, APIs, UI, staging, producción ni deploy antes de G6. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T7_G1_Canonical_Financial_Domain_Model_Approval.md`.
