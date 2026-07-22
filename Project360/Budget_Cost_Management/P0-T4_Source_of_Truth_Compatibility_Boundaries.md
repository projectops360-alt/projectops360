# P0-T4 — Límites de fuente de verdad y compatibilidad current→target

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P0 — Discovery, charter and governance baseline |
| Tarea | P0-T4 — Define source-of-truth and compatibility boundaries |
| Versión | 1.0 |
| Fecha de baseline | 2026-07-21 |
| Owner | Product Architecture |
| Accountable | Product Owner |
| Consultados | PMO / Project Controls; Engineering; Data Architecture |
| Entregable | Current-to-target ownership map |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE DE ARQUITECTURA P0** |
| Efecto | Informa P0-T5, G0 y arquitectura posterior; **no autoriza implementación** |

## 1. Decisión arquitectónica

El Budget & Cost Management Engine evolucionará el Core actual de ProjectOps360° de forma **aditiva, compatible y reversible**. No reemplazará `budget_items`, `cost_actuals`, `material_requirements` ni `procurement_items` mediante un producto paralelo; tampoco creará un segundo event ledger, status engine, graph, approval system o financial truth.

La arquitectura respetará cinco owners canónicos ya aprobados:

1. **Canonical financial domain:** dueño de cada verdad financiera vigente y aprobada dentro de ProjectOps360°.
2. **`project_event_log`:** único ledger inmutable para lifecycle, decisiones, correcciones y evidencia temporal.
3. **Execution Status / Health owners existentes:** `status-engine.ts`, `task-activity.ts`, project rollups y health resolvers; no habrá `financial-status-engine` paralelo.
4. **Living Graph existente:** única proyección gráfica mediante `process_nodes`, `process_edges` y proyecciones canónicas; nunca dueño de importes o estados.
5. **Projection/resolver layer:** único contrato de lectura para Budget UI, Reports, Command Center, Closeout, Process Mining e Isabella; una proyección es descartable y nunca se convierte en fuente de verdad.

Los sistemas externos conservan autoridad donde P0-T1 lo definió: Finance/ERP sobre actuals, accruals, períodos y payments; Procurement/Contract Management sobre contratos, PO y commitments; Sponsor/Steering sobre funding y autorizaciones según umbral.

## 2. Principio de un owner por hecho

Cada business fact tendrá exactamente un owner. Otros componentes pueden conservar:

- una referencia al owner;
- una copia normalizada con source identity e idempotencia;
- una proyección derivada y recalculable;
- un evento inmutable que documenta cómo cambió;
- una relación en Living Graph;
- una vista o reporte.

Ninguno de esos consumidores o artefactos alternos puede disputar la autoridad del owner.

### 2.1 Clasificación usada en este documento

| Código | Clasificación | Definición |
|---|---|---|
| **EOS** | External Official Source | Sistema externo con autoridad oficial, por ejemplo ERP o procurement system |
| **CDO** | Canonical Domain Owner | Registro/contrato local que posee el hecho vigente dentro de ProjectOps360° |
| **CLR** | Canonical Local Record | Copia normalizada e idempotente de un hecho externo, preservando su source identity |
| **CEL** | Canonical Event Ledger | `project_event_log`, historia inmutable del lifecycle |
| **CP** | Compatibility Projection | Campo/tabla legado mantenido para consumidores existentes; derivado, no editable como verdad |
| **DRM** | Derived Read Model | Resolver, KPI, report, health o read model recalculable |
| **GP** | Graph Projection | Nodo/relación visual o analítica en el Living Graph existente |
| **REF** | Reference Data | Catálogo auxiliar que ayuda a estimar o clasificar, pero no autoriza importes |

## 3. Arquitectura target sin duplicación

```text
EXTERNAL OFFICIAL SOURCES
Finance / ERP          Procurement / Contracts          Sponsor / Steering
actuals, accruals,     contracts, PO, commitments       funding, approvals
payments, periods
        │                         │                           │
        └──────────────┬──────────┴──────────────┬────────────┘
                       ▼                         ▼
             CANONICAL FINANCIAL DOMAIN IN PROJECTOPS360°
     estimate · original budget · current baseline · commitment refs
     actual refs · forecast · reserves · changes · reconciliation state
                       │
          ┌────────────┼──────────────────────┐
          ▼            ▼                      ▼
 project_event_log   deterministic         canonical links
 immutable history  financial resolvers   WBS/CBS/tasks/risks/etc.
          │            │                      │
          └────────────┼──────────────────────┘
                       ▼
              EXISTING PROJECTOPS360° ENGINES
   status/health · rollups · process mining · process_nodes/process_edges
                       │
                       ▼
        Budget UI · Reports · Command Center · Closeout · Isabella
              consumers/projections — never owners
```

