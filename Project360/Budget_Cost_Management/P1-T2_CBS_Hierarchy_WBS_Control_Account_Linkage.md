# P1-T2 — Jerarquía CBS y vínculo WBS/control account

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T2 — Define CBS hierarchy and WBS/control-account linkage |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P1-T1 |
| Owner | Cost Engineering Lead |
| Accountable | PMO / Project Controls Lead |
| Consultados | Product Architecture; Project Manager; Finance |
| Entregable | Ontología CBS y reglas de vínculo con proyecto, fase, milestone, task y control account |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P1** |
| Efecto | Define identidad y rollup; no crea tablas ni modifica el Core |

## 1. Decisión de estructura

ProjectOps360° utilizará dos estructuras relacionadas pero independientes:

- **WBS / execution scope:** responde **qué alcance se entrega y cómo se ejecuta**; sus owners continúan en el Core.
- **CBS / cost structure:** responde **dónde se clasifica, controla y agrega el costo**; su owner pertenece al dominio financiero.

La unión de ambas se gobierna mediante **control accounts y enlaces explícitos**, no duplicando WBS en un módulo financiero ni forzando una línea de budget por cada task.

## 2. Ontología CBS

### 2.1 Entidades

| Entidad | Definición | Invariantes |
|---|---|---|
| CBS Scheme | Taxonomía versionada aplicable a organización, framework o proyecto | Tiene owner, vigencia, estado y versión; no cambia IDs históricos |
| CBS Node | Nodo jerárquico de clasificación/control | Stable ID, código, parent, nivel y effective window |
| Cost Code | Código operativo asignable al nivel permitido del CBS | Único dentro del namespace del scheme; nunca es texto sin owner |
| Control Account | Punto de control donde se cruzan scope WBS, responsabilidad y costo CBS | Tiene owner/control account manager, calendario y reglas de medición |
| Financial Line | Línea de estimate, budget, baseline, commitment, actual o forecast | Apunta a CBS/control account y puede mantener links de ejecución adicionales |
| Scope Link | Relación explícita entre una entidad financiera y proyecto/fase/milestone/task/subtask | Declara tipo, rol, vigencia, allocation y provenance |

### 2.2 Jerarquía mínima

El Core no impone una profundidad universal. Un scheme puede usar, por ejemplo:

`Project Cost → Major Cost Group → Discipline/Commodity → Cost Code`

o una jerarquía propia de software/servicios. Las reglas obligatorias son:

1. un nodo tiene como máximo un parent dentro de una versión de scheme;
2. no existen ciclos;
3. solo niveles configurados aceptan posting/control;
4. el rollup sigue parent links de la misma versión;
5. códigos e IDs históricos no se reutilizan para otro significado;
6. reestructurar el CBS crea una nueva versión/mapping, no reescribe hechos históricos.

## 3. WBS y scope Core preservados

Los owners existentes de proyecto, fase, milestone, task y subtask permanecen canónicos. El dominio financiero:

- referencia sus IDs estables;
- no copia títulos, status o jerarquías como nueva fuente;
- conserva la relación temporal usada al postear el hecho;
- permite drill-through hacia Workboard, Roadmap, Living Graph y Project Memory;
- no altera execution status desde un estado financiero.

Un rename o movimiento de task en el Core no cambia automáticamente la clasificación CBS histórica. El resolver presenta el nombre vigente y conserva el snapshot/provenance del enlace utilizado en cada versión financiera.

## 4. Control account como intersección gobernada

### 4.1 Definición

Un control account representa una porción controlable de alcance con:

- una referencia WBS principal o conjunto explícito de referencias;
- un nodo CBS/cost code principal;
- un accountable control owner;
- calendario/periodos de control;
- moneda/base de reporte;
- reglas de medición y forecast;
- límites de authority y approval policy;
- effective dates y lifecycle state.

### 4.2 Cardinalidad

| Relación | Permitida | Regla |
|---|---|---|
| Un control account → varios tasks/milestones | Sí | El control account controla un paquete; no obliga una línea por task |
| Una task → varios control accounts | Sí, excepcional y explícita | Requiere allocation o roles de relación para evitar doble conteo |
| Una financial line → un CBS posting node principal | Sí, obligatorio cuando está reconciliada | El posting node determina rollup canónico |
| Una financial line → varias referencias WBS | Sí | Son trazabilidad; si distribuyen valor, allocations deben cuadrar |
| Un budget item → task obligatoria | No | Milestone/control account/CBS pueden ser el grain correcto |
| Un actual/commitment → sin WBS/CBS | Temporalmente, como excepción | Queda `unmapped/unreconciled`; no desaparece ni se fuerza a otro bucket |

