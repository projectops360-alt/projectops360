# P2-T3 — Adaptador de madurez AACE 18R-97 para Process Industries

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P2 — Estimating, classification and baseline architecture |
| Tarea | P2-T3 — Define AACE 18R-97 process-industries maturity adapter |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P2-T2 |
| Owner | Cost Engineering Lead |
| Accountable | PMO / Project Controls Lead |
| Consultados | Oil & Gas Framework Owner; Industrial Framework Owner; Product Architecture |
| Entregable | Deliverable-maturity checklist for process-industry estimates |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P2 / REQUERIDO PARA G2** |
| Efecto | Define un adapter; no reproduce la matriz licenciada completa ni autoriza implementación |

## 1. Decisión del adapter

Se aprueba un adapter específico para **Engineering, Procurement and Construction de Process Industries** basado en los principios de AACE International Recommended Practice 18R-97, revisión identificada por la fuente como 7 de agosto de 2020.

El adapter:

- se activa solo cuando el project/framework context cumple applicability;
- determina la clase principalmente desde la madurez y calidad de deliverables de definición;
- considera percent design únicamente como indicador secundario;
- no presenta accuracy ranges como garantía;
- no aplica automáticamente a software, building construction, transportation, mining extraction, upstream production o project types fuera del alcance aprobado;
- registra la revisión exacta del source/scheme y requiere revalidación si cambia.

## 2. Fuente y límites de uso

| Campo | Valor |
|---|---|
| Scheme ID | `aace-18r97-process-industries` |
| Source | AACE International RP 18R-97, *Cost Estimate Classification System — As Applied in EPC for the Process Industries* |
| Source URL | https://web.aacei.org/docs/default-source/toc/toc_18r-97.pdf |
| Revision observada | 2020-08-07 |
| Scheme classes | Class 5, 4, 3, 2 y 1 |
| Primary principle | Madurez de project-definition deliverables |
| Secondary context | End use, estimating methodology y indicative accuracy context |
| License guardrail | Guardar referencias y configuración autorizada; no copiar/publicar contenido licenciado completo sin permiso |

La muestra oficial describe la práctica como guía, no estándar universal, y señala que la clasificación depende de deliverables de definición. La configuración productiva deberá ser revisada por Cost Engineering contra la copia autorizada vigente de la organización.

## 3. Applicability gate

### 3.1 Contextos permitidos

El adapter puede activarse cuando el alcance corresponde materialmente a EPC de instalaciones de proceso, por ejemplo:

- chemical/petrochemical/hydrocarbon processing facilities;
- pharmaceutical, utility, water treatment, metallurgical o converting facilities cuando su scope definitorio sea equivalente y el framework owner lo apruebe;
- electrical substations directamente asociadas al process facility dentro del alcance permitido;
- brownfield/greenfield process-facility modifications con deliverables técnicos comparables.

### 3.2 Contextos no automáticos

- software development;
- commercial/residential building construction;
- transportation infrastructure;
- power generation/high-voltage transmission como scope principal;
- mining/hydrocarbon exploration, extraction o transportation como scope principal;
- R&D/product manufacturing cost fuera del EPC facility scope;
- long-term asset planning sin el adapter/policy específico.

Un proyecto híbrido aplica el adapter solo al work package/process-facility scope explícitamente delimitado. El resto usa otro adapter o queda `no_adapter`.

### 3.3 Evidencia de applicability

- industry framework ID/version;
- facility/process description;
- delivery scope y contract strategy;
- defining-document taxonomy utilizada;
- approved applicability decision, actor y rationale;
- included/excluded WBS/CBS scope;
- source/scheme revision.

## 4. Clases y uso dentro del adapter

| Class | Maturity context | Typical decision context | Guardrail |
|---|---|---|---|
| Class 5 | Scope definition muy temprana | Concept screening / option framing | No inferir precisión ni funding readiness |
| Class 4 | Definición conceptual/feasibility en desarrollo | Study / feasibility | Critical process inputs pueden seguir preliminares |
| Class 3 | Definición suficiente para una decisión de budget/control según evidencia | Budget authorization/control context | No crea Original Budget ni Funding automáticamente |
| Class 2 | Definición desarrollada para control/bid/tender | Control o procurement decision | Requiere evidencia más detallada y consistente |
| Class 1 | Definición avanzada/detallada | Check estimate o bid/tender | No equivale a actual cost ni elimina uncertainty |

