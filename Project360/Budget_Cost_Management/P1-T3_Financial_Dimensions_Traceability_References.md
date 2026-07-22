# P1-T3 — Dimensiones financieras y referencias de trazabilidad

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T3 — Define financial dimensions and traceability references |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P1-T2 |
| Owner | Data Architecture |
| Accountable | Product Architecture |
| Consultados | PMO; Finance; Procurement; Security |
| Entregable | Modelo dimensional para cost code, resource, supplier, contract, department, location, country, currency, risk, change y decision |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P1** |
| Efecto | Define contratos de drill-down/rollup e isolation; no autoriza materialización |

## 1. Decisión dimensional

Las dimensiones describen y conectan una verdad financiera; **no son la verdad financiera**. Todo resolver utilizará canonical IDs y referencias versionadas para soportar drill-down de proyecto y rollup de portafolio sin convertir metadata, nombres, Graph edges o report rows en owners.

El scope `organization_id + project_id` es obligatorio en todo hecho financiero de proyecto. Ninguna dimensión o mapping puede cruzar organizaciones por coincidencia de código, email, nombre o external ID.

## 2. Capas del modelo

| Capa | Contenido | Owner |
|---|---|---|
| Scope | Organization, portfolio/program, project | ProjectOps360° Core |
| Execution | Phase, milestone, task, subtask, deliverable | Core execution owners |
| Cost control | CBS scheme/node, cost code, control account | Canonical financial domain |
| Counterparty | Supplier, contract, PO, invoice/source document | Procurement/Finance owners |
| Responsibility | Resource, role, department/cost center | People/organization owners |
| Geography | Location/site, region, country | Organization/project master data |
| Value/time | Currency, FX policy, fiscal calendar, periods | Finance policy |
| Governance | Risk, change, reserve movement, decision, approval | Existing domain owners + financial links |
| Provenance | Source system, source record, import batch, evidence | Source/integration contract |

## 3. Catálogo de dimensiones

### 3.1 Dimensiones obligatorias de scope y control

| Dimensión | Canonical key | Cardinalidad por hecho | Regla |
|---|---|---|---|
| Organization | `organization_id` | 1 | Tenant boundary; nunca nullable |
| Project | `project_id` | 1 | Project boundary; todas las refs deben pertenecer al mismo scope |
| Portfolio/Program | canonical portfolio/program ID | 0..n por relación | Se deriva de membership versionada, no de texto |
| CBS Scheme/Version | scheme/version ID | 1 para posición reconciliada | Determina jerarquía de rollup |
| CBS Node / Cost Code | node/code ID | 1 posting principal | Código visible no reemplaza ID |
| Control Account | control account ID | 0..1 principal, n refs | Requerido según grain/policy |
| WBS Scope | Core entity type + ID | 0..n | Link tipado; allocation explícita si distribuye importe |

### 3.2 Dimensiones de responsabilidad y costo

| Dimensión | Uso | Reglas |
|---|---|---|
| Resource | Labor/equipment/service resource responsable o consumido | Reference al owner Core; snapshot de clasificación para historia |
| Role/Trade/Discipline | Agrupación operativa | Taxonomía versionada; no inferir desde título libre |
| Department / Cost Center | Responsabilidad organizacional | Effective-dated; no sustituye CBS |
| Cost Type / Category | Labor, material, equipment, subcontract, software, etc. | Vocabulario gobernado; legacy category requiere mapping |
| Unit of Measure | Cantidad y rate | Código normalizado, precision y conversion policy |

### 3.3 Dimensiones de contraparte y procurement

| Dimensión | Uso | Reglas |
|---|---|---|
| Supplier | Contraparte contractual | Canonical supplier ID + external/source identity |
| Contract | Autoridad contractual y cambios | ID estable, version/amendment refs y organization/project scope |
| PO / Commitment Line | Línea de obligación | Source line identity idempotente; no usar descripción como key |
| Invoice / Document | Evidencia de cobro/actual | Tipo, número, issuer, source system y document version |
| Procurement Item | Existing operational identity | Se preserva y se vincula; no crea un Procurement paralelo |

### 3.4 Dimensiones geográficas

| Dimensión | Uso | Reglas |
|---|---|---|
| Location / Site | Lugar físico/operativo del alcance o costo | Canonical location ID; soporta hierarchy si existe |
| Country | Jurisdicción, fiscalidad, reporting | ISO country code + effective policy; no inferir solo desde currency |
| Region | Rollup configurado por organización | Mapping versionado; no universal |

### 3.5 Dimensiones de valor y tiempo

| Dimensión | Uso | Reglas |
|---|---|---|
| Transaction Currency | Moneda original del hecho | ISO 4217 code; se preserva siempre |
| Project Currency | Base de control del proyecto | Policy versionada |
| Reporting Currency | Moneda del consumer/portfolio | Conversión derivada y trazable |
| FX Rate | Conversión | Source, type, quote, date, version y precision obligatorios |
| Fiscal Calendar / Period | Control y cierre | Calendar ID/version + period ID/state |
| Accounting / Forecast Period | Reconocimiento vs proyección | Nunca intercambiables sin mapping explícito |
| `as_of` | Corte de una posición/forecast | Obligatorio para snapshots comparables |