## 5. Tipos de enlace

| Tipo | Uso | ¿Distribuye importe? |
|---|---|---|
| `primary_control_scope` | Scope principal del control account | No, identifica ownership |
| `cost_posting` | CBS/control account donde se postea | Sí, 100% o allocation explícita |
| `supports_scope` | Línea financiera soporta una o más entidades WBS | No por defecto |
| `caused_by_scope` | Costo/cambio originado por una entidad de ejecución | No |
| `forecast_for_scope` | ETC/EAC cubre scope restante | Sí, según allocation del forecast |
| `evidence_from_scope` | Task/milestone/receipt aporta evidencia | No |
| `shared_cost_allocation` | Costo común distribuido | Sí; total allocation = 100% |

Cada enlace declara `relationship_type`, source/target IDs, effective window, allocation basis, allocation value, actor/source y evidence. Una referencia sin allocation nunca divide un importe por inferencia.

## 6. Reglas de rollup

### 6.1 Grain antes de suma

Cada resolver agrupa primero por canonical financial object/version y elimina duplicados por identity. Luego aplica allocation de posting y finalmente agrega por CBS/WBS/portfolio. El graph o la cantidad de links nunca multiplica el importe.

### 6.2 Reglas obligatorias

1. Un hecho tiene un posting owner principal por versión.
2. Allocations que distribuyen un hecho deben sumar exactamente 100% dentro de tolerancia de redondeo aprobada.
3. Links informativos no participan en sumas.
4. Rollup CBS usa la versión vigente para el reporte o el mapping histórico declarado.
5. Rollup WBS agrega mediante control account/scope allocation; no usa nombres ni paths de texto.
6. Portfolio agrega la posición resuelta de cada proyecto; no vuelve a interpretar líneas raw.
7. Unmapped items permanecen en un bucket visible `unmapped`, con materialidad y owner de remediación.
8. Shared/indirect costs usan reglas de allocation versionadas; no se reparten automáticamente en partes iguales.

### 6.3 Reconciliaciones mínimas

- total de líneas asignadas = total canónico antes de allocation;
- suma de children CBS = parent rollup, salvo excepciones declaradas;
- total por WBS/control account = total por CBS para la misma población y policy;
- un hecho enlazado a varias tasks se cuenta una vez;
- currency/period alignment ocurre antes de rollup comparable.

## 7. Compatibilidad con el modelo existente

| Elemento actual | Decisión aditiva |
|---|---|
| `budget_items.id` | Se preserva como stable line identity durante transición |
| `budget_items.cost_code` | Se conserva; se resolverá a canonical cost code/CBS node mediante mapping versionado |
| `budget_items.milestone_id` | Se preserva como existing scope link |
| `budget_items.metadata` | Puede transportar hints de importación; no es owner de CBS, approval o amount truth |
| `cost_actuals.budget_item_id` | Se conserva como link de detalle a línea; no sustituye CBS/control account |
| `cost_actuals.task_id` | Se conserva como scope reference; puede coexistir con control account |
| `material_requirements.required_by_task_id` | Sigue siendo operational requirement link y estimate evidence |
| `procurement_items.budget_item_id` | Se conserva para reconciliación commitment→financial line |
| `milestones` / `roadmap_tasks` | Continúan como owners de ejecución Core |

Los 38 `budget_items` legacy sin cost code/milestone demostrado permanecen `unmapped/legacy_unapproved` hasta clasificación con evidencia; no se les fabrica una CBS.

## 8. Control accounts y responsabilidades

| Responsabilidad | Owner |
|---|---|
| Diseñar/aprobar CBS scheme | PMO / Cost Engineering |
| Mantener WBS y execution scope | Project Manager / Core owners |
| Aprobar vínculo control account–scope | PMO / Project Controls según policy |
| Preparar mappings | Cost Engineer / Data Steward |
| Validar actual mapping | Finance + PMO reconciler |
| Validar commitment mapping | Procurement + PMO reconciler |
| Aprobar allocation de shared cost | PMO/Finance según policy |
| Corregir mapping histórico | Authorized steward mediante versión/compensación |

El PM aporta scope y evidencia, pero no obtiene autoridad presupuestaria por mantener la WBS.

## 9. Estados de calidad de mapping

