# P2-T4 — Versionado, comparación y supersession de estimates

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P2 — Estimating, classification and baseline architecture |
| Tarea | P2-T4 — Define estimate versioning, comparison and supersession rules |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P2-T1; P2-T2 |
| Owner | Product Architecture |
| Accountable | PMO / Project Controls Lead |
| Consultados | Cost Engineering; Audit; Finance |
| Entregable | Immutable estimate-version lifecycle |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P2** |
| Efecto | Define lineage y bridges; no implementa almacenamiento ni modifica estimates actuales |

## 1. Decisión de versionado

Cada Estimate Version oficial es un snapshot inmutable de scope, BOE, lines, quantities, rates, methods, sources, classification, risks, contingency, currency y approvals. Una revisión crea una nueva versión con lineage y comparison bridge; nunca sobrescribe la anterior.

Scenarios, alternatives y working drafts se mantienen separados de la official series. Solo una versión publicada puede ser vigente para un purpose/scope/as-of determinado, pero todas las anteriores permanecen trazables.

## 2. Modelo lógico

| Objeto | Identidad | Regla |
|---|---|---|
| Estimate Series | Stable series ID | Agrupa revisiones comparables del mismo purpose/scope contract |
| Estimate Version | Version ID + immutable sequence/revision | Snapshot completo |
| BOE Version | Paired version ID | Exactamente una versión oficial por Estimate Version |
| Estimate Line Version | Stable line lineage ID + version line ID | Permite added/removed/changed/unchanged tracing |
| Classification Determination | Scheme/adapter-qualified snapshot | No se hereda sin reevaluar evidence |
| Comparison | From/to version IDs + policy | Resultado reproducible e inmutable |
| Supersession Link | Prior/successor IDs + effective reason/date | No elimina prior version |
| Scenario Branch | Branch/scenario ID | Nunca sustituye official version hasta promotion aprobada |

## 3. Identidad de serie y boundary de comparación

Dos versiones pertenecen a la misma Estimate Series cuando comparten:

- organization/project;
- purpose/end-use family;
- canonical included scope boundary;
- primary currency/control basis;
- owner/accountability context;
- lineage explícito.

Un cambio material de project, business objective o incomparable scope puede requerir nueva series con cross-series reference. El sistema no fuerza una variance engañosa entre objetos no comparables.

## 4. Creación de versiones

Una nueva versión requiere:

- parent/prior version ID o explicit `initial` reason;
- revision reason/category;
- request/command ID e idempotency key;
- effective/base/as-of dates;
- BOE copy-with-lineage y changed-section markers;
- source/evidence population congelada;
- creator/preparer authority;
- lifecycle state `draft`;
- branch: official candidate, scenario o alternative.

Copiar una versión nunca comparte arrays/documentos mutables. References a evidence owners sí pueden reutilizarse por immutable version/checksum.

## 5. Categorías de revisión

| Código | Motivo | Ejemplo |
|---|---|---|
| `scope_change` | Inclusión/exclusión o quantity scope | Nuevo unit, deliverable o package |
| `design_maturity` | Definición/evidence evoluciona | P&ID/layout/takeoff más maduro |
| `quantity_update` | Cambian cantidades | Updated takeoff/model |
| `rate_market_update` | Cambian rates/quotes/market | Vendor quote o labor rate nuevo |
| `method_change` | Cambia estimating method/factor | Parametric a detailed takeoff |
| `schedule_escalation` | Timing/escalation cambia | Start date o index update |
| `currency_fx` | Cambia FX set/policy | New forecast/budget rate set |
| `risk_contingency` | Cambia risk/uncertainty/contingency | Risk assessment revisado |
| `correction` | Error de datos/cálculo | Source mapping o formula correction |
| `decision_option` | Alternative/scenario | Option A vs B |
| `periodic_refresh` | Update planificado | Estimate refresh cycle |

Una versión puede tener varias categorías, pero requiere primary reason.

## 6. Lifecycle de Estimate Version

`draft → prepared → submitted → reviewed → approved_for_budget_proposal → superseded → archived`

Rutas alternativas:

- `draft|prepared|submitted → withdrawn`;
- `submitted|reviewed → rejected`;
- `reviewed → prepared` por rework;
- `approved_for_budget_proposal → superseded` cuando successor equivalente se publica;
- scenario: `draft → reviewed → accepted_scenario|rejected_scenario`, sin volverse official automáticamente.

`approved_for_budget_proposal` no significa Original Budget aprobado.

## 7. Inmutabilidad y content integrity

Después de `submitted` se congela el candidate snapshot usado en la revisión. Rework crea una nueva revision/draft child o una explícita review iteration conservada; nunca cambia silenciosamente el objeto revisado.

