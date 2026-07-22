# P5 — Core integration, PMO experience and Isabella / G5

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P5 — Core integration, PMO experience and Isabella |
| Tareas | P5-T1 a P5-T7 |
| Gate | G5 — PMO experience and Core integration approved |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-22 |
| Predecesor | P4-T7 / G4 PASS |
| Owner | PMO Product Lead |
| Accountable | Product Owner |
| Consultados | PMO Admin; Finance; UX; Product Architecture; Security |
| Estado | **APROBADO — G5 PASS** |
| Principio | Integrado en el Core actual; no app separada, no segundo Gantt |

## P5-T1 — PMO financial control cockpit and portfolio rollups

El cockpit será una evolución del Command Center y Reports existentes, no un producto paralelo. Reutiliza scope selector, project cards, Reports & Intelligence, drill-downs y permission context.

### Jerarquía de información

1. **Portfolio/organization bar:** scope, cut-off, currency, period, data freshness y completeness.
2. **Control cards:** Funding available, Current Baseline, Cost Exposure, selected EAC, VAC, Contingency/MR, confidence.
3. **Exception lane:** unreconciled, approved-not-posted, stale forecast, aged accrual, over-commitment, closed-period attempt.
4. **Project comparison:** normalized metrics y quality state, sin rankear unknown como zero.
5. **Evidence drill-down:** project → control account → source transaction/version/event/evidence.

Rollups conservan project currency y reporting currency, FX provenance, formula/scenario version y completeness. Un project sin datos aparece `unavailable/incomplete`, no como mejor desempeño.

### Nota de cierre P5-T1

P5-T1 completada. Se aprobó una IA PMO-first dentro de Command Center/Reports con comparación de funding, baseline, exposure, EAC, variance, reserve y confidence, y drill-down hasta evidencia canónica.

## P5-T2 — Role-specific experiences

| Rol | Vista por defecto | Acciones permitidas | Límites |
|---|---|---|---|
| PMO / Project Controls | Portfolio + project control cockpit | Prepare forecast/change/baseline package, reconcile, escalate | Approval/posting según SoD |
| Project Manager | Delivery impact, forecast inputs, change requests | View, contribute evidence, request change, update progress | No forced budget administration; no actual/payment/MR posting |
| Sponsor / Steering | Funding, baseline, reserve, decisions | Approve dentro de authority, request clarification | No preparation/posting/reconciliation |
| Finance / Controller | Actuals, accruals, periods, reconciliation | Validate/approve/post/reconcile conforme SoD | No contract authority ni PM scope approval |
| Procurement | Contract/PO commitments y evidence | Prepare/issue/amend/cancel conforme authority | No actual/payment/funding approval |
| Treasury / AP | Payment queue y cash | Release/instruct/reconcile según SoD | No incurred-cost rewrite |
| Audit | Evidence, events, reconciliations | Read/export findings | No mutation |

Disclosure es field/action-level, no solo page-level. UI hiding nunca sustituye server/database enforcement. Tablet/phone priorizan summary, exceptions y single-action flows; large tables usan cards, progressive disclosure y horizontal overflow controlado.

### Nota de cierre P5-T2

P5-T2 completada. Se aprobaron workflows y disclosure por rol. El PM puede ejecutar su proyecto sin administrar presupuesto; acciones financieras siguen permission-, authority- y approval-gated.

## P5-T3 — Evolution of the existing Budget surface

Ruta preservada: `/[locale]/projects/[projectId]/budget`.

### Transición aditiva

| Etapa/tab | Contenido |
|---|---|
| Estimate & Materials | Experiencia actual de categories, quantities, unit costs y material estimate, sin reemplazo |
| Basis of Estimate | BOE, evidence, assumptions, classification y version |
| Budget & Baseline | Proposal, Original Budget, Current Baseline versions y bridge |
| Cost Control | Commitments, actuals, accruals, EVM, EAC/ETC y reconciliation |
| Funding & Cash | Authorization/release/restrictions y cash-flow/payment views |
| Changes & Reserves | Change packages, contingency y Management Reserve |