Los rangos porcentuales de definición publicados por AACE se conservan como metadata indicativa del scheme, nunca como algoritmo principal. La clase se determina por deliverables y su madurez/calidad.

## 5. Checklist de deliverables de Process Industries

Este checklist es un contrato de evaluación original de ProjectOps360° alineado con los principios de 18R-97. La implementación deberá mapearlo a la matriz autorizada vigente sin sustituirla ni reproducir contenido licenciado no autorizado.

### 5.1 Business, project y scope definition

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Business objective / facility purpose | Decision charter, capacity/product objectives, constraints | Alta |
| Project scope statement | Included units/areas, battery limits, interfaces, exclusions | Crítica |
| Design basis / codes and standards | Applicable codes, owner standards, design criteria | Alta |
| Site and existing-facility basis | Site data, brownfield interfaces, surveys/constraints | Alta según scope |
| Execution/delivery strategy | Contracting, modularization, construction approach, work packaging | Media/alta |

### 5.2 Process and technology definition

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Process design basis | Feed/product properties, capacity, operating cases | Crítica |
| Process flow representation | Process flow diagrams y stream/material/energy basis | Crítica |
| Process equipment definition | Equipment list, duty/capacity, preliminary specifications | Crítica |
| Utility/offsite requirements | Utility balances, storage, loading, waste/emissions interfaces | Alta |
| Safety/environmental basis | Hazard/environmental requirements y design implications | Alta |

### 5.3 Mechanical, piping and layout definition

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Piping/instrumentation definition | P&ID maturity, line/system definition, key controls | Crítica |
| Equipment layout / plot plan | Locations, spacing, access, maintenance and constructability | Alta |
| Mechanical equipment specifications | Datasheets/specifications y vendor input | Alta |
| Piping basis | Classes/specifications, quantities/takeoff basis, major routing | Alta |
| Materials of construction | Service/material selection y special requirements | Alta |

### 5.4 Civil, structural, architectural and site

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Geotechnical/site data | Surveys, geotechnical assumptions/results, grading/drainage | Alta según scope |
| Civil quantities/basis | Earthwork, roads, undergrounds, foundations | Alta |
| Structural basis | Loads, structural systems, major steel/concrete quantities | Alta |
| Buildings/architectural scope | Building list, area, occupancy and finish basis | Condicional |

### 5.5 Electrical, instrumentation, controls and telecom

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Electrical load/power basis | Load list, one-lines, supply/distribution philosophy | Crítica para scope eléctrico |
| Electrical equipment definition | Major equipment, substations, MCC/switchgear basis | Alta |
| Instrument index/control basis | Instrument population, control architecture, SIS/DCS scope | Alta |
| Telecom/security systems | System list, architecture and interfaces | Condicional |

### 5.6 Procurement, vendor and market definition

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Procurement plan | Packages, bidder strategy, owner/contractor supply split | Alta |
| Vendor budget data | Budget quotes, validity, exclusions, commercial basis | Alta para major equipment |
| Long-lead strategy | Lead times, market constraints, logistics | Alta |
| Bulk material pricing basis | Quotes, indices, reference dates, location factors | Alta |
| Labor/contractor market basis | Labor rates, productivity, availability, indirects | Alta |

### 5.7 Schedule, construction and commissioning definition

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| Master schedule basis | Milestones, durations, calendars, shutdown/tie-in windows | Alta |
| Construction execution plan | Sequencing, access, temporary facilities, work hours | Alta |
| Constructability/modularization | Reviews, module strategy, heavy lifts/logistics | Condicional/alta |
| Commissioning/start-up scope | Systems, sequence, spares, training and support | Alta |

### 5.8 Estimate preparation and risk basis