Después de approval/publication:

- lines, BOE, sources y determination no se editan;
- correction crea successor version con category `correction`;
- source document correction conserva refs old/new;
- totals pueden recalcularse solo para verificar el snapshot, no para escribir nuevos resultados;
- checksum/content fingerprint permite demostrar integridad;
- soft delete no elimina una versión referenciada por decision/budget/baseline.

## 8. Contrato de comparación

### 8.1 Preconditions

- from/to versions existen y son accesibles;
- scope/purpose comparability se evalúa;
- currencies/price dates/FX sets están identificados;
- CBS/WBS mappings y formula versions están disponibles;
- trust/completeness states se incluyen.

### 8.2 Ejes de comparación

| Eje | Resultado requerido |
|---|---|
| Scope | Added/removed/changed inclusions, exclusions, interfaces y WBS/CBS scope |
| Quantities | Quantity deltas por stable line/CBS/control account |
| Rates/prices | Rate/source/base-date deltas |
| Methods | Method/factor/formula changes |
| Sources/evidence | New/removed/superseded/stale evidence |
| Assumptions | Added/closed/changed assumptions y materiality |
| Maturity/class | Deliverable assessment y classification changes |
| Risks | Added/closed/reassessed risks e uncertainty |
| Allowance/contingency | Treatment, amount y method changes |
| Currency/FX | Original/converted movement y FX variance |
| Schedule/escalation | Timing/index changes |
| Tax/indirects/overhead | Policy/component changes |
| Approval | Reviewer/approver/policy/conditions changes |

### 8.3 Amount bridge

La comparación produce un bridge configurable cuyos buckets son mutuamente exclusivos para la policy/version utilizada:

1. starting estimate;
2. scope additions/removals;
3. quantity development;
4. rate/market movement;
5. productivity/method change;
6. schedule/escalation;
7. currency/FX;
8. risk/contingency/allowance movement;
9. correction/mapping;
10. residual/unexplained difference;
11. ending estimate.

El bridge reconcilia starting + deltas = ending dentro de rounding tolerance. `unexplained` nunca se reparte silenciosamente.

## 9. Stable line lineage

Cada line comparison usa:

- stable lineage ID cuando la semantic identity permanece;
- version line ID único;
- CBS/control/WBS scope;
- source/quantity/rate/method identity;
- change action: unchanged, added, removed, split, merged o modified;
- parent/child lineage refs para split/merge;
- allocation/reconciliation basis.

Name/text similarity puede sugerir mapping, pero no lo aprueba. AI matching conserva confidence y requiere human validation para líneas materiales.

## 10. Supersession rules

Una Estimate Version puede supersede otra solo cuando:

1. pertenece a la misma official series o existe mapping aprobado;
2. su lifecycle alcanza approval/publication requerido;
3. purpose/scope/effective date están definidos;
4. comparison bridge y critical changes fueron revisados;
5. classification fue reevaluada;
6. approver tiene authority y no viola SoD;
7. supersede/activate ocurre atómicamente;
8. prior version conserva status `superseded`, effective window y successor link.

No supersede automáticamente:

- working draft;
- scenario/alternative;
- import candidate;
- reclassification sin new estimate snapshot;
- version de otro purpose/scope;
- version con unresolved material exceptions no aceptadas.

## 11. Concurrency e idempotencia

- Cada command declara expected latest official version.
- Concurrent publication requests compiten; solo una puede activar/supersede.
- Retry con mismo command/fingerprint retorna el resultado previo.
- Same key con different logical payload produce conflict.
- Scenario branches pueden coexistir, pero official promotion exige merge/rebase review contra latest official.
- Stale candidate se reevalúa; no sobrescribe la serie.

## 12. Relationship con Original Budget/Baseline

- Estimate Version aprobada puede originar un Budget Proposal.
- Budget Proposal conserva exact Estimate/BOE/classification refs.
- Activar Original Budget crea un snapshot financiero distinto; no convierte la Estimate Version en editable budget.
- Estimate revisions posteriores no cambian Original Budget ni Current Baseline.
- Un re-estimate puede apoyar change/forecast/rebaseline, pero solo approved + posted change afecta Current Baseline.
- Comparison estimate-to-baseline declara que son object types distintos y usa mapping/policy explícitos.

## 13. Compatibility con rutas existentes

| Ruta actual | Tratamiento futuro |
|---|---|
| Budget UI / `material_requirements` edits | Candidate working estimate inputs; official version se captura como snapshot |
| Drawing extraction updates | New evidence/quantity candidates; no overwrite de approved version |
| Cost library updates | No reprice histórico; nueva version/refresh explícito |
| Import Intelligence | Candidate series/version con source lineage y review state |
| `budget_items.estimated_cost` | Legacy compatibility line; no official estimate version sin BOE/evidence |
| Templates | Initial candidates/placeholders, siempre unapproved |