El tab inicial durante rollout permanece Estimate & Materials. Feature flags habilitan tabs nuevos independientemente. Existing IDs/links/imports se mapean; no se reinterpretan automáticamente como approved budget. No se crea un Gantt: schedule impact enlaza a Execution Map/Living Graph existentes.

### Nota de cierre P5-T3

P5-T3 completada. Se aprobó una evolución por tabs de la ruta Budget actual; material estimating permanece disponible y se incorpora como input de estimating/BOE sin reemplazo silencioso ni segundo Gantt.

## P5-T4 — Living Graph financial projections

Living Graph sigue siendo una proyección sobre canonical owners y `project_event_log`.

### Node projections

- Funding Authorization/Release;
- Estimate/BOE y Baseline Version;
- Contract/PO/Commitment;
- Actual Batch/Accrual;
- Financial Change;
- Contingency/MR Movement;
- Forecast Scenario;
- Payment/Settlement;
- Reconciliation/Exception.

### Edge projections

- `funds / restricts / allocates`;
- `baselines / changes / supersedes`;
- `commits / consumes / matches`;
- `accrues / reverses / settles`;
- `draws_from / returns_to`;
- `forecasts / explains / reconciles`;
- `caused_by` solo con explicit evidence;
- `correlated_with` claramente rotulado.

Overlays: baseline vs forecast, funding coverage, commitment exposure, cost variance, change/reserve impact, cash timing y data quality. Cada node/edge abre source/evidence y muestra `projection_as_of`. No se permite crear/edit financial facts desde canvas.

### Nota de cierre P5-T4

P5-T4 completada. Se aprobó el contrato de nodes, edges y overlays financieros como proyección trazable. Living Graph no crea verdad paralela ni graph decorativo.

## P5-T5 — Process Mining and root-cause financial analysis

Process Mining consume canonical events y object refs. Toda relación se clasifica:

| Clase | Significado |
|---|---|
| Temporal order | A ocurrió antes que B |
| Explicit causality | Source decision/change/risk evidencia que A causó B |
| Process dependency | Workflow/contract exige A antes de B |
| Correlation | Asociación estadística/operacional, no causa |
| Hypothesis | Explicación candidata que requiere revisión humana |

Análisis aprobados:

- approval/posting lead time;
- change cycle y approved-not-posted aging;
- commitment amendment/rework;
- invoice→payment latency;
- accrual aging/match;
- period-close exceptions;
- variance decomposition por explicit change/risk/source;
- repeated reconciliation failures.

Proximidad temporal, mismo vendor o mismo control account no prueban causa. Root-cause panels citan event IDs, source refs, formula/version y confidence.

### Nota de cierre P5-T5

P5-T5 completada. Se aprobó event-to-variance analysis separando orden temporal, dependency, explicit causality, correlation e hypothesis; ninguna causa de costo se inventa por proximidad.

## P5-T6 — Isabella Cost Intelligence

### Read-only tools

| Tool contract | Resultado |
|---|---|
| `get_financial_snapshot` | Snapshot autorizado con scope/cut-off/quality |
| `explain_variance` | Formula, components, events y evidence |
| `compare_forecast_scenarios` | EAC/ETC/P50/P80 con assumptions/limits |
| `trace_financial_fact` | Owner→source→approval→event lineage |
| `simulate_change` | Scenario no persistido; no baseline mutation |
| `simulate_reserve_draw` | Impact hipotético; no release |
| `summarize_reconciliation_exceptions` | Exceptions y next authorized owner |

### Grounding contract

Cada respuesta declara project/scope, `as_of`, source IDs, formula/scenario version, evidence links, quality/confidence, assumptions y limitations. Unknown permanece unknown. Isabella rechaza:

