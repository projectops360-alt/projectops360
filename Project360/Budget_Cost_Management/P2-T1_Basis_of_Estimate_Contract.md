# P2-T1 — Contrato de Basis of Estimate

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P2 — Estimating, classification and baseline architecture |
| Tarea | P2-T1 — Define Basis of Estimate contract |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P1-T7 / G1-D1 |
| Owner | Cost Engineering Lead |
| Accountable | PMO / Project Controls Lead |
| Consultados | Estimator; Finance; Product Architecture |
| Entregable | Basis of Estimate schema and required evidence |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P2** |
| Efecto | Define el expediente de estimación; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de contrato

Cada versión de estimate deberá estar acompañada por un **Basis of Estimate (BOE) versionado, trazable y revisable**. El BOE explica qué se estimó, para qué decisión, con qué alcance, evidencia, métodos, fuentes, madurez, riesgos, contingency, moneda, fechas y autoridades.

El BOE no es un documento decorativo ni una nota libre. Es el contrato que permite interpretar y comparar una versión de estimate. Aprobar un BOE/estimate como apto para propuesta presupuestaria no crea Funding, Original Budget ni Current Baseline; esas promociones pertenecen a lifecycles posteriores.

## 2. Identidad y cardinalidad

| Objeto | Regla |
|---|---|
| Estimate Series | Identidad estable del estimate a través de revisiones para un purpose/scope definido |
| Estimate Version | Snapshot inmutable de líneas, cantidades, rates, métodos, risks y totals |
| BOE Version | Snapshot explicativo asociado exactamente a una Estimate Version |
| Classification Determination | Resultado versionado de un scheme/adapter sobre esa Estimate Version |
| Evidence Item | Referencia immutable/versioned a documento, source record o decisión |

Una Estimate Version tiene exactamente un BOE Version oficial. Puede conservar anexos y revisiones de trabajo, pero la versión sometida/aprobada congela el BOE usado. Copiar un BOE para otra revisión crea una nueva versión con lineage; no comparte contenido mutable.

## 3. Contrato canónico del BOE

### 3.1 Identidad, propósito y decisión

| Campo lógico | Requisito |
|---|---|
| BOE/Estimate IDs y versions | Obligatorios; IDs estables y version IDs inmutables |
| Organization / project / portfolio scope | Obligatorios; tenant/project isolation |
| Estimate title y description | Obligatorios |
| Purpose / end use | Obligatorio: screening, feasibility, funding request, budget proposal, control, bid/tender, change, forecast input u otro valor gobernado |
| Decision/gate supported | Obligatorio cuando existe gate |
| Prepared-for / intended audience | Obligatorio |
| Estimate base date y `as_of` | Obligatorios y distintos de created/recorded timestamps |
| Framework/project type | Obligatorio para seleccionar classification adapter |

### 3.2 Alcance y límites

El BOE debe identificar:

- scope statement y revision/source;
- CBS scheme/version y control-account grain;
- WBS/project/phase/milestone/task references aplicables;
- inclusions y exclusions explícitos;
- battery limits, interfaces y owner boundaries cuando apliquen;
- deliverables/products incluidos;
- quantities/measurement basis y unit-of-measure policy;
- owner-furnished, contractor-furnished y third-party scope;
- indirects, overhead, taxes, duties, freight, escalation y contingency treatment;
- scope gaps, undefined elements y provisional allowances.

Un silencio no equivale a exclusión. Los elementos materiales deben clasificarse como `included`, `excluded`, `allowance`, `owner_cost`, `third_party`, `unknown` o `not_applicable`, con reason/evidence.

### 3.3 Supuestos, restricciones y exclusiones

Cada registro declara:

- canonical ID y category;
- statement preciso;
- affected CBS/WBS scope;
- source/owner;
- effective window;
- materiality/impact direction;
- validation status;
- linked risk/change/decision;
- disposition en la siguiente versión.

