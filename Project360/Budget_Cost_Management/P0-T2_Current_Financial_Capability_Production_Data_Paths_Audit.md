# P0-T2 — Auditoría de capacidad financiera actual y rutas de datos de producción

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P0 — Discovery, charter and governance baseline |
| Tarea | P0-T2 — Audit current financial capability and production data paths |
| Versión | 1.0 |
| Fecha de auditoría | 2026-07-20 |
| Owner | Product Architecture |
| Accountable | PMO / Project Controls Lead |
| Consultados | Engineering; Finance / Controller; Security |
| Estado del entregable | **COMPLETADO Y VALIDADO COMO BASELINE DE ESTADO ACTUAL** |
| Efecto | Informa P0-T4 y tareas posteriores; **no autoriza arquitectura ni implementación** |

## 1. Dictamen ejecutivo

ProjectOps360° dispone de una **fundación técnica útil para estimación y señales financieras**, pero no posee todavía un Project Financial Control Engine capaz de gobernar profesionalmente funding, original budget, current baseline, commitments, actuals, accruals, forecast, reservas, cambios, cash flow y payments.

La auditoría comprobó dos rutas productivas distintas y no reconciliadas:

1. **Ruta de estimación de materiales:** Drawing Intelligence, importación o edición manual producen `material_requirements`; la pantalla denominada Budget lee y modifica exclusivamente esos estimados.
2. **Ruta de partidas resumidas:** templates e importaciones producen `budget_items`; Reports, Command Center, Closeout y Status consumen total o parcialmente esas partidas.

No existe una ruta productiva operativa para `cost_actuals` ni para `procurement_items`. Tampoco existe una regla demostrada que derive o reconcilie `budget_items.actual_cost` desde `cost_actuals`, ni `budget_items.committed_cost` desde procurement. En consecuencia, la plataforma contiene columnas financieras, pero no una única verdad financiera controlada.

El snapshot de producción confirma el diagnóstico:

- 38 `budget_items`, todos en estado `planned`, todos con importes estimados, comprometidos y reales en cero, y todos con `forecast_cost` nulo;
- 0 `cost_actuals`;
- 61 `material_requirements` con USD 9,964.65 de estimación, pero ninguno vinculado a `budget_items`;
- 0 `procurement_items`;
- 24 nodos financieros en Living Graph, todos provenientes de `material_requirements`;
- 0 eventos financieros canónicos en `project_event_log`;
- el proyecto Budget & Cost Management Engine no contiene todavía datos financieros de prueba.

**Conclusión:** la capacidad actual debe conservarse como una capa de estimación/proyección compatible, no aceptarse como baseline financiera aprobada. La arquitectura futura deberá unificar y reconciliar estas rutas sin reemplazar abruptamente el Core existente ni crear un ledger paralelo.

## 2. Alcance y método de auditoría

### 2.1 Incluido

- esquema y tipos de `budget_items`, `cost_actuals`, `material_requirements`, `procurement_items`, cost library y vínculos con ejecución;
- writers, readers, cálculos, UI, reportes, health, closeout, importación, templates, Living Graph y eventos;
- RLS, Server Actions y fronteras actuales de autorización;
- datos reales de Supabase producción;
- datos de entrada del proyecto Budget & Cost Management Engine;
- brechas frente a la baseline P0-T1.

### 2.2 Método

1. Lectura directa de migraciones, tipos, servicios, Server Actions, páginas y pruebas existentes.
2. Búsqueda de todos los writers y consumers financieros identificables en el repositorio.
3. Consulta agregada **read-only** a Supabase producción `ocopmlnkvidvmxgiwvxw`.
4. Comparación contra las verdades, autoridades y non-goals aprobados en P0-T1.
5. Clasificación separada de capacidad implementada, capacidad poblada, capacidad gobernada y brecha.

No se consideró evidencia válida ninguna afirmación basada únicamente en memoria, nombres de pantalla o intención documental.

### 2.3 Exclusiones