## 4. Ownership map por business fact

| Business fact | Owner oficial/externo | Owner canónico en ProjectOps360° | Ledger/proyección permitida | Prohibición |
|---|---|---|---|---|
| Project identity | ProjectOps360° Core | `projects` | Event references; graph node | Crear proyecto financiero paralelo |
| WBS, milestone, task, subtask | ProjectOps360° Core | Owners existentes de ejecución | Financial links; resolvers; graph | Duplicar WBS/Gantt para finanzas |
| Cost code / CBS identity | PMO / Project Controls | Canonical financial domain vinculado al Core | Resolver y graph links | Cost code solo en metadata sin owner |
| Estimate / BOE | PMO / Project Controls | Estimate domain; inputs desde materials/cost library | `budget_items` legacy projection durante transición | Tratar estimate como funding/baseline |
| Funding | Sponsor / Steering | Funding authorization record | CEL events; financial resolver | Inferir funding desde budget/actual |
| Original Budget | PMO / Project Controls bajo aprobación | Version aprobada e inmutable del financial domain | `budget_items.estimated_cost` solo CP cuando exista mapping | Sobrescribir versión original |
| Current Baseline | PMO / Project Controls bajo approval matrix | Versión baseline vigente | CP en `budget_items`; CEL history | Campo mutable como única baseline |
| Commitments | Procurement / Contract Management | `procurement_items` evolucionado + normalized commitment semantics | `budget_items.committed_cost` como CP derivada | Mantener commitment manual paralelo |
| Actual Cost | Finance / ERP | `cost_actuals` evolucionado como CLR por transacción | `budget_items.actual_cost` como CP derivada | Dos actuals editables |
| Accruals | Finance / Controller | Normalized accrual records en financial domain | Resolver y CEL | Mezclar accrual con actual/payment |
| Forecast / ETC / EAC | PMO / Project Controls | Forecast version/cycle aprobado | `budget_items.forecast_cost` como CP derivada | Fallback `actual = forecast` |
| Contingency Reserve | PMO/Sponsor según umbral | Reserve account + authorized movements | Resolver, CEL, risk/change links | Categoría `contingency` como control suficiente |
| Management Reserve | Sponsor / Steering | Reserve authorization/movement record | Resolver y CEL | Liberación por PM o Isabella |
| Financial Change | PMO/Sponsor según threshold | Change lifecycle vinculado a baseline/forecast | CEL + existing governance links | Cambio silencioso de amount/status |
| Cash-flow Forecast | Finance/Treasury con PMO | Financial time-phased projection | DRM; report; CEL al aprobar/publicar | Confundir cash flow con costo incurrido |
| Payment | Finance / Treasury / ERP | Payment reference CLR cuando se requiera | Resolver/read model; CEL | Convertir ProjectOps360° en AP/banco |
| Financial approval | RACI/approval authority | Existing governance primitives evolucionadas | CEL decision event | Segundo approval matrix |
| Financial status/health | Domain lifecycle + existing Status/Health owners | Financial lifecycle resolver + existing `status-engine`/health/rollups | DRM consumed everywhere | Segundo status/health engine |
| Financial event | Approved business action | `project_event_log` | Event projections/Process Mining | `financial_event_log` paralelo |
| Financial graph relation | Owners anteriores | Existing `process_nodes`/`process_edges` projections | Living Graph modes/layers | Financial graph database paralela |
| Recommendation/explanation | No autoridad propia | Deterministic resolver + Isabella | Read-only response with evidence | AI como owner o approver |

## 5. Current→target ownership map por objeto existente

### 5.1 Resumen