Los assumptions no reemplazan evidencia faltante. Un assumption crítico no validado reduce readiness/confidence y debe aparecer en el comparison bridge.

### 3.4 Métodos y cálculo

Por cada cost group/control account material se registra:

| Campo | Ejemplos no exhaustivos |
|---|---|
| Estimating method | Parametric, analogous, factored, unit-rate, assembly, detailed takeoff, vendor quote, expert judgement |
| Quantity source | Drawing/model, material requirement, WBS package, historical record, manual takeoff |
| Rate source | Cost library, contract, quote, benchmark, labor agreement, cloud price, internal standard |
| Adjustments | Location, productivity, complexity, size, market, logistics, taxes, escalation |
| Calculation version | Formula/method policy ID/version |
| Estimator/reviewer | Actor y role efectivos |

El BOE declara qué líneas usan cada método; no permite una etiqueta global que oculte métodos mixtos.

### 3.5 Fuentes y evidencia

Cada source/evidence item conserva:

- source system/document type/record ID/version;
- organization/project scope;
- title/description y issuer/owner;
- document/effective/base date;
- checksum o immutable version reference cuando exista;
- received/ingested/validated timestamps;
- applicability scope;
- freshness y quality state;
- reviewer/validation result;
- access classification y evidence link.

Evidence faltante permanece `missing` o `assumption`, nunca se reemplaza por una cita inventada.

### 3.6 Maturity y classification

El BOE referencia, sin hardcodear una industria:

- classification scheme ID/version;
- adapter ID/version y applicability result;
- class ID/label dentro del scheme;
- maturity checklist version;
- deliverable evidence/results;
- determination method y basis;
- determiner/reviewer/approval actors;
- exceptions, overrides y rationale;
- confidence/readiness state;
- accuracy statement solo cuando la policy lo permite, con basis y disclaimer.

La clase nunca se deduce de `percent_design_complete` como único criterio.

### 3.7 Moneda, fechas y períodos

El BOE debe declarar:

- estimate/base/project/reporting currencies;
- FX set, source, type, date y version;
- price base date;
- escalation basis, indices/scenario y cut-off dates;
- fiscal/control period y forecast horizon cuando apliquen;
- rounding/precision policy;
- taxes/duties treatment;
- currency, market y escalation exposures.

El importe original y los valores convertidos permanecen separados conforme a P1-T4.

### 3.8 Riesgo, incertidumbre y contingency

El BOE diferencia:

| Elemento | Contrato |
|---|---|
| Known scope cost | Base estimate para alcance definido |
| Allowance | Importe explícito para elemento conocido no suficientemente definido |
| Estimate uncertainty | Variabilidad del método/datos, descrita y evaluada |
| Project risk | Riesgo identificado ligado al owner `risks` |
| Contingency | Provisión derivada según policy/risk analysis, separada del base estimate |
| Management Reserve | Fuera del estimate salvo presentación ejecutiva separada; authority Sponsor |

Se registran risk snapshot, method, confidence target si aplica, inclusions/exclusions, correlation assumptions, reviewer y source. Una accuracy range típica de un estándar no sustituye el análisis de riesgo del proyecto.

### 3.9 Schedule, procurement y market basis

El BOE identifica:

- schedule/milestone version y estimate cut-off;
- execution strategy y delivery method;
- procurement/contracting strategy;
- labor calendars/productivity basis;
- vendor quote validity y commercial qualifications;
- market/location/logistics conditions;
- long-lead items y supply assumptions;
- escalation treatment y cash/commitment timing assumptions cuando impacten el estimate.

El schedule es input/evidence; el BOE no crea un segundo Gantt.

### 3.10 Ownership, review y approval

| Función | Evidencia mínima |
|---|---|
| Preparer/Estimator | Actor, role, organization, timestamp |
| Technical reviewers | Scope/method disciplines revisadas y findings |
| Cost Engineering reviewer | Completeness, methods, sources y classification review |
| Finance reviewer | Currency, FX, taxes, escalation/accounting interfaces cuando aplique |
| PMO approver | Approval decision, policy/version y conditions |
| Independent reviewer | Requerido por threshold/class/policy |
| Poster/Publisher | Principal separado cuando se publique una versión oficial |