## 14. Audit y eventos conceptuales

- `estimate_version_created`;
- `estimate_version_submitted`;
- `estimate_version_reviewed`;
- `estimate_version_approved_for_budget_proposal`;
- `estimate_version_rejected` / `withdrawn`;
- `estimate_version_superseded`;
- `estimate_comparison_completed`;
- `estimate_lineage_mapping_approved`.

Events se registrarán en `project_event_log`; owner snapshots no se reemplazan por event payloads.

## 15. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Approved estimate intenta editar quantity | Deny; crear successor version |
| 2 | Cost library rate cambia | Histórico intacto; periodic refresh/new version |
| 3 | Line se divide en dos CBS codes | Split lineage; bridge reconcilia amount |
| 4 | Comparison mezcla currencies sin FX basis | Incomplete/deny comparable total |
| 5 | Scope cambia materialmente | Bridge scope delta o new series si no comparable |
| 6 | Scenario supera official estimate | No supersede hasta promotion approval |
| 7 | Concurrent official publications | Expected-version conflict; una sola vigente |
| 8 | New version copia prior classification | Reevaluar evidence; no herencia silenciosa |
| 9 | Prior estimate desaparece tras supersession | Deny; conservar history y successor link |
| 10 | AI propone line matching con baja confidence | Human review; no approved lineage |
| 11 | Estimate revision pretende cambiar baseline | Deny; change/rebaseline lifecycle separado |
| 12 | Bridge tiene residual material | Mostrar `unexplained`; bloquear approval según policy |

## 16. Decisiones P2-T4

| ID | Decisión | Estado |
|---|---|---|
| P2-T4-D1 | Estimate/BOE versions oficiales son snapshots inmutables. | Aprobada |
| P2-T4-D2 | Cada revision conserva parent, reason, source/evidence y lineage. | Aprobada |
| P2-T4-D3 | Comparison cubre scope, quantities, rates, methods, evidence, maturity, risk, currency y approvals. | Aprobada |
| P2-T4-D4 | Amount bridge usa buckets mutuamente exclusivos y residual visible. | Aprobada |
| P2-T4-D5 | Stable line lineage soporta add/remove/split/merge sin name matching autoritativo. | Aprobada |
| P2-T4-D6 | Scenarios/alternatives no supersede official versions automáticamente. | Aprobada |
| P2-T4-D7 | Supersession es atómico, authority-controlled y preserva prior version. | Aprobada |
| P2-T4-D8 | Classification se reevalúa por Estimate Version. | Aprobada |
| P2-T4-D9 | Estimate revisions no alteran Original Budget/Baseline. | Aprobada |
| P2-T4-D10 | Existing estimate routes generan candidates/snapshots, no overwrites históricos. | Aprobada |

## 17. Matriz de aceptación P2-T4

| Criterio | Resultado | Evidencia |
|---|---|---|
| Immutable estimate-version lifecycle definido | PASS | Secciones 6–7 |
| Prior estimates permanecen trazables | PASS | Secciones 2 y 10 |
| Changed assumptions/scope/quantities/rates se identifican | PASS | Secciones 5 y 8 |
| Risks, methods, sources y approvals se comparan | PASS | Sección 8 |
| Supersession preserva history | PASS | Sección 10 |
| Concurrency/idempotency están definidas | PASS | Sección 11 |
| Existing routes evolucionan aditivamente | PASS | Sección 13 |
| Criterio original de aceptación | **PASS** | Prior versions trazables y revisions explican todos los cambios materiales |

## Nota de cierre lista para ProjectOps360°

P2-T4 completada y validada. Se definió una Estimate Series con Estimate Version, BOE Version, line lineage, Classification Determination, Comparison y Supersession Links inmutables. Toda revisión declara parent, purpose, reason, source/evidence y branch; scenarios/alternatives permanecen separados de la official series. La comparación cubre scope, quantities, rates, methods, sources, assumptions, maturity/class, risks, contingency, currency/FX, schedule/escalation y approvals, y produce un amount bridge con buckets mutuamente exclusivos y residual visible. Stable line lineage soporta added/removed/split/merged sin usar nombres como authority. Supersession requiere approved successor, reclassification, comparison review, authority, expected-state e idempotencia; la prior version permanece histórica. Estimate revisions nunca alteran Original Budget o Current Baseline. Materials, drawings, cost library, imports y templates generan candidates/snapshots, no overwrites aprobados. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P2-T4_Estimate_Versioning_Comparison_Supersession_Rules.md`.