| Objeto actual | Rol actual demostrado en P0-T2 | Rol target | Estrategia | Owner después del cutover |
|---|---|---|---|---|
| `budget_items` | Summary/placeholder mutable; import/template; report source | Identidad de partida/CBS + compatibility rollup | **Retain + extend additively** | Canonical budget line identity; amounts legacy pasan a CP |
| `cost_actuals` | Schema sin writer/consumer ni datos productivos | CLR de actuals financieros detallados | **Retain + harden additively** | Finance-sourced actual transaction owner local |
| `material_requirements` | Ruta activa de estimate/takeoff | Scope/material demand + estimate input | **Retain unchanged semantically** | Materials/estimate source, nunca baseline/actual |
| `procurement_items` | Schema + critical-path reader; 0 filas productivas | Procurement identity + normalized commitment semantics | **Retain + extend additively** | Procurement/commitment local owner con source identity |
| `cost_library_items` | Seeds de costo unitario | Reference data para estimate/BOE | **Retain as REF** | Cost reference owner; nunca financial truth |
| `risks` | Riesgo operativo con categoría budget | Risk owner con financial impact links | **Retain + link** | Risk domain; exposure/reserve siguen en financial domain |
| `project_approval_matrix` | Approval areas/threshold text | Policy input versionado para financial approval | **Reuse + extend** | Governance owner; no segunda matriz |
| `project_raci_assignments` / team roles | RACI y permisos generales | Contexto de authority/delegation | **Reuse + extend** | Existing people/governance domain |
| `project_event_log` | Ledger canónico append-only ya implementado | Único financial lifecycle ledger | **Extend event registry only** | CEL único |
| `process_nodes` / `process_edges` | Graph substrate/projection | Financial nodes/edges en el mismo graph | **Extend projections only** | GP; nunca owner financiero |
| `status-engine.ts` + health/rollups | Owners de status y métricas compartidas | Consumir financial resolver para dimensión cost/forecast | **Extend existing contracts** | Status/health owners existentes |
| Budget UI | Lee/edita materials estimate | Unified financial workspace consumiendo resolvers | **Evolve in place** | Consumer; estimate permanece subvista explícita |
| Reports / Command Center / Closeout | Leen raw summary y aplican fallbacks | Read models desde resolver común | **Migrate consumers** | DRM; no business logic propio |
| Isabella | Consume contexto y explica | Read-only financial advisor | **Add governed tools over resolver** | Nunca owner |

### 5.2 `budget_items`

`budget_items` conserva sus IDs, project links, milestone/task/material/procurement references, cost code y procedencia. No se elimina ni se reemplaza por una tabla de partidas incompatible.

Mapeo de campos actuales:

| Campo actual | Clasificación durante transición | Regla target |
|---|---|---|
| `id` | CDO identity | Se preserva estable; cualquier extensión referencia este ID |
| `project_id` | CDO scope | Se preserva y valida junto con organization scope |
| `cost_code` | Candidate CBS key | Se conserva; debe vincularse a identidad CBS gobernada cuando se apruebe el modelo |
| `estimated_cost` | Legacy estimate CP | No implica Original Budget ni Current Baseline; después del cutover se deriva del mapping aprobado |
| `committed_cost` | Legacy mutable summary | Se vuelve CP derivada de commitments vigentes/reconciliados |
| `actual_cost` | Legacy mutable summary | Se vuelve CP derivada de `cost_actuals` reconciliados |
| `forecast_cost` | Legacy nullable summary | Se vuelve CP de la última forecast version aprobada; nulo significa unknown |
| `currency` | Legacy display currency | Se conserva para compatibilidad; el target exige moneda por importe/período y base currency cuando aplique |
| `status` | Mezcla lifecycle/health | Se mantiene temporalmente como CP; lifecycle y health se resuelven por owners separados |
| `milestone_id` | Existing scope link | Se preserva; target admite relaciones adicionales sin romperlo |
| `metadata` | Contexto no autoritativo | Nunca almacena por sí solo aprobación, amount truth o authority |

Los 38 budget items existentes en producción se clasificarán como `legacy_unapproved`/`unknown` hasta encontrar evidencia válida. Sus valores cero, origen import/template y estado planned no se convertirán artificialmente en baseline aprobada.

### 5.3 `cost_actuals`

`cost_actuals` es el punto de evolución preferido para el detalle local normalizado de actuals porque ya vincula project, budget item, task, resource, amount, currency, date, type y source. La evolución aditiva deberá incorporar, mediante campos o estructuras relacionadas aprobadas posteriormente:

- external source/system identity;
- external transaction ID y deduplication key;
- accounting period y posting date;
- document/evidence reference;
- source status y reconciliation status;
- reversal/compensation relationship;
- exchange-rate provenance cuando aplique;
- approval/posting actors desde RACI/CEL.

No se creará otra tabla editable que también pretenda ser la verdad de actual cost. `budget_items.actual_cost` quedará como proyección agregada.