| Deliverable/evidence family | Evidencia representativa | Criticidad |
|---|---|---|
| CBS/WBS/control-account structure | Scope/cost mapping y reconciliation | Crítica |
| Quantity and rate basis | Takeoffs, factors, databases, quotes, productivity | Crítica |
| Indirects/escalation/tax basis | Methods, indices, dates, geography, currency | Alta |
| BOE completeness | Assumptions, exclusions, methods, sources, reviewers | Crítica |
| Risk/uncertainty assessment | Risk snapshot, uncertainty basis, contingency method | Crítica |
| Reconciliation/benchmarking | Prior versions, comparable projects, validation checks | Alta |

## 6. Assessment states y evidencia

Cada checklist item usa maturity state y quality state separados.

### 6.1 Maturity state

`not_applicable`, `missing`, `identified`, `conceptual`, `developing`, `defined`, `issued_for_estimate`, `validated`.

### 6.2 Quality state

`unknown`, `unreviewed`, `accepted_with_gaps`, `consistent`, `conflicted`, `stale`, `validated`.

### 6.3 Evidence record

- deliverable family/item ID y adapter version;
- source document/entity ID/version/date;
- scope applicability;
- maturity y quality states;
- reviewer y review date;
- critical gaps/exceptions;
- linked assumptions/risks;
- evidence checksum/ref;
- rationale y confidence.

## 7. Determination rules

1. Confirmar applicability antes de evaluar.
2. Evaluar todos los critical deliverables aplicables.
3. Aplicar floor rules: un critical gap puede limitar la candidate class aunque el promedio sea alto.
4. Usar maturity distribution, quality, consistency y scope coverage; no solo porcentaje.
5. Separar `missing evidence` de `legitimately early maturity`.
6. Producir candidate class, limiting deliverables y basis reproducible.
7. Requerir Cost Engineering review y PMO approval.
8. Permitir override solo con rationale, risk y authority.
9. Conservar indicative percentage/end-use/method data como contexto secundario.
10. Publicar un determination inmutable asociado a Estimate/BOE Version.

No se define un promedio universal en P2. La exacta decision table/weighting deberá configurarse desde la matriz autorizada vigente y validarse con SMEs antes de implementación.

## 8. Accuracy y riesgo

- Typical ranges del source son referencias estadísticas/contextuales, no garantías.
- La clase no determina por sí sola una accuracy range para un proyecto.
- Technology familiarity, location, complexity, reference data, assumptions, estimator capability, market, currency y project/systemic risks modifican la incertidumbre.
- Cualquier range comunicado requiere project-specific risk basis, contingency treatment, confidence convention y approval.
- Clases/ranges pueden solaparse; una clase más madura no garantiza un resultado particular.
- Isabella puede explicar estos límites, pero no calcular ni prometer accuracy sin policy/datos aprobados.

## 9. Output del adapter

| Campo | Contenido |
|---|---|
| Applicability | applicable/not_applicable/conflicted + basis |
| Scheme/adapter | IDs y versions |
| Candidate/final class | Scheme-qualified ID/label |
| Determination state | provisional/determined/overridden/insufficient_evidence |
| Evidence coverage | Overall y por dimension; unmapped/missing counts |
| Limiting deliverables | Critical items que limitan class/readiness |
| Quality/conflicts | Stale, inconsistent o unreviewed evidence |
| Basis | Rules, reviewers, timestamps y rationale |
| Accuracy statement | Optional, governed y con disclaimer |
| Source | AACE reference/revision y organization policy |

## 10. Integración con ProjectOps360° Core

- Project type/framework selection activa applicability, no una lista hardcoded en UI.
- Drawings/BIM pueden aportar PFD/P&ID/layout/electrical evidence mediante refs.
- `material_requirements` aporta quantity/material evidence, no class por row count.
- Documents/Project Memory preservan deliverable versions y review evidence.
- WBS/CBS/control accounts delimitan scope coverage.
- Risks/decisions aportan uncertainty y approvals mediante existing owners.
- Living Graph proyecta `estimate_supported_by` y limiting relationships; no determina class.
- Process Mining consume classification lifecycle events del ledger único.
- Isabella explica basis/gaps y recomienda remediación, sin aprobar.

## 11. Eventos conceptuales

- `classification_applicability_determined`;
- `maturity_assessment_completed`;
- `estimate_classification_proposed`;
- `estimate_classification_determined`;
- `estimate_classification_overridden`;
- `estimate_classification_superseded`.