Technical admin, import service o Isabella no pueden figurar como business approver.

## 4. Estructura de costos declarada

El BOE presenta un reconciliation tree explícito, configurable por framework/policy:

1. direct cost components;
2. indirect cost components;
3. allowances;
4. escalation;
5. contingency;
6. taxes/duties/fees;
7. exclusions y owner/third-party costs separados;
8. estimate total por la definición aprobada.

No se fija una fórmula universal de suma: cada component declara `included_in_total`, treatment, currency y policy version. Management Reserve, Funding y Cash Flow no se mezclan en el estimate total.

## 5. Estados de completitud y confianza

| Estado | Significado |
|---|---|
| `draft_incomplete` | Expediente en preparación; faltan campos/evidencia |
| `complete_for_review` | Campos requeridos presentes; pendiente revisión |
| `reviewed_with_exceptions` | Revisado con gaps/material exceptions abiertas |
| `ready_for_approval` | Reglas de completeness y findings materiales resueltas/aceptadas |
| `approved_for_budget_proposal` | Aprobado como estimate/BOE, no como budget/funding |
| `rejected` | No apto; conserva reasons |
| `superseded` | Otra versión oficial lo reemplaza para ese purpose/scope |

La publicación devuelve completeness %, pero ese porcentaje es informativo y no determina por sí solo estimate class ni approval.

## 6. Validaciones obligatorias

1. Organization/project de todas las refs coincide con el BOE.
2. Estimate Version y BOE Version forman un par inmutable.
3. Purpose, scope, inclusions, exclusions, methods, sources y base date existen.
4. CBS/WBS/control mappings cuadran o declaran exceptions.
5. Totals reconcilian con líneas/componentes y rounding policy.
6. Currency/FX/base-date data permite reproducir conversions.
7. Classification usa scheme/adapter aplicable y evidence.
8. Risks, contingency y allowances no se duplican.
9. Sources materiales tienen version/date/freshness.
10. Approval actors cumplen authority/SoD.
11. Required conditions se derivan de policy/framework versionados.
12. Missing critical evidence bloquea approval o produce exception explícita.

## 7. Compatibilidad con capacidades actuales

| Capacidad actual | Uso dentro del BOE target |
|---|---|
| `material_requirements` | Quantity/material evidence y estimate input |
| `cost_library_items` | Rate/reference source con fecha/version/provenance |
| Drawing Intelligence | Evidence de scope/quantity; confidence y review state se preservan |
| Project Import Intelligence | Crea candidates/hints; no aprueba BOE ni classification |
| `budget_items.estimated_cost` | Legacy estimate line/compatibility projection hasta clasificación |
| Milestones/tasks | Scope/schedule refs del Core |
| Risks/decisions/documents | Existing owners enlazados por canonical refs |
| Project Memory/Isabella | Explican evidence/assumptions; no son estimator/approver owner |

La pantalla Budget actual continúa como Estimate/Material Takeoff durante la transición.

## 8. Eventos conceptuales requeridos

- `estimate_prepared` / `estimate_submitted`;
- `estimate_reviewed`;
- `estimate_approved_for_budget_proposal`;
- `estimate_rejected` / `estimate_withdrawn`;
- `estimate_superseded`;
- `boe_exception_opened` / `boe_exception_resolved` como vocabulario a registrar en P3 si se aprueba.

Los eventos se incorporarán al registry existente y `project_event_log`, nunca a un ledger BOE paralelo.