### 5.4 `material_requirements`

Permanece dueño del requerimiento material y de sus cantidades/evidencia operacional. Puede alimentar Estimate/BOE y originar procurement requests. No posee:

- funding;
- Original Budget;
- Current Baseline;
- commitment contractual;
- actual cost;
- payment;
- forecast aprobado.

La pantalla Budget actual deberá conservarse durante la transición como vista **Estimate / Material Takeoff**. Renombrar o reorganizar visualmente esa experiencia pertenece a diseño posterior, pero su semántica queda congelada aquí.

### 5.5 `procurement_items`

Se preservan IDs y links a material, supplier, budget item y delivery. La evolución aditiva incorporará la semántica necesaria para distinguir requisition, quote, contract/PO line, approved commitment, amendment, cancellation, receipt y source identity.

Reglas:

- un procurement item aprobado puede contribuir a commitment mediante resolver;
- quote/request no equivale a commitment;
- delivery/receipt no equivale por sí solo a actual o payment;
- cambios contractuales son versiones/eventos, no overwrite silencioso;
- un sistema externo de Procurement conserva autoridad y su ID se preserva;
- no se crea un segundo módulo de procurement ni una tabla financiera desconectada que duplique PO/commitment.

### 5.6 Existing governance primitives

`project_approval_matrix`, `project_raci_assignments`, `project_team_members` y charter governance se reutilizan como base. P0-T3 define las funciones de negocio y SoD. La arquitectura posterior podrá añadir contratos versionados/delegaciones/policies, pero no establecerá una segunda matriz RACI o approval system que compita con estos owners.

## 6. Límite del Canonical Event Ledger

### 6.1 Único ledger

Todos los financial lifecycle events se registrarán en `project_event_log` mediante el Event Ingestion Service y su registry/versioning. Ejemplos conceptuales posteriores: funding authorized, budget approved, baseline activated, commitment posted, actual imported, accrual approved, forecast published, reserve released, change approved, reconciliation completed.

### 6.2 Lo que el ledger sí hace

- registra hechos pasados e inmutables;
- preserva actor, authority, source, causality, evidence y timestamps;
- permite compensating events, nunca edits destructivos;
- alimenta Process Mining, Project Memory, Living Graph y audit;
- registra lifecycle y decisiones sobre el owner financiero.

### 6.3 Lo que el ledger no hace

- no es una segunda tabla de saldos editable;
- no reemplaza el owner vigente sin contrato de reconstrucción aprobado;
- no contiene una copia alternativa de cada report row;
- no permite que UI o Isabella inserten eventos ad hoc fuera del ingestion contract;
- no acepta un `financial_event_log`, `budget_history_log` o `procurement_event_ledger` paralelo.

## 7. Límite de status, lifecycle y health

No se creará un `financial-status-engine` independiente.

Las responsabilidades quedan separadas:

| Dimensión | Owner |
|---|---|
| Execution status | Existing `src/lib/execution/status-engine.ts` |
| Task activity/terminal/blocker semantics | Existing `src/lib/execution/task-activity.ts` |
| Project rollups | Existing `src/lib/project-rollups/project-rollup-engine.ts` |
| Financial object lifecycle | Canonical financial domain + CEL + deterministic lifecycle resolver |
| Financial health/variance | Existing health/rollup architecture consumiendo financial resolver |
| Approval state | Existing governance/approval contract + CEL |
| UI labels/colors | Presentation mapping; nunca owner |

El financial lifecycle resolver no es un segundo execution status engine: resuelve estados de negocio como draft/submitted/approved/posted/reconciled para objetos financieros. Las dimensiones execution, dependency, health y risk permanecen independientes conforme a ADR-006.

El campo legado `budget_items.status` no podrá seguir siendo simultáneamente approval state, health state y lifecycle state. Durante compatibilidad será una proyección explícita; nuevos consumers usarán los resolvers canónicos.

## 8. Límite del Living Graph

No se crearán `financial_nodes`, `budget_graph`, `cost_edges` ni un graph store paralelo.

La integración financiera:

- proyecta financial owners/events hacia `process_nodes`, `process_edges` y canonical event relationships existentes;
- reutiliza Living Graph modes/layers y navigation contracts;
- representa relaciones con WBS, tasks, milestones, risks, changes, decisions, materials, suppliers y procurement;
- no calcula saldos, forecast, status o authority dentro del renderer;
- consume los mismos resolvers que Reports, Command Center e Isabella;
- considera nodos/edges descartables y reconstruibles.

