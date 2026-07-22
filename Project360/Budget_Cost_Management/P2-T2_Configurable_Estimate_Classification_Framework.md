# P2-T2 — Framework configurable de clasificación de estimates

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P2 — Estimating, classification and baseline architecture |
| Tarea | P2-T2 — Design configurable estimate-classification framework |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P2-T1 |
| Owner | Product Architecture |
| Accountable | PMO / Project Controls Lead |
| Consultados | Cost Engineering; Industry Framework Owners |
| Entregable | Universal classification contract with framework-specific adapters |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P2** |
| Efecto | Define registry y resolución; no hardcodea AACE ni implementa adapters runtime |

## 1. Decisión arquitectónica

El Core de ProjectOps360° almacenará un **contrato universal de clasificación** y delegará las reglas de industria a adapters versionados. AACE 18R-97 será un adapter de Process Industries, no la taxonomía universal ni una regla aplicada a Software, Commercial Construction u otros project types.

Una clasificación identifica la madurez del alcance/evidencia para un purpose y una versión de estimate. No representa approval, funding, accuracy garantizada, health ni execution progress.

## 2. Objetos del framework

| Objeto | Propósito | Inmutabilidad/versionado |
|---|---|---|
| Classification Scheme | Define namespace, clases, orden y semántica | Versionado; una revision publicada no cambia |
| Scheme Class | Identidad/label de una clase dentro del scheme | ID opaco; el label no es comparable cross-scheme por defecto |
| Industry Adapter | Aplica el scheme a framework/project types y define evidencia/reglas | Versionado y scoped |
| Maturity Dimension | Área evaluada, por ejemplo scope, design, procurement o execution basis | Definida por adapter |
| Deliverable Requirement | Evidencia requerida/condicional/no aplicable por dimensión/clase | Versionada |
| Maturity Assessment | Resultado por deliverable/evidence para una Estimate Version | Snapshot inmutable |
| Classification Determination | Clase resultante, basis, exceptions, confidence y actors | Snapshot inmutable |
| Applicability Decision | Confirma scheme/adapter válido para el proyecto | Trazable y revisable |

## 3. Contrato universal de scheme

Todo Classification Scheme declara:

- scheme ID, namespace, name, owner y publisher;
- revision/version y effective dates;
- source/reference metadata y licensing/access classification;
- intended industries/project types y exclusions;
- class IDs, labels, order y descriptions;
- allowed purposes/end uses por class;
- maturity model type y determination strategy;
- required adapter interface/version;
- override policy y authority;
- deprecation/supersession rules;
- localization/display metadata;
- audit/provenance requirements.

Los class IDs se resuelven siempre junto a `scheme_id + scheme_version`. `Class 3` de un scheme no equivale automáticamente a `Class 3` de otro.

## 4. Contrato universal de adapter

| Grupo | Campos/requisitos |
|---|---|
| Identity | adapter ID/version, scheme ID/version, owner, status |
| Applicability | framework IDs, project types, industry tags, delivery methods, exclusions y applicability rules |
| Inputs | BOE version, scope refs, deliverables, evidence, purpose/end use y project context |
| Dimensions | maturity dimensions, criticality, applicability y evidence types |
| Evidence states | Vocabulario ordenado de maturity/quality states |
| Class rules | Threshold/floor/decision-table rules y required critical deliverables |
| Determination | Algorithm/rule-set version, human-review requirements y tie/conflict handling |
| Outputs | class, basis, evidence coverage, exceptions, confidence y readiness |
| Guardrails | No accuracy guarantee, no automatic approval/funding, no cross-industry fallback |

El adapter no puede escribir Estimate, Budget o Baseline. Produce un determination candidate que Cost Engineering revisa y PMO aprueba conforme a policy.

## 5. Evidence y maturity assessment

### 5.1 Estado de un deliverable

El Core admite un vocabulario universal mínimo:

| Estado | Significado |
|---|---|
| `not_applicable` | Excluido con reason/policy |
| `missing` | Requerido pero no existe evidencia |
| `identified` | Necesidad/entregable identificado |
| `conceptual` | Contenido preliminar suficiente para discusión |
| `developing` | Desarrollo parcial con gaps conocidos |
| `defined` | Contenido definido para el purpose indicado |
| `issued_for_estimate` | Versión formal emitida para esa estimate version |
| `validated` | Revisado y aceptado por authority definida |

Un adapter puede mapear estados propios a este vocabulario, pero preserva el valor original y la versión de mapping.