Esta tarea no diseñó el modelo objetivo, no seleccionó nombres finales de tablas o eventos, no escribió código de producto, no creó migraciones, no modificó datos, no cambió RLS, no conectó Isabella y no desplegó a staging o producción.

## 3. Mapa de capacidad y rutas actuales

```text
RUTA A — ESTIMACIÓN DE MATERIALES

Drawing takeoff / Import / Roadmap / Edición manual
                    │
                    ▼
          material_requirements  ◄── cost_library_items
                    │
          ┌─────────┼───────────────┐
          ▼         ▼               ▼
      Budget UI   Closeout       Critical Path
      + PDF       fallback       / Living Graph


RUTA B — PARTIDAS RESUMIDAS

Project Import / Project Template
                    │
                    ▼
               budget_items
                    │
       ┌────────────┼───────────────┬──────────────┐
       ▼            ▼               ▼              ▼
    Reports    Command Center     Closeout      Status count


RUTAS SIN OPERACIÓN PRODUCTIVA DEMOSTRADA

cost_actuals ──X──► budget_items.actual_cost
procurement_items ──X──► budget_items.committed_cost
financial changes ──X──► canonical event ledger
```

La `X` representa una reconciliación o materialización no encontrada en código, esquema ni datos de producción.

## 4. Inventario de objetos implementados

| Objeto/capacidad | Qué existe | Writers verificados | Consumers verificados | Estado real |
|---|---|---|---|---|
| `budget_items` | Partida mutable con estimate, committed, actual, forecast, currency, status y milestone opcional | Project Import; Project Template | Reports; Command Center; Closeout; Status count; export/search | **Implementado como resumen/placeholder; no gobernado como baseline** |
| `cost_actuals` | Detalle de costo con fecha, tipo, fuente y links opcionales | Ningún writer de producto encontrado | Ningún consumer financiero encontrado | **Esquema sin ruta operativa** |
| `material_requirements` | Requerimientos, cantidades, costos estimados, evidencia, revisión, task/drawing links | Drawing costing; import; roadmap/material actions; Budget UI | Budget UI; Closeout fallback; Critical Path; Reports/materials; Living Graph | **Ruta productiva de estimación activa** |
| `procurement_items` | Solicitud/orden/entrega con costo, supplier, material y budget link | Ningún writer de producto encontrado | Critical Path lee fecha esperada de entrega | **Esquema y reader parcial; sin operación productiva** |
| `cost_library_items` | Catálogo global u organizacional de costos unitarios | Seeds; capacidad RLS para filas de organización | Drawing costing | **Activo con seeds globales; sin catálogo propio de organización** |
| `risks` | Categoría `budget` y links a task/milestone | Writers generales de riesgos | Health/reportes generales | **Sin link a budget item, reserva, cambio o exposición monetaria** |
| Budget UI | Tabla editable, subtotales, total y PDF | Actualiza `material_requirements` | Usuario del proyecto | **Estimador de materiales; no pantalla de baseline/actual/forecast** |
| Budget Health | Función pura sobre `budget_items` | N/A | Solo pruebas encontradas | **Motor existente pero no conectado a un caller productivo demostrado** |
| Command Center | Salud y señales de budget | N/A | `budget_items` | **Operativo, pero puede producir salud engañosa con datos vacíos** |
| Budget Reports | Dataset `budget_performance` | N/A | `budget_items` | **Operativo sobre resumen mutable; forecast faltante cae a actual** |
| Closeout | estimate/commitment/actual y reconciliación | N/A | `budget_items`; usa materiales si estimate total es cero | **Operativo con fallback entre dos rutas no reconciliadas** |
| Living Graph | Tipos y relaciones financieras permitidos | Writers generales de graph | Living Graph | **Vocabulario disponible; producción contiene solamente nodos de materiales** |
| Canonical Event Ledger | Envelope y lectura de eventos canónicos | Ningún writer financiero encontrado | Event projections | **Sin eventos financieros productivos** |

## 5. Evidencia por objeto y comportamiento

### 5.1 `budget_items`

La tabla implementa una sola fila mutable con:

- `estimated_cost`;
- `committed_cost`;
- `actual_cost`;
- `forecast_cost`;
- moneda y estado;
- vínculo opcional a milestone;
- metadata genérica.

No implementa explícitamente:

- funding;
- original budget separado de current baseline;
- versiones, períodos efectivos o ciclos de aprobación;
- accruals;
- ETC/EAC como verdades distintas;
- contingencia y management reserve con autoridad;
- pending/approved/rejected changes;
- cash flow y payments;
- tasas de cambio;
- Basis of Estimate y evidencia de aprobación.

Los templates crean placeholders `planned` y las importaciones crean filas `planned` con estimate/actual. Ninguno establece una baseline aprobada, versión, período o autoridad. Por ello, el nombre de la tabla no prueba que sus filas sean presupuesto aprobado.

### 5.2 `cost_actuals`

El esquema puede registrar montos por fecha, tipo, fuente y vínculos opcionales a partida, tarea y recurso. Sin embargo:

- no se encontró writer de producto;
- no se encontró consumer financiero;
- producción contiene cero filas;
- `budget_items.actual_cost` existe al mismo tiempo como campo mutable;
- no se encontró trigger, job, transacción o regla de rollup que mantenga ambas representaciones reconciliadas.

Esto crea un riesgo de **doble fuente de actuals** si ambas rutas se activan sin un contrato previo. P0-T4 deberá decidir cuál es la verdad detallada y cuál es solamente una proyección derivada.

### 5.3 `material_requirements` y Budget UI

Drawing Intelligence promueve takeoffs a `material_requirements`, busca costos unitarios en `cost_library_items` y calcula `quantity × unit_cost`. La UI Budget:

- consulta únicamente `material_requirements` del proyecto;
- agrupa por `metadata.category`;
- suma `estimated_total_cost`;
- fija la moneda presentada a `USD`;
- permite editar quantity y unit cost;
- no consulta `budget_items`, `cost_actuals` ni `procurement_items`.

La Server Action usa un admin client después de autenticar el contexto de organización. Lee y actualiza por `materialId + organization_id`, pero no limita la fila por el `projectId` recibido ni verifica un rol financiero. Por tanto, un miembro con acceso a la acción podría modificar dentro de la misma organización una fila perteneciente a otro proyecto si conoce su UUID. La acción tampoco produce un evento financiero ni una llamada explícita de audit logging.

La ruta debe preservarse como **estimate layer**. No debe promoverse silenciosamente a original budget o current baseline.

### 5.4 `procurement_items`

El esquema contiene estados de compra/entrega y vínculos a material, supplier y budget item. El único consumer de producto encontrado usa `expected_delivery_date` para restricciones de Critical Path. No se encontró writer de producto, flujo de contratos/PO, aprobación, modificación contractual ni rollup de commitment.

Por tanto, `budget_items.committed_cost` no tiene una procedencia contractual demostrada y no puede tratarse todavía como compromiso oficial.

### 5.5 Cost library

El catálogo acepta seeds globales y overrides por organización. El provider actual alimenta la estimación de materiales. En producción existen 34 filas globales, todas `source=seed`, USD y ninguna fila específica de organización. La migración las describe como costos residenciales aproximados de EE. UU.; no son cotizaciones, contratos ni actuals.

### 5.6 Health, Reports y Closeout

- La función `calculateProjectHealth` devuelve budget `unknown` cuando no hay partidas, pero no se encontró caller productivo fuera de sus pruebas.
- Command Center devuelve budget health `100` cuando no existen partidas y puede considerar una fila cero como señal `Stable`.
- Reports y Command Center usan `forecast_cost`; si es nulo, sustituyen `actual_cost` para calcular variación/señal.
- Closeout toma estimate de `budget_items`; si el total es cero, utiliza `material_requirements.estimated_total_cost` como fallback, mientras commitments y actuals siguen viniendo de `budget_items`.
- Status solamente verifica si existe al menos una fila de `budget_items`; no valida importe, aprobación, calidad o reconciliación.