El graph puede explicar por qué cambió un costo, pero no determina cuál importe es verdadero.

## 9. Límite de Projection/Resolver y consumidores

Después del cutover, una familia de resolvers financieros será el contrato común de lectura. El nombre físico y APIs se decidirán posteriormente, pero el comportamiento queda fijado:

- lee únicamente canonical owners y external normalized records autorizados;
- no lee otra proyección como fuente;
- produce amount, currency, period, version, approval, source, freshness, confidence y evidence metadata;
- distingue `unknown`, `not_applicable`, `not_approved`, `stale`, `partial` y `reconciled`;
- jamás sustituye forecast faltante por actual;
- publica compatibility totals para consumidores legacy;
- es determinístico e idempotente;
- no muta business data.

Consumers obligatorios:

| Consumer | Comportamiento target |
|---|---|
| Budget UI | Consume financial workspace resolver; material estimate sigue como subvista |
| Reports | Consume dataset resolver común, sin fórmulas de truth duplicadas |
| Command Center | Muestra unknown/incomplete en ausencia de datos; no health 100 por vacío |
| Closeout | Consume un snapshot reconciliado; no mezcla fallback de tablas |
| Status Report | Evalúa calidad/aprobación, no solo row count |
| Living Graph | Consume graph/financial projections, nunca raw truth para cálculo |
| Process Mining | Consume `project_event_log`, no estados inferidos desde UI |
| Isabella | Usa tools gobernadas sobre resolvers; read-only con evidence |
| Export/Search | Exporta owner + provenance/version; search no decide business truth |

## 10. Estrategia de evolución aditiva

### Etapa C0 — Freeze semántico

- aprobar P0-T1 a P0-T4;
- documentar que Budget UI actual es estimate layer;
- prohibir nuevas interpretaciones de campos legacy como baseline/actual/forecast oficiales;
- no cambiar schema o runtime antes de G6.

### Etapa C1 — Inventory y clasificación

- inventariar cada fila y link existente;
- clasificar origen, evidencia, moneda y calidad;
- marcar conceptualmente `legacy_unapproved`, `unknown` o `reference_only`;
- nunca fabricar approval, period, source ID o reconciliation.

### Etapa C2 — Extensión aditiva

Después de G6:

- añadir únicamente campos/relaciones/constraints necesarios alrededor de owners existentes;
- preservar PK/FK y URLs actuales;
- añadir source identity, version, effective period, authority y evidence;
- registrar event contracts en el registry existente;
- añadir resolvers sin cambiar inicialmente consumers productivos.

### Etapa C3 — Backfill controlado

- backfill con operation ID e idempotencia;
- conservar raw source y provenance;
- valores sin evidencia permanecen unknown/unapproved;
- eventos históricos inferidos se etiquetan como backfill, nunca como observación directa;
- no crear aprobaciones históricas sintéticas.

### Etapa C4 — Shadow reconciliation

- calcular owners target y compatibility projections en paralelo de lectura;
- comparar row counts, IDs, links, currencies y totals;
- registrar diferencias sin cambiar todavía la UI productiva;
- resolver discrepancies por policy, no por overwrite automático.

### Etapa C5 — Owner-write + projection update

- toda nueva transacción escribe una vez al owner canónico mediante gateway autorizado;
- el mismo boundary emite el evento canónico y actualiza/invalida proyecciones;
- compatibility fields se recalculan, no se editan como segunda verdad;
- no existe dual-write hacia dos owners independientes.

### Etapa C6 — Consumer cutover

- migrar Budget UI, Reports, Command Center, Closeout, Status, Graph e Isabella por feature gate;
- cada consumer usa el mismo resolver;
- medir parity/freshness/errors antes de ampliar alcance;
- permitir rollback a legacy read sin perder escrituras canónicas.

### Etapa C7 — Legacy lock

- convertir summary fields legacy en read-only projections cuando todos sus writers hayan migrado;
- bloquear writes directos y documentar owner/resolver;
- conservar campos mientras existan consumers o exports compatibles.

### Etapa C8 — Cleanup gobernado

- retirar solamente writers/resolvers duplicados comprobados;
- no eliminar datos históricos ni IDs referenciados;
- cualquier cambio destructivo requiere ADR, migration plan, backup, rollback y aprobación posterior.

## 11. Reglas de compatibilidad