### 5.2 Calidad separada de madurez

Cada assessment declara además:

- completeness;
- correctness/validation state;
- consistency con otros deliverables;
- freshness/base date;
- source authority;
- confidence;
- exceptions/materiality.

Un deliverable avanzado pero contradictorio o stale no se presenta como evidencia confiable.

## 6. Determination pipeline

1. Resolver project/framework/delivery context.
2. Seleccionar schemes/adapters aplicables por reglas explícitas.
3. Si ninguno aplica, devolver `not_applicable/no_adapter`; no usar AACE por defecto.
4. Congelar BOE/Estimate Version y evidence population.
5. Evaluar deliverables por dimensión, estado y calidad.
6. Aplicar critical-deliverable floors, decision tables o strategy versionada.
7. Producir candidate class y determination basis reproducible.
8. Mostrar gaps, conflicts, overrides y evidence coverage.
9. Requerir review/approval humano según policy.
10. Publicar Classification Determination inmutable y event traceable.

El percentage de diseño/completitud puede ser evidence contextual, pero nunca es el único class determiner.

## 7. Resultados posibles

| Estado | Uso |
|---|---|
| `determined` | Clase sustentada, revisada y publicada |
| `provisional` | Candidate útil, pendiente de revisión/evidence material |
| `insufficient_evidence` | No existe base para determinar una clase defendible |
| `conflicted` | Rules/evidence producen resultados incompatibles |
| `not_applicable` | Scheme/adapter no aplica al project context |
| `overridden` | Reviewer autorizado seleccionó otra clase con rationale/evidence |
| `superseded` | Nueva estimate/classification version reemplaza la anterior |

`unknown` no se convierte en la clase menos madura automáticamente, porque ausencia de evidencia y scope realmente conceptual son hechos distintos.

## 8. Reglas de class y comparabilidad

- El orden de clases pertenece al scheme.
- Purpose/method/accuracy son características o metadata; la madurez definida por el scheme gobierna la determinación.
- Cross-scheme comparison requiere mapping aprobado y declara pérdida de equivalencia.
- Portfolio rollup muestra distribution por scheme/class y coverage; no suma labels como números universales.
- Cambiar adapter/scheme revision genera nueva determination, no reescribe la anterior.
- Determination se asocia a una Estimate/BOE Version exacta y no se hereda silenciosamente.

## 9. Accuracy, riesgo y comunicación

El framework permite registrar una referencia de accuracy solo si:

- el scheme/adapter la define;
- se identifica si es típica, histórica, contractual o project-specific;
- se registra confidence basis y contingency treatment;
- se evalúan riesgos/condiciones del proyecto;
- se muestra disclaimer y source revision;
- PMO/Cost Engineering aprueban su comunicación.

Nunca se presenta como garantía, SLA, prediction calibrada o sustituto de quantitative risk analysis. Un class determination puede existir sin accuracy range.

## 10. Override y exception governance

Un override requiere:

- candidate class y rule result originales;
- selected class;
- reason y affected decision;
- missing/conflicting deliverables;
- materiality/risk assessment;
- requester y authorized approver separados;
- policy/version y expiry/review date;
- event y evidence refs.

Un override no altera evidence states para hacerlos aparentar maduros. Reports muestran `overridden` y el determination basis original.

## 11. Registry y resolución

### 11.1 Registry lógico

El registry debe poder resolver:

- active scheme versions;
- adapter compatibility con scheme/Core contract versions;
- framework/project-type applicability;
- source/license metadata;
- status: draft, active, deprecated, withdrawn;
- successor/migration mapping;
- localization y display order.

### 11.2 Resolver común

Budget UI, Reports, Import Intelligence, Living Graph e Isabella consultarán un resolver común que devuelve:

- estimate/BOE IDs/versions;
- scheme/adapter IDs/versions;
- class y determination state;
- maturity/evidence coverage;
- critical gaps/exceptions;
- basis, actors, timestamps y source;
- confidence/accuracy statement gobernada;
- permissions/visibility.

Ningún consumer reimplementa la class logic.

## 12. Seguridad e isolation

- Organization/project scope se valida en BOE, evidence, assessment y determination.
- Industry framework ownership no concede acceso a project evidence.
- Scheme reference data puede ser global; determinations/evidence siempre son tenant/project scoped.
- Source/license restrictions controlan qué contenido se almacena o muestra.
- Service accounts ejecutan evaluación determinística pero no aprueban override/class.
- Isabella explica el basis y gaps; no cambia class ni genera evidence falsa.