## 9. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Estimate tiene total pero carece de scope/exclusions | `draft_incomplete`; no aprobación |
| 2 | Material takeoff importado se llama “budget” | Tratar como estimate candidate; no Original Budget |
| 3 | Dos cost groups usan métodos distintos | Registrar method/source por group/line |
| 4 | Assumption crítico cambia | Nueva Estimate/BOE Version y comparison bridge |
| 5 | Contingency duplica allowance/risk | Deny total hasta reconciliar treatment |
| 6 | FX source/date faltan en estimate multi-currency | `incomplete`; no conversion certificada |
| 7 | AACE adapter no aplica al project type | `not_applicable`; seleccionar otro scheme/adapter |
| 8 | Accuracy range se copia como garantía | Deny approval; exigir project-specific risk basis/disclaimer |
| 9 | Service account figura como approver | Deny por authority/SoD |
| 10 | Evidence link pertenece a otro proyecto | Deny por isolation |
| 11 | Estimate aprobado se edita | Deny; crear nueva version |
| 12 | BOE aprobado se usa para funding automático | Deny; funding lifecycle separado |

## 10. Decisiones P2-T1

| ID | Decisión | Estado |
|---|---|---|
| P2-T1-D1 | Cada Estimate Version oficial tiene un BOE Version inmutable. | Aprobada |
| P2-T1-D2 | BOE identifica purpose, scope, exclusions, assumptions, methods, sources y evidence. | Aprobada |
| P2-T1-D3 | Maturity/classification se referencia mediante scheme/adapter versionados. | Aprobada |
| P2-T1-D4 | Currency, base date, FX, escalation y periods son obligatorios según applicability. | Aprobada |
| P2-T1-D5 | Risk, uncertainty, allowances, contingency y Management Reserve se separan. | Aprobada |
| P2-T1-D6 | Estimate total declara components/treatment; no existe fórmula universal oculta. | Aprobada |
| P2-T1-D7 | Approval de BOE no crea Funding, Original Budget ni Baseline. | Aprobada |
| P2-T1-D8 | Existing materials, cost library, drawings/imports y Core scope se reutilizan. | Aprobada |
| P2-T1-D9 | Missing evidence permanece visible y puede bloquear approval. | Aprobada |
| P2-T1-D10 | BOE events usarán el Canonical Event Ledger existente. | Aprobada |

## 11. Matriz de aceptación P2-T1

| Criterio | Resultado | Evidencia |
|---|---|---|
| Purpose/end use y decision están definidos | PASS | Sección 3.1 |
| Scope, exclusions y assumptions están definidos | PASS | Secciones 3.2–3.3 |
| Methods, sources y evidence están definidos | PASS | Secciones 3.4–3.5 |
| Maturity/classification está definida | PASS | Sección 3.6 |
| Risk/contingency y currency/time están definidos | PASS | Secciones 3.7–3.8 |
| Approvers/reviewers y SoD están definidos | PASS | Sección 3.10 |
| Existing estimate path se preserva | PASS | Sección 7 |
| Criterio original de aceptación | **PASS** | Cada versión identifica purpose, scope, exclusions, assumptions, methods, sources, maturity, risks, contingency, currency y approvers |

## Nota de cierre lista para ProjectOps360°

P2-T1 completada y validada. Se definió un contrato BOE versionado y obligatorio para cada Estimate Version oficial. El expediente identifica purpose/end use, decision gate, scope y límites, CBS/WBS/control accounts, inclusions, exclusions, assumptions, methods por cost group, quantity/rate sources, evidence versionada, maturity/classification scheme, currencies, FX, base date, escalation, periods, schedule/procurement basis, risks, uncertainty, allowances, contingency y approvers. Risk, contingency, Management Reserve, Funding y Cash Flow permanecen separados. Missing evidence conserva un estado explícito y puede bloquear aprobación. BOE/estimate aprobado solo queda apto para una propuesta presupuestaria; no crea Funding, Original Budget ni Current Baseline. `material_requirements`, cost library, Drawing Intelligence, imports y scope Core se reutilizan como inputs sin reemplazarlos. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P2-T1_Basis_of_Estimate_Contract.md`.