1. **Stable identity:** IDs existentes se preservan.
2. **Stable scope:** organization/project ownership no cambia silenciosamente.
3. **Stable links:** task, milestone, material, supplier, drawing, risk y procurement links se conservan.
4. **No synthetic truth:** cero/null/planned/import/template no se promueven a approved.
5. **Additive first:** nuevas capacidades se añaden alrededor de owners existentes.
6. **One write owner:** cada transaction gateway escribe un solo owner.
7. **Derived legacy totals:** summary fields existentes se recalculan desde owners target.
8. **No silent fallback:** unknown permanece unknown.
9. **No consumer-specific formula:** todas las vistas consumen resolver común.
10. **Versioned contract:** schema/event/resolver/policy versions quedan trazables.
11. **Idempotent integration:** source system + source transaction + version identifican una entrada.
12. **Compensating correction:** una corrección financiera no borra historia.
13. **Currency integrity:** no se suman monedas sin conversion policy/provenance.
14. **Period integrity:** transaction date, posting period, effective date y payment date no se confunden.
15. **Authority snapshot:** approval/delegation se preserva al momento de la acción.
16. **Reversible rollout:** feature gates y shadow comparison permiten rollback de lectura.

## 12. Anti-patterns prohibidos

| Anti-pattern | Sustituto obligatorio |
|---|---|
| Crear `financial_event_log` | Extender event registry y escribir en `project_event_log` |
| Crear `financial_status_engine` | Extender financial lifecycle resolver + existing status/health owners |
| Crear `financial_graph_nodes/edges` | Proyectar en `process_nodes`/`process_edges` y existing event relationships |
| Crear otra tabla editable de actual totals | `cost_actuals` como detalle + compatibility rollup |
| Crear commitment manual separado de procurement | Evolucionar `procurement_items` y resolver commitments |
| Tratar `material_requirements` como approved budget | Mantener estimate/BOE y aprobar mediante financial domain |
| Usar `budget_items.status='approved'` como evidencia suficiente | Approval record + authority + CEL event + version |
| Actual como fallback de forecast | `forecast=unknown` hasta forecast aprobada |
| Health 100 cuando no hay budget | `unknown/incomplete` con freshness/quality |
| UI calculando business truth | Resolver determinístico compartido |
| Graph calculando saldo/status | Graph consume projection |
| Isabella consultando tablas y decidiendo | Governed read-only tool sobre resolver |
| Metadata como ledger | Campos/records tipados + event evidence |
| Dual-write a legacy y target como owners | Owner-write único + compatibility projection |
| Migración que reemplaza IDs | Stable identity + mapping explícito |

## 13. Decision tree para cualquier objeto nuevo

Antes de crear tabla, servicio o engine:

1. **¿Representa un business fact distinto?** Si no, no crear.
2. **¿Ya existe un owner?** Extenderlo aditivamente.
3. **¿La autoridad es externa?** Crear/usar CLR con source identity; no disputar autoridad.
4. **¿Es historia/lifecycle?** Usar `project_event_log`.
5. **¿Es cálculo, total, KPI o vista?** Crear resolver/DRM descartable.
6. **¿Es relación visual/analítica?** Proyectar al Living Graph existente.
7. **¿Es execution/dependency/health/risk status?** Reutilizar status/health owners existentes.
8. **¿Es approval/RACI?** Reutilizar governance primitives y P0-T3.
9. **¿Puede reconstruirse desde owner?** Marcarlo projection; prohibir que se vuelva owner.
10. **¿Crea una segunda verdad?** Rechazar y elevar a ADR/Product Owner.

## 14. Gates de reconciliación y cutover

| Gate | Evidencia mínima |
|---|---|
| Identity parity | 100% de IDs legacy preservados o mapped con razón explícita |
| Scope parity | 0 cross-org/cross-project mismatches |
| Link parity | Tasks, milestones, materials, procurement y source refs conservados |
| Amount reconciliation | Totals por currency/period/cost code explicados; tolerancia aprobada |
| Approval integrity | 0 legacy rows promovidas sin evidencia |
| Actual integrity | `budget_items.actual_cost` coincide con resolver o queda marcado legacy/unknown |
| Commitment integrity | `committed_cost` reconciliado con procurement source |
| Forecast integrity | 0 fallbacks actual→forecast |
| Event integrity | Idempotencia, sequence, actor, evidence y compensations validados en CEL |
| Status integrity | Lifecycle, execution, health y approval no conflated |
| Graph integrity | Financial graph reconstruible y sin afectar owners |
| Consumer parity | Budget/Reports/Command Center/Closeout usan el mismo resolver |
| Security/SoD | P0-T3 enforced y negative tests pasan |
| Rollback | Legacy read path recuperable sin pérdida de canonical writes |