Estos tipos deberán registrarse en el Event Registry de P3 y escribirse en `project_event_log` mediante ingestion service.

## 12. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Software project solicita AACE class | `not_applicable`; no class |
| 2 | Process EPC tiene high nominal design % pero P&ID/process basis faltan | Critical floor limita candidate; mostrar gaps |
| 3 | Early project posee evidence coherente pero conceptual | Candidate class temprana con basis, no `missing` |
| 4 | Deliverables avanzados están stale/conflicted | Reducir readiness/confidence y bloquear final si material |
| 5 | Accuracy típica se comunica sin risk analysis | Deny publication |
| 6 | Hybrid project contiene process plant + software | Adapter solo al scope process delimitado |
| 7 | Checklist item no aplica | `not_applicable` con reason; no penalizar coverage |
| 8 | Reviewer overridea class | Conservar candidate, limiting evidence, reason y approval |
| 9 | Adapter source revision cambia | Nueva adapter version/determination; history intacta |
| 10 | Material row count se usa como maturity | Deny; evaluar deliverable evidence/quality |
| 11 | Isabella intenta aprobar class | Deny; advisor read-only |
| 12 | Licensed matrix se copia completa en output público | Deny; respetar source/license policy |

## 13. Decisiones P2-T3

| ID | Decisión | Estado |
|---|---|---|
| P2-T3-D1 | AACE 18R-97 se aprueba solo como adapter de Process Industries EPC. | Aprobada |
| P2-T3-D2 | Applicability se decide por project/framework/scope y evidencia explícita. | Aprobada |
| P2-T3-D3 | Class se determina principalmente por deliverable maturity y quality. | Aprobada |
| P2-T3-D4 | Nominal design percentage es secundario y nunca único determiner. | Aprobada |
| P2-T3-D5 | Accuracy ranges son contextuales y nunca garantías. | Aprobada |
| P2-T3-D6 | Checklist cubre scope, process, disciplines, procurement, schedule, execution, BOE y risk. | Aprobada |
| P2-T3-D7 | Critical deliverable floors prevalecen sobre promedios simples. | Aprobada |
| P2-T3-D8 | Exact rules/matrix requieren fuente autorizada, versionado y SME validation. | Aprobada |
| P2-T3-D9 | Adapter reutiliza Core documents/drawings/WBS/CBS/risks/events sin duplicarlos. | Aprobada |
| P2-T3-D10 | Source/license restrictions se preservan. | Aprobada |

## 14. Matriz de aceptación P2-T3

| Criterio | Resultado | Evidencia |
|---|---|---|
| Applicability y exclusiones están definidas | PASS | Sección 3 |
| Classes/end-use context están definidos | PASS | Sección 4 |
| Existe checklist de deliverable maturity | PASS | Sección 5 |
| Maturity y quality se separan | PASS | Sección 6 |
| Determination se basa en deliverables, no porcentaje | PASS | Sección 7 |
| Accuracy no se presenta como garantía | PASS | Sección 8 |
| Adapter se integra al Core sin duplicación | PASS | Sección 10 |
| Criterio original de aceptación | **PASS** | Class usa defining-deliverable maturity/quality; percentage no gobierna; accuracy no se garantiza |

## Nota de cierre lista para ProjectOps360°

P2-T3 completada y validada como dependencia obligatoria de G2. Se definió el adapter AACE 18R-97 exclusivamente para EPC de Process Industries, con applicability por framework, project type y scope. El adapter evalúa ocho familias de evidencia: business/scope, process/technology, mechanical-piping-layout, civil/structural/site, electrical/instrumentation, procurement/market, schedule/construction/commissioning y estimate/risk basis. Cada deliverable conserva maturity y quality states separados, source version, scope, reviewer, gaps y confidence. Critical deliverable floors limitan la candidate class; nominal design percentage es solo contexto secundario. Class 5–1 y end uses se interpretan dentro del scheme, pero no crean Funding, Original Budget ni approval. Accuracy ranges son referencias contextuales y nunca garantías; cualquier comunicación exige risk basis específico. La matriz exacta requiere fuente autorizada/versionada y validación SME, respetando licencia. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P2-T3_AACE_18R97_Process_Industries_Maturity_Adapter.md`.