## 13. Compatibilidad y rollout

1. Preservar `material_requirements`, cost library y imported estimates como inputs.
2. Añadir classification metadata/owners después de G6; no sobrecargar `budget_items.status/category`.
3. Clasificar legacy estimates como `unclassified/insufficient_evidence` hasta revisión.
4. Introducir adapters por framework con feature flags y registry validation.
5. Comparar adapter result con reviewers en shadow mode.
6. Habilitar consumers solo después de parity/quality gate.
7. Rollback desactiva adapter/resolver; no elimina determinations históricas.

## 14. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Software project sin adapter propio | No aplicar AACE; `no_adapter/not_applicable` |
| 2 | Process-industry project con adapter activo | Evaluar su evidence/maturity contract |
| 3 | Project tiene 60% design complete pero critical deliverables faltan | No determinar por porcentaje; mostrar gaps |
| 4 | Evidence está completa pero stale/conflicted | Reducir readiness; no ocultar quality gap |
| 5 | Dos adapters aplican | Resolver priority/policy o `conflicted`; no elegir silenciosamente |
| 6 | Class label coincide entre schemes | Mantener scheme-qualified identity |
| 7 | Reviewer overridea candidate | Conservar candidate, reason, approval y estado `overridden` |
| 8 | Accuracy típica se presenta como garantía | Deny publication |
| 9 | Adapter revision cambia reglas | Nueva determination; history intacta |
| 10 | Portfolio mezcla classes de schemes distintos | Distribution por scheme; mapping solo si aprobado |
| 11 | Consumer calcula clase localmente | Architecture violation; usar resolver común |
| 12 | Legacy import carece de evidence | `unclassified/insufficient_evidence`; no fabricar class |

## 15. Decisiones P2-T2

| ID | Decisión | Estado |
|---|---|---|
| P2-T2-D1 | Core define un contrato universal y adapters contienen reglas de industria. | Aprobada |
| P2-T2-D2 | Scheme/class identity siempre incluye version y namespace. | Aprobada |
| P2-T2-D3 | Evidence maturity y evidence quality se evalúan por separado. | Aprobada |
| P2-T2-D4 | Percent design/completeness nunca es el único determiner. | Aprobada |
| P2-T2-D5 | Accuracy es opcional, gobernada y nunca garantía. | Aprobada |
| P2-T2-D6 | Overrides conservan candidate result, rationale, evidence y authority. | Aprobada |
| P2-T2-D7 | Consumers usan un resolver común y no implementan class logic. | Aprobada |
| P2-T2-D8 | Legacy data permanece unclassified sin evidence. | Aprobada |
| P2-T2-D9 | AACE 18R-97 solo puede activarse mediante su adapter aplicable. | Aprobada |
| P2-T2-D10 | Framework reference data no debilita tenant/project isolation. | Aprobada |

## 16. Matriz de aceptación P2-T2

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe classification scheme contract | PASS | Sección 3 |
| Existe adapter contract | PASS | Sección 4 |
| Class/maturity evidence/basis son almacenables | PASS | Secciones 5–7 |
| No se hardcodea una industria | PASS | Secciones 1, 6 y 13 |
| Accuracy no es garantía | PASS | Sección 9 |
| Registry/resolver común están definidos | PASS | Sección 11 |
| Isolation y compatibility están preservados | PASS | Secciones 12–13 |
| Criterio original de aceptación | **PASS** | Core almacena scheme, class, evidence y basis sin hardcode industrial |

## Nota de cierre lista para ProjectOps360°

P2-T2 completada y validada. Se diseñó un framework universal de clasificación compuesto por Scheme, Scheme Class, Industry Adapter, Maturity Dimensions, Deliverable Requirements, Assessments y Classification Determinations versionados. El Core almacena identity, class, evidence coverage, determination basis, exceptions y authority, mientras cada adapter conserva reglas de industria y applicability. Evidence maturity y quality se evalúan por separado; percent design nunca es el único determiner y `unknown` no se convierte automáticamente en la clase menos madura. Accuracy es opcional, requiere basis/risk context y nunca se presenta como garantía. Overrides conservan candidate result, reason y aprobación. Todos los consumers usan un resolver común. AACE 18R-97 solo puede activarse mediante el adapter de Process Industries; Software y otros frameworks requieren adapters propios. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P2-T2_Configurable_Estimate_Classification_Framework.md`.