Ningún gate se considera aprobado con screenshots solamente. Requiere pruebas determinísticas, reconciliation report y evidencia de datos.

## 15. Escenarios de validación

| Escenario | Resultado esperado | Resultado del boundary |
|---|---|---|
| Import/template budget item planned y en cero | Conservar; clasificar unapproved/unknown | PASS |
| Material takeoff tiene costo pero no budget link | Sigue como estimate; no crea baseline | PASS |
| Finance envía actual con external transaction ID repetido | Idempotent CLR; no duplicar actual/event | PASS |
| Actual corregido después de posting | Compensating/reversal record + CEL event | PASS |
| Procurement quote existe sin PO aprobado | No contribution a commitment | PASS |
| PO aprobado cambia por amendment | Nueva versión/evento; commitment resolver recalcula | PASS |
| `forecast_cost` nulo | Resolver devuelve unknown, nunca actual | PASS |
| Consumer legacy necesita `actual_cost` total | Recibe CP derivada; no write directo | PASS |
| Command Center no tiene budget | Health unknown/incomplete, no 100 | PASS |
| Developer propone `financial_event_log` | Rechazar; usar `project_event_log` | PASS |
| Developer propone `financial-status-engine` | Rechazar; usar lifecycle resolver + owners existentes | PASS |
| Developer propone financial graph tables | Rechazar; usar existing graph projection | PASS |
| Living Graph recibe financial event | Proyecta relación; no calcula saldo | PASS |
| Budget UI y Report muestran el mismo project | Ambos consumen mismo resolver y totals coinciden | PASS |
| Isabella recomienda baseline change | Puede explicar/recomendar; no write/approve | PASS |
| Backfill no encuentra approval evidence | Mantiene unapproved; no inventa evento directo | PASS |
| Cutover falla en Report | Feature gate revierte lectura; canonical write permanece | PASS |
| Campo legacy ya no tiene writers | Lock read-only; mantener para compatibilidad | PASS |

## 16. Decisiones P0-T4

| ID | Decisión | Estado |
|---|---|---|
| P0-T4-D1 | Cada financial business fact tendrá un solo owner. | Aprobada |
| P0-T4-D2 | `budget_items` se conserva y evoluciona aditivamente; sus amount fields legacy pasan gradualmente a projections. | Aprobada |
| P0-T4-D3 | `cost_actuals` se conserva como base del actual-detail local normalizado. | Aprobada |
| P0-T4-D4 | `material_requirements` permanece estimate/material truth, no approved budget. | Aprobada |
| P0-T4-D5 | `procurement_items` se conserva y evoluciona hacia commitment semantics; no procurement paralelo. | Aprobada |
| P0-T4-D6 | `project_event_log` es el único financial lifecycle/event ledger. | Aprobada |
| P0-T4-D7 | No se crea un segundo status engine; lifecycle financiero y health reutilizan owners existentes. | Aprobada |
| P0-T4-D8 | No se crea un segundo graph; toda integración financiera es projection en Living Graph existente. | Aprobada |
| P0-T4-D9 | Reports, UI, Closeout, Command Center e Isabella consumen un resolver financiero común. | Aprobada |
| P0-T4-D10 | Existing approval/RACI primitives se reutilizan conforme a P0-T3. | Aprobada |
| P0-T4-D11 | Legacy data sin evidencia no se promueve a approved truth. | Aprobada |
| P0-T4-D12 | La migración será additive, idempotent, shadow-reconciled, feature-gated y reversible. | Aprobada |
| P0-T4-D13 | Owner-write único reemplaza cualquier dual-write entre verdades. | Aprobada |
| P0-T4-D14 | No se implementa schema/runtime antes de G6. | Vigente |

## 17. Evidencia de alineación