| Estado | Significado | Uso permitido |
|---|---|---|
| `mapped` | CBS y control scope válidos | Rollup oficial |
| `partially_mapped` | Falta una dimensión no material o allocation parcial | Mostrar con excepción; policy decide publicación |
| `unmapped` | No existe link canónico | No ocultar; excluir de comparaciones certificadas |
| `conflicted` | Múltiples mappings incompatibles | Bloquear rollup definitivo |
| `stale_mapping` | Scheme/link expiró o cambió sin revalidación | Mostrar con warning y remediar |
| `not_applicable` | El hecho legítimamente no requiere el vínculo | Requiere reason/policy |

## 10. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Un control account cubre 25 tasks | Allow; una posición controlada con drill-through, no 25 budgets forzados |
| 2 | Una línea tiene dos task links informativos | Contar una vez; links no distribuyen importe |
| 3 | Shared cost se reparte 60/40 | Allow si policy/version/evidence existen y allocations cuadran |
| 4 | Allocations suman 95% | Deny publicación; estado `partially_mapped` |
| 5 | Actual importado no tiene cost code | Conservar como `unmapped/unreconciled`; no asignar a `other` silenciosamente |
| 6 | Task cambia de milestone | Mantener mapping histórico; resolver nombre vigente sin reescribir hecho |
| 7 | Se reorganiza CBS | Crear nueva versión y bridge; no reciclar IDs |
| 8 | Portfolio suma raw financial lines | Deny; agregar posiciones resueltas por proyecto |
| 9 | Graph contiene tres edges para el mismo actual | Importe se cuenta una vez por canonical object ID |
| 10 | PM edita WBS | No cambia baseline/CBS sin workflow y autoridad financiera |

## 11. Decisiones P1-T2

| ID | Decisión | Estado |
|---|---|---|
| P1-T2-D1 | CBS y WBS son estructuras independientes conectadas por control accounts/links. | Aprobada |
| P1-T2-D2 | El Core conserva ownership de proyecto, milestone, task y subtask. | Aprobada |
| P1-T2-D3 | No se exige una línea presupuestaria por task. | Aprobada |
| P1-T2-D4 | Cada hecho reconciliado tiene un CBS posting node principal. | Aprobada |
| P1-T2-D5 | Links informativos no distribuyen ni multiplican importes. | Aprobada |
| P1-T2-D6 | Allocations son explícitas, versionadas y deben cuadrar 100%. | Aprobada |
| P1-T2-D7 | Unmapped/conflicted son estados visibles, no buckets silenciosos. | Aprobada |
| P1-T2-D8 | IDs y links legacy se preservan mediante evolución aditiva. | Aprobada |

## 12. Matriz de aceptación P1-T2

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe ontología CBS y reglas de jerarquía | PASS | Sección 2 |
| CBS se vincula a proyecto/fase/milestone/task/control account | PASS | Secciones 3–5 |
| Cada línea puede hacer rollup CBS | PASS | Secciones 4 y 6 |
| Existe trazabilidad hacia execution scope | PASS | Secciones 3–5 |
| No se obliga una línea por task | PASS | Secciones 4.2 y 10 |
| Se evita doble conteo por links/allocations | PASS | Sección 6 |
| Existing IDs y links evolucionan aditivamente | PASS | Sección 7 |
| Criterio original de aceptación | **PASS** | Toda línea puede hacer rollup y trazar scope sin forzar budget por task |

## Nota de cierre lista para ProjectOps360°

P1-T2 completada y validada. Se definió la CBS como jerarquía financiera versionada y separada de la WBS de ejecución. Proyecto, fase, milestone, task y subtask continúan perteneciendo al Core; el dominio financiero solo referencia sus IDs. El control account quedó definido como intersección gobernada entre CBS, scope WBS, owner y período de control. Una cuenta puede cubrir múltiples tasks y una línea puede conservar varias referencias, por lo que no se obliga una línea de presupuesto por task. Cada hecho reconciliado tiene un posting node principal; los links informativos no distribuyen importes y las allocations explícitas deben sumar 100%. Los rollups eliminan duplicados por canonical object antes de agregar y preservan buckets `unmapped/conflicted`. Se mapearon `budget_items`, `cost_actuals`, materials y procurement de forma aditiva, sin duplicar WBS ni Living Graph. Se aprobaron 8 decisiones y 10 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T2_CBS_Hierarchy_WBS_Control_Account_Linkage.md`.