El fallback `forecast = actual` contradice el non-goal P0-T1 que prohíbe tratar gasto histórico como forecast final. La mezcla de estimate desde materiales con actuals desde budget items tampoco constituye reconciliación.

### 5.7 Living Graph y Canonical Events

El esquema permite:

- source entities `budget_items`, `material_requirements` y `procurement_items`;
- node types `budget_event`, `material_event` y `procurement_event`;
- edge types `impacts_cost` e `impacts_procurement`.

La producción contiene 24 nodos relacionados con objetos financieros, todos de `material_requirements`. No hay nodos de budget/procurement ni eventos financieros canónicos en `project_event_log`. El vocabulario existe, pero el lifecycle financiero todavía no es reconstruible ni auditable mediante eventos.

## 6. Snapshot de Supabase producción

Snapshot read-only: `2026-07-21T03:40:32.458Z` (`2026-07-20 21:40 MDT`). Proyecto Supabase: `ocopmlnkvidvmxgiwvxw`.

### 6.1 Resumen global

| Dato | Resultado |
|---|---:|
| Proyectos activos consultados | 131 |
| `budget_items` activos | 38 |
| Proyectos con `budget_items` | 4 |
| Total `estimated_cost` | 0.00 |
| Total `committed_cost` | 0.00 |
| Total `actual_cost` | 0.00 |
| `forecast_cost` no nulo | 0 |
| `cost_code` no nulo | 0 |
| `milestone_id` no nulo | 0 |
| Estado de los 38 budget items | `planned` |
| Origen de budget items | 28 import; 10 template |
| `cost_actuals` activos | 0 |
| `material_requirements` activos | 61 |
| Proyectos con materials | 4 project IDs |
| Estimado total de materials | USD 9,964.65 |
| Materials vinculados a budget item | 0 |
| Materials vinculados a task | 34 |
| Materials vinculados a supplier | 0 |
| Materials que requieren revisión | 35 |
| Origen de materials | 27 drawing extraction; 24 import; 10 manual |
| Estado de materials | 37 required; 24 planned |
| `procurement_items` activos | 0 |
| Cost library | 34 globales; 0 de organización; 34 seed; USD |
| Nodos financieros en Living Graph | 24; todos `material_requirements` |
| Eventos financieros canónicos | 0 |

### 6.2 Proyecto de esta iniciativa

Proyecto auditado: `projectops360-budget-cost-management-engine` (`07eb1a10-7b17-404b-992e-524db190de3c`).

| Objeto | Filas activas |
|---|---:|
| `budget_items` | 0 |
| `cost_actuals` | 0 |
| `material_requirements` | 0 |
| `procurement_items` | 0 |
| Nodos financieros | 0 |

El archivo de importación aprobado contiene 10 milestones, 64 tasks, 1 dependency, 0 resources, 0 materials, 0 budget items y 6 risks. Es un workplan de discovery/arquitectura, no un fixture financiero. La ausencia de datos financieros es coherente con el gate G6, pero significa que las pruebas funcionales posteriores requerirán datos controlados antes de validar cálculos.

## 7. Mapa de fuentes de verdad actuales

| Verdad requerida por P0-T1 | Fuente actual encontrada | Autoridad demostrada | Dictamen |
|---|---|---|---|
| Funding | Ninguna | Ninguna | **Missing** |
| Original Budget | Ninguna versión aprobada | Ninguna | **Missing** |
| Current Baseline | `budget_items` no versionado | Miembros de organización pueden CRUD | **No confiable como baseline** |
| Estimate / BOE | `material_requirements` + cost library; `budget_items.estimated_cost` | Miembros de organización/import/template | **Dos rutas no reconciliadas** |
| Commitments | `budget_items.committed_cost`; `procurement_items` vacío | No demostrada | **Campo sin fuente contractual** |
| Actual Cost | `budget_items.actual_cost`; `cost_actuals` vacío | No demostrada | **Doble modelo, sin ruta oficial** |
| Accruals | Ninguna | Finance no integrado | **Missing** |
| Forecast | `budget_items.forecast_cost` nullable | No workflow de forecast | **Campo sin lifecycle; consumers caen a actual** |
| ETC / EAC | No separados | Ninguna | **Missing** |
| Contingency | Categoría de budget item | Sin control de reserva | **Insuficiente** |
| Management Reserve | Ninguna | Ninguna | **Missing** |
| Changes | Ninguna relación financiera formal | Ninguna | **Missing** |
| Cash Flow | Ninguna | Ninguna | **Missing** |
| Payments | Ninguna | Ninguna | **Missing** |
| Financial events | Vocabulario de graph; 0 eventos canónicos | Ninguna | **No operativo** |