| Evidencia | Ubicación |
|---|---|
| Contrato y aceptación P0-T4 | `Project360/ProjectOps360_Budget_Cost_Management_Workplan_v1.json:151` |
| Canonical Source of Truth y one owner per fact | `docs/product-brain/00-product-constitution.md:30` |
| Project Event Graph append-only | `docs/product-brain/00-product-constitution.md:41` |
| Projection y Living Graph nunca owners | `docs/product-brain/00-product-constitution.md:55` |
| Guardrail: no projection becomes source of truth | `docs/product-brain/00-product-constitution.md:162` |
| `project_event_log` immutable y additive | `supabase/migrations/20260830000000_project_event_log.sql:2` |
| Event Ingestion Service canónico | `src/lib/events/ingestion.ts:537` |
| Execution Status Engine single source | `src/lib/execution/status-engine.ts:1` |
| ADR-006: un solo status engine | `docs/product-brain/adrs/ADR-006-independent-status-dimensions.md:11` |
| Living Graph como projection, no owner | `docs/product-brain/12-living-graph-strategy.md:171` |
| Auditoría current-state y producción | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:18` |
| Current object/consumer inventory | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:103` |
| Current security y authority gaps | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:275` |
| Financial RACI y SoD | `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md:104` |

## 18. Matriz de aceptación P0-T4

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe current-to-target ownership map | PASS | Secciones 4 y 5 |
| Cada business fact tiene un solo owner | PASS | Secciones 2 y 4 |
| `budget_items` evoluciona aditivamente | PASS | Secciones 5.1, 5.2 y 10 |
| `cost_actuals` evoluciona aditivamente | PASS | Sección 5.3 |
| Materials mantiene su semántica de estimate | PASS | Sección 5.4 |
| Procurement evoluciona aditivamente | PASS | Secciones 5.1 y 5.5 |
| No se introduce un segundo event ledger | PASS | Sección 6 y P0-T4-D6 |
| No se introduce un segundo status engine | PASS | Sección 7 y P0-T4-D7 |
| No se introduce un segundo graph | PASS | Sección 8 y P0-T4-D8 |
| No se introduce una segunda financial truth | PASS | Secciones 2, 4 y 12 |
| Existing approval/RACI se reutiliza | PASS | Sección 5.6 y P0-T4-D10 |
| Consumers migran a resolver común | PASS | Sección 9 |
| Legacy values no se promueven sin evidencia | PASS | Secciones 5.2, 10 y 11 |
| Migración es reversible e idempotente | PASS | Secciones 10, 11 y 14 |
| Se definieron anti-patterns y decision tree | PASS | Secciones 12 y 13 |
| Los escenarios validan boundaries positivos y negativos | PASS | Sección 15 |
| No se autorizó implementación antes de G6 | PASS | Control del documento y P0-T4-D14 |
| Cumple el criterio original de aceptación | **PASS** | Existing budget/procurement evolucionan aditivamente; no second ledger/status/graph/truth |

## 19. Control de cambio y handoff

P0-T4 fija ownership y compatibilidad, no el modelo físico final. P1 definirá verdades y lenguaje financiero; fases posteriores definirán contracts, lifecycle, event taxonomy, security enforcement, APIs y UI. Cualquier propuesta que cambie estos boundaries debe elevarse como ADR y decisión del Product Owner antes de implementación.

P0-T5 utilizará este mapa junto con P0-T3 para construir use cases sobre owners reales, sin asignar autoridad a consumidores ni convertir proyecciones en hechos.

## Nota de cierre lista para ProjectOps360°

P0-T4 completada y validada. Se definió el current-to-target ownership map con un owner único por business fact. `budget_items` conserva identidad y links, pero sus amount fields legacy evolucionarán gradualmente a compatibility projections; `cost_actuals` se conserva como base del actual-detail local normalizado; `material_requirements` permanece estimate/material truth y nunca approved budget; `procurement_items` se conserva y evoluciona aditivamente hacia commitment semantics. `project_event_log` queda como único ledger inmutable; `status-engine.ts`, task activity, health y rollups continúan como owners de status/health; `process_nodes`, `process_edges` y Living Graph siguen siendo proyecciones, nunca verdad financiera. Budget UI, Reports, Command Center, Closeout, Process Mining e Isabella deberán consumir un resolver financiero común. Se prohibieron financial event ledgers, status engines, graph stores, actual totals, procurement modules y approval/RACI systems paralelos. La transición aprobada es additive, stable-ID, idempotent, shadow-reconciled, feature-gated y reversible; legacy data sin evidencia permanece unapproved/unknown y no se fabrican approvals. Se aprobaron 14 decisiones, se validaron 18 escenarios y todos los criterios de aceptación pasaron. No se modificó código, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md`.