### 3.6 Dimensiones de riesgo, cambio y decisión

| Dimensión | Relación permitida | Regla |
|---|---|---|
| Risk | `exposed_by`, `mitigates`, `reserve_for` | Risk owner existente; financial domain solo conserva impacto/link |
| Change | `requested_by`, `affects`, `implements` | Pending no modifica baseline; posted link conserva effect version |
| Decision | `authorized_by`, `selected_by`, `explained_by` | Existing decision owner; evidencia y authority snapshot |
| Reserve Movement | `funds`, `returns`, `transfers` | Financial owner; link obligatorio a policy/risk/change cuando aplique |
| Approval | `approved_by` | Existing governance primitive evolucionada; no segunda matriz |

## 4. Contrato de referencia de trazabilidad

Toda referencia deberá poder representarse con:

| Campo | Propósito |
|---|---|
| `organization_id`, `project_id` | Isolation boundary |
| `source_object_type`, `source_object_id`, `source_version_id` | Objeto financiero que referencia |
| `target_domain`, `target_entity_type`, `target_entity_id` | Owner objetivo |
| `relationship_type` | Semántica del link |
| `effective_from`, `effective_to` | Vigencia |
| `allocation_basis`, `allocation_value` | Distribución opcional y explícita |
| `source_system`, `source_record_id` | Procedencia externa si aplica |
| `evidence_refs` | Documentos/eventos que justifican el link |
| `created_by`, `approved_by`, `recorded_at` | Actor y temporalidad |
| `mapping_state`, `confidence` | Calidad del enlace |

Un link puede proyectarse en `process_nodes/process_edges`, pero la proyección no es su owner y puede reconstruirse.

## 5. Reglas de identidad y Slowly Changing Dimensions

1. Canonical IDs son estables y opacos; display codes/names pueden cambiar.
2. Cambios de clasificación material crean una nueva versión/effective window.
3. Los hechos históricos conservan la dimensión efectiva al ocurrir/postearse y pueden resolverse también contra la jerarquía vigente mediante un bridge explícito.
4. External IDs son únicos solo dentro de `organization + source_system + entity_type`.
5. Soft delete o deactivation no elimina referencias históricas.
6. Merge de suppliers/resources conserva alias y lineage; no reescribe source evidence.
7. Cross-project shared master data requiere autorización organizacional y link por proyecto; no habilita lectura financiera cross-project.

## 6. Dimensiones mínimas por verdad

| Verdad/objeto | Dimensiones mínimas |
|---|---|
| Funding | organization, project/portfolio, funding source, currency, effective window, decision/approval |
| Original Budget | project, CBS, control account/WBS refs, cost category, currency, version, effective period |
| Current Baseline | las anteriores + change/reserve refs y active version |
| Commitment | CBS/control scope, supplier, contract/PO line, currency, dates, source identity |
| Actual Cost | CBS/control scope o exception, resource/cost type, source document, transaction currency, accounting period |
| Accrual | CBS/control scope, source evidence, accounting period, reversal/match refs |
| Forecast | CBS/control scope, forecast period, currency, method/assumptions, risk/change coverage |
| Cash Flow / Payment | counterparty/document, cash period/date, currency, funding/payment refs |

Cuando una dimensión obligatoria falta, el hecho se conserva pero su mapping/reconciliation state lo declara; no se inventa `other`, `general` o project default para lograr un PASS.

## 7. Drill-down y rollup

### 7.1 Drill-down

Todo total certificado debe permitir navegar:

`Portfolio → Project → Financial Truth/Version → CBS → Control Account → Financial Line/Transaction → Source Document/Event/Evidence`

Los enlaces WBS permiten continuar a milestone/task/subtask, risk, change, decision, supplier, contract y material. El usuario ve exactamente qué dimensión y policy explican el total.

### 7.2 Rollup

1. Resolver la verdad dentro del project scope.
2. Deduplicar por canonical object/source identity.
3. Aplicar mapping/allocation aprobado.
4. Alinear currency, period y version/as-of.
5. Agregar por jerarquía canónica.
6. Devolver coverage, unmapped amount y trust state.

Portfolio nunca consulta una tabla raw con una fórmula distinta a la de proyecto.

## 8. Isolation y seguridad

- Cada consulta y link valida `organization_id` y `project_id` de ambos extremos.
- Un canonical master compartido no concede acceso a hechos financieros de otros proyectos.
- External references no se exponen si el usuario carece de acceso al objeto owner.
- RLS/RBAC posteriores deben filtrar filas y relaciones; esconder UI no es control.
- Service accounts reciben scope mínimo y no aprueban mappings.
- Exports conservan scope, currency, period, version y provenance; no emiten IDs cross-tenant.
- Living Graph consume proyecciones ya autorizadas y no amplía visibilidad.