## 8. Seguridad, gobierno y trazabilidad

### 8.1 Hallazgos

1. Las tablas del Universal Execution Model aplican RLS por pertenencia a organización, no por rol financiero: todo miembro puede SELECT/INSERT/UPDATE/DELETE.
2. No existe separación demostrada entre PMO, Finance, Procurement, Sponsor y PM delegado.
3. `budget_items.status='approved'` no exige aprobación, evidencia, versión ni approver.
4. No hay controles de segregación de funciones para baseline, actuals, commitments o reservas.
5. La Budget Server Action usa service role y no verifica el proyecto de la fila en la lectura/actualización.
6. Los triggers identificados actualizan `updated_at`; no preservan un historial financiero inmutable.
7. No existe emisión financiera demostrada hacia el Canonical Event Ledger.

### 8.2 Riesgo

La seguridad actual es adecuada para colaboración general por organización, pero no para control financiero profesional. Activar baseline, actuals o commitments sobre estas políticas permitiría modificaciones incompatibles con la autoridad aprobada en P0-T1.

## 9. Registro de hallazgos

| ID | Severidad | Hallazgo | Impacto |
|---|---|---|---|
| P0-T2-F01 | Critical | No existen original budget y current baseline versionados y aprobados | No puede establecerse una baseline auditable |
| P0-T2-F02 | Critical | `actual_cost` existe en `budget_items` y `cost_actuals` sin reconciliación | Riesgo de doble contabilización o divergencia |
| P0-T2-F03 | Critical | No existe ruta oficial de actuals/accruals desde Finance | La aplicación no conoce costo incurrido confiable |
| P0-T2-F04 | Critical | No existe ruta contractual de commitments desde Procurement | Commitment y exposure no son confiables |
| P0-T2-F05 | High | Budget UI modifica estimaciones de materiales, no presupuesto aprobado | Riesgo de confundir estimate con baseline |
| P0-T2-F06 | High | RLS permite CRUD financiero a cualquier miembro de organización | No cumple autoridad PMO ni segregación de funciones |
| P0-T2-F07 | High | Budget action con admin client no valida `project_id` de la fila | Riesgo de actualización cross-project dentro de la organización |
| P0-T2-F08 | High | Reports/Command Center sustituyen forecast faltante por actual | Viola P0-T1 y puede ocultar costo futuro |
| P0-T2-F09 | High | No hay eventos financieros canónicos ni lifecycle inmutable | No hay reconstrucción, Process Mining ni auditoría completa |
| P0-T2-F10 | High | Command Center puede presentar budget health 100 sin budget | Falsa señal de salud |
| P0-T2-F11 | High | Funding, accruals, reserves, changes, cash flow y payments faltan | Cobertura financiera incompleta |
| P0-T2-F12 | Medium | Closeout mezcla estimate de materials con actual/commitment de budget items | Totales provienen de rutas distintas sin reconciliación |
| P0-T2-F13 | Medium | Cost library productiva contiene solo seeds globales aproximados | Costos no equivalen a quotes, contratos o mercado validado |
| P0-T2-F14 | Medium | Risks no enlazan budget item, reserva, cambio ni exposición monetaria | Impacto financiero de riesgo no es trazable |
| P0-T2-F15 | Medium | El proyecto de la iniciativa no tiene fixture financiero | No se pueden validar cálculos financieros todavía |

## 10. Restricciones de compatibilidad para P0-T4 y arquitectura posterior