- approve/post/release/reopen commands;
- baseline, actual, payment o reserve mutations;
- evidence cross-tenant;
- predictive claims sin quality threshold;
- instructions para saltar SoD/security;
- respuestas financieras sin canonical source.

Human approval ocurre en workflow owner, nunca en chat. Voice bridge hereda exactamente los mismos permissions y refusal rules.

### Nota de cierre P5-T6

P5-T6 completada. Se aprobaron tools read-only para snapshots, variance, scenarios, traceability y simulations. Isabella cita sources/formulas y no puede aprobar, postear, cambiar baseline, liberar reserves ni reabrir periodos.

## P5-T7 — G5 approval

### Revisión de integración

| Criterio | Resultado |
|---|---|
| PMO-first portfolio/project control | PASS |
| Role-safe disclosure/actions | PASS |
| PM no obligado a administrar budget | PASS |
| Existing Budget/Material Estimate preservado | PASS |
| No app separada ni segundo Gantt | PASS |
| Living Graph como projection | PASS |
| Process Mining evidence-grounded | PASS |
| Isabella read-only/human approval | PASS |
| Desktop/tablet/phone patterns definidos | PASS |
| Existing Core routes/functions intactos | PASS |

### Responsive acceptance

- Desktop: comparison grid, evidence drawer y multi-column drill-down.
- Tablet: two-column cards, collapsible filters y sticky action summary.
- Phone: one-column cards, bottom sheet details, no clipped controls, 44px touch targets.
- Tables: card/list alternative o controlled horizontal scroll.
- Graph: summary/list fallback antes de canvas completo.
- No critical action depende de hover.

### Escenarios G5

| # | Escenario | Resultado |
|---:|---|---|
| 1 | PM abre project financial view | Delivery-first; budget admin no obligatorio |
| 2 | PM intenta postear actual | Deny |
| 3 | Sponsor revisa funding/MR | Evidence + approve action según authority |
| 4 | Finance revisa period exception | Full accounting context |
| 5 | Procurement ve contract line | Commercial permission scope |
| 6 | Audit abre lineage | Read-only owner/source/event chain |
| 7 | Existing material estimate | Permanece operativo |
| 8 | Living Graph node seleccionado | Projection + evidence, no edit |
| 9 | Temporal proximity sin cause link | Correlation/hypothesis only |
| 10 | Isabella explica CPI | Cita snapshot/formula/quality |
| 11 | Isabella recibe “release MR” | Refusal + authorized workflow |
| 12 | Phone viewport | No clipped navigation/actions |

### Decisión G5

| Campo | Decisión |
|---|---|
| Gate | G5 |
| Decisión | **APPROVE** |
| Approvers | Product Owner + PMO Admin + Finance + UX + Product Architecture |
| Resultado | **G5 PASS** |
| Consecuencia | Habilita P6 architecture package/readiness |

### Nota de cierre P5-T7

P5-T7 completada y G5 aprobado. La experiencia es PMO-first, role-safe, responsive e integrada en Command Center, Budget, Reports, Living Graph, Process Mining e Isabella. No se crea app separada, segundo Gantt, graph truth ni AI approval path.

## Matriz de aceptación P5

| Tarea | Criterio original | Resultado |
|---|---|---|
| P5-T1 | PMO compara funding, baseline, exposure, EAC, variance, reserve y confidence con drill-down | PASS |
| P5-T2 | PM trabaja sin administrar budget; controlled actions gated | PASS |
| P5-T3 | Existing material estimate permanece y se mapea aditivamente | PASS |
| P5-T4 | Graph es canonical projection, no truth/decoración | PASS |
| P5-T5 | Temporal order, causality y correlation están separados | PASS |
| P5-T6 | Isabella grounded/read-only y no aprueba/postea | PASS |
| P5-T7 | Diseño PMO-first, role-safe, responsive e integrado | PASS |

No se modificó schema, base de datos ni producción y no se realizó deploy. P5 se limita a experiencia e integración aprobadas por G5.