## 9. Mapeo de campos existentes

| Campo actual | Dimensión/rol target | Estado |
|---|---|---|
| `budget_items.organization_id/project_id` | Scope obligatorio | Preservar |
| `budget_items.cost_code` | Legacy cost code display/source | Mapear a canonical CBS node |
| `budget_items.category` | Legacy cost category | Mapear a taxonomy versionada |
| `budget_items.milestone_id` | WBS scope reference | Preservar |
| `cost_actuals.task_id/resource_id` | Execution/resource refs | Preservar y validar scope |
| `cost_actuals.source` | Source type parcial | Extender con source system/record/document identity |
| `material_requirements.supplier_id` | Supplier dimension/evidence | Preservar |
| `procurement_items.supplier_id` | Supplier/counterparty | Preservar |
| `procurement_items.material_requirement_id` | Requirement traceability | Preservar |
| `metadata` / `evidence_json` | Context/evidence hints | Nunca dimension owner por sí solos |

## 10. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Dos organizaciones usan cost code `1000` | Permanecen aisladas por canonical scheme/scope |
| 2 | Supplier cambia de nombre | Stable ID preserva historia; display vigente se resuelve aparte |
| 3 | Actual sin CBS pero con source identity | Conservar `unmapped`; no perder ni certificar en rollup |
| 4 | Un contract line aparece dos veces en batches | Deduplicar por scoped source identity/idempotency |
| 5 | Risk link aparece en Living Graph | Permitir proyección; risk/financial owners permanecen separados |
| 6 | Portfolio compara USD y EUR sin FX | Deny total comparable; devolver breakdown |
| 7 | Task fue movida tras el posting | Conservar effective historical link y bridge vigente |
| 8 | Viewer conoce external invoice ID de otro proyecto | Deny por organization/project isolation |
| 9 | `metadata.department='Ops'` sin canonical mapping | Tratar como hint; no rollup oficial |
| 10 | Línea tiene varios WBS links informativos | Contar una vez; allocation solo si fue declarada |

## 11. Decisiones P1-T3

| ID | Decisión | Estado |
|---|---|---|
| P1-T3-D1 | Las dimensiones describen hechos; no se convierten en financial truth. | Aprobada |
| P1-T3-D2 | Organization/project scope es obligatorio y se valida en ambos extremos de cada link. | Aprobada |
| P1-T3-D3 | Canonical IDs, versiones y effective dates gobiernan identidad; nombres/códigos son atributos. | Aprobada |
| P1-T3-D4 | Cost code, resource, supplier, contract, department, location, country y currency tienen contratos explícitos. | Aprobada |
| P1-T3-D5 | Risk, change y decision conservan owners existentes y se conectan mediante refs tipadas. | Aprobada |
| P1-T3-D6 | Drill-down llega a source document/event/evidence. | Aprobada |
| P1-T3-D7 | Portfolio agrega resoluciones de proyecto y reporta coverage/unmapped. | Aprobada |
| P1-T3-D8 | Graph y metadata nunca son owners dimensionales o financieros. | Aprobada |

## 12. Matriz de aceptación P1-T3

| Criterio | Resultado | Evidencia |
|---|---|---|
| Dimensiones requeridas están definidas | PASS | Sección 3 |
| Existe contrato de referencia trazable | PASS | Sección 4 |
| Se preserva historia y versionado | PASS | Sección 5 |
| Cada verdad declara dimensiones mínimas | PASS | Sección 6 |
| Drill-down y portfolio rollup usan misma verdad | PASS | Sección 7 |
| Organization/project isolation es obligatorio | PASS | Sección 8 |
| Existing fields evolucionan aditivamente | PASS | Sección 9 |
| Criterio original de aceptación | **PASS** | Dimensiones soportan drill-down/rollup preservando aislamiento |

## Nota de cierre lista para ProjectOps360°

P1-T3 completada y validada. Se definió el modelo dimensional para organization/project, portfolio, CBS/cost code, WBS/control account, resource, supplier, contract/PO/invoice, department/cost center, location/country, currency/period, risk, change, decision, approval y provenance. Las dimensiones describen una verdad, pero no son nuevos owners. Cada link usa canonical IDs, tipo de relación, vigencia, allocation opcional, source identity, evidencia y mapping state; metadata y Living Graph permanecen como hints/proyecciones. Se estableció un drill-down obligatorio desde Portfolio hasta source document/event y un rollup que primero resuelve el proyecto, deduplica, alinea moneda/período y publica coverage/unmapped. Organization y project scope se validan en ambos extremos, incluso para master data compartida y service accounts. Se aprobaron 8 decisiones y 10 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T3_Financial_Dimensions_Traceability_References.md`.