Estas restricciones son conclusiones de auditoría, no autorización de implementación:

1. **Preservar la experiencia actual:** `material_requirements` y Budget UI deben mantenerse como estimate layer durante la transición.
2. **No declarar baseline por nombre:** ninguna fila existente de `budget_items` será original budget o current baseline sin versión, aprobación, período efectivo, procedencia y autoridad.
3. **Una sola verdad para actuals:** `cost_actuals` puede evaluarse como detalle importado/reconciliado; `budget_items.actual_cost` deberá ser una proyección derivada o entrar en una transición explícita, nunca una segunda verdad manual.
4. **Una sola verdad para commitments:** procurement/contract data deberá reconciliar compromisos; `committed_cost` no podrá mantenerse como número independiente sin evidencia.
5. **Estimate no equivale a funding/budget:** material takeoff y cost library alimentarán BOE/estimate, no autorización financiera automática.
6. **Forecast explícito:** eliminar conceptualmente el fallback `actual = forecast`; ausencia de forecast debe representarse como unknown/incomplete.
7. **No falsa salud:** health/reporting deberán diferenciar no-data, estimate-only, unapproved, stale y reconciled.
8. **Autoridad antes de escritura:** PMO/Finance/Procurement/Sponsor/delegated PM deberán aplicarse mediante contratos y políticas verificables antes de habilitar operaciones.
9. **Eventos sin segundo ledger:** el Canonical Event Ledger registrará lifecycle, evidencia y transiciones; no duplicará el ledger financiero de detalle.
10. **Migración aditiva y reversible:** no borrar, reemplazar ni reinterpretar datos existentes sin mapping, compatibilidad y reconciliación aprobados.
11. **Moneda y período obligatorios:** todo importe objetivo requerirá moneda, período/effective date y reglas de conversión cuando aplique.
12. **Datos de prueba controlados:** antes de validar KPIs deberán existir escenarios con baseline, commitments, actuals, accruals, changes, reserves y forecast reconciliables.

## 11. Decisiones de baseline P0-T2

| ID | Decisión | Estado |
|---|---|---|
| P0-T2-D1 | La capacidad financiera actual se clasifica como foundation/estimating, no como Financial Control Engine. | Aprobada por evidencia |
| P0-T2-D2 | Budget UI representa estimate de materiales y debe conservar esa semántica durante la transición. | Aprobada por evidencia |
| P0-T2-D3 | `budget_items` no constituye original budget ni current baseline aprobados. | Aprobada por evidencia |
| P0-T2-D4 | No existe actualmente una fuente operativa confiable de actuals o commitments. | Aprobada por evidencia |
| P0-T2-D5 | Reports, health y closeout actuales no pueden considerarse controles financieros definitivos. | Aprobada por evidencia |
| P0-T2-D6 | La arquitectura futura deberá reconciliar rutas existentes de forma aditiva y evitar ledgers paralelos. | Constraint para P0-T4 |
| P0-T2-D7 | La implementación continúa bloqueada hasta G6 conforme a P0-T1. | Vigente |

## 12. Evidencia técnica principal

| Evidencia | Ubicación |
|---|---|
| Tablas budget, actuals, materials y procurement | `supabase/migrations/20260708000000_universal_execution_model.sql:179` |
| Links de tasks a budget item | `supabase/migrations/20260708000000_universal_execution_model.sql:529` |
| Tipos/relaciones financieras de Living Graph | `supabase/migrations/20260708000000_universal_execution_model.sql:578` |
| RLS por miembro de organización | `supabase/migrations/20260708000000_universal_execution_model.sql:620` |
| Cost library y seeds | `supabase/migrations/20260716000000_cost_library.sql:12` |
| Import writer de budget items | `src/lib/import-intelligence/execute.ts:253` |
| Template writer de budget items | `src/lib/execution/template-service.ts:177` |
| Drawing costing → materials | `src/lib/drawing-intelligence/costing.ts:154` |
| Budget UI lee materials | `src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx:30` |
| Budget action actualiza materials | `src/app/[locale]/(app)/projects/[projectId]/budget/actions.ts:43` |
| Reports lee budget items y fallback forecast→actual | `src/lib/reports/query-service.ts:133` |
| Command Center budget health/señales | `src/lib/command-center/service.ts:131` |
| Health engine de budget | `src/lib/execution/health.ts:158` |
| Closeout y fallback a materials | `src/lib/rhythm/closeout.ts:118` |
| Status solo usa budget item count | `src/lib/execution/status-report.ts:226` |
| Procurement leído por Critical Path | `src/lib/execution/critical-path-service.ts:86` |
| Workplan importado sin datos financieros | `Project360/ProjectOps360_Budget_Cost_Management_Import_v1.json` |
| Baseline de alcance y autoridad | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md` |

## 13. Matriz de aceptación P0-T2

| Verificación | Resultado | Evidencia |
|---|---|---|
| `budget_items` fue auditado desde schema, writers, readers y producción | PASS | Secciones 4, 5.1 y 6 |
| `cost_actuals` fue auditado desde schema, referencias y producción | PASS | Secciones 4, 5.2 y 6 |
| Materials y cost library fueron auditados end-to-end | PASS | Secciones 4, 5.3, 5.5 y 6 |
| Procurement fue auditado desde schema, consumer y producción | PASS | Secciones 4, 5.4 y 6 |
| Health, Reports, Closeout, Status y Budget UI fueron trazados | PASS | Secciones 4 y 5.6 |
| Living Graph y Canonical Event path fueron auditados | PASS | Secciones 4, 5.7 y 6 |
| Seguridad y autoridad fueron auditadas | PASS | Sección 8 |
| Datos reales de producción fueron consultados read-only | PASS | Sección 6 |
| Cada brecha se deriva de código, schema o datos | PASS | Secciones 5, 7, 8 y 9 |
| No se utilizaron supuestos de memoria como evidencia | PASS | Sección 2 |
| No se escribió código, migración, UI ni datos | PASS | Sección 2.3 |
| Cumple el criterio original de aceptación | **PASS** | Todos los objetos implementados y brechas quedan evidenciados desde código/schema/producción |

## 14. Resultado y handoff

P0-T2 queda completada como baseline verificable del estado actual. Su resultado habilita el análisis de P0-T4 y tareas dependientes, pero no autoriza implementación ni resuelve todavía el modelo objetivo.

La siguiente arquitectura deberá comenzar desde estas verdades:

- el estimate de materiales funciona y debe preservarse;
- `budget_items` es un resumen/placeholder, no una baseline aprobada;
- actuals y commitments no tienen ruta productiva;
- health/reporting mezclan semánticas y requieren contrato;
- autoridad financiera y eventos aún no están implementados;
- producción no contiene datos financieros suficientes para validación de KPIs.

## Nota de cierre lista para ProjectOps360°

P0-T2 completada y validada. Se auditó la capacidad financiera actual desde código, schema y Supabase producción. El sistema posee dos rutas no reconciliadas: `material_requirements` alimenta la pantalla Budget como estimate de materiales, mientras `budget_items` es poblado por imports/templates y consumido por Reports, Command Center, Closeout y Status. Producción contiene 38 budget items en estado planned y con todos los importes en cero, 0 cost actuals, 61 materials por USD 9,964.65 sin vínculo a budget items, 0 procurement items, 24 nodos financieros provenientes únicamente de materials y 0 eventos financieros canónicos. No existe una ruta operativa confiable para actuals, accruals o commitments; tampoco baseline versionada, funding, reservas, changes, cash flow o payments. Se identificaron 15 hallazgos, incluidos doble modelo de actuals, forecast con fallback a actual, RLS sin autoridad PMO, Budget action sin validación de project_id de la fila y señales de health potencialmente engañosas. Se aprobaron restricciones para preservar la estimate layer, evitar ledgers paralelos y exigir reconciliación, versión, aprobación, período, moneda, autoridad y eventos antes de activar control financiero. Todos los criterios de aceptación pasaron. No se modificó código, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md`.
