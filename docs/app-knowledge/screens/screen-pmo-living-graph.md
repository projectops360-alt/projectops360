---
slug: screen-pmo-living-graph
route: /pmo-living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/pmo-living-graph/page.tsx
  - src/components/pmo-living-graph/portfolio-graph-shell.tsx
  - src/components/pmo-intelligence/kpi-bar.tsx
  - src/components/pmo-intelligence/insights-panel.tsx
  - src/lib/pmo-intelligence/read-model.server.ts
  - src/lib/pmo-intelligence/kpi-bindings.ts
  - src/lib/pmo-intelligence/blocked-days.ts
  - src/lib/pmo-living-graph/navigation.ts
  - src/lib/pmo-living-graph/graph-algorithms.ts
  - src/lib/pmo-living-graph/flags.ts
---

# EN: PMO Intelligence Center (Dashboard 3 — PMO Living Graph) screen

The third dashboard at `/pmo-living-graph`, shown in navigation as "Dashboard 3". It is an **orchestration layer, not a new source of truth** (ADR-012): it composes what the PMO Command Center and Process Intelligence already compute and correlates them on one navigable graph. It defines no formula of its own — every number is traceable to the function that produced it, which is why the two other dashboards can never disagree with it.

Access is gated server-side by `canAccessPmoLivingGraph`: the `PMO_LIVING_GRAPH_ENABLED` flag (default OFF) **and** an owner/admin role. Anyone else gets a 404, and with the flag off the route does not exist, no query runs, and navigation is unchanged.

**Graph.** Every project is a subgraph and all projects join into one portfolio graph. Twelve node kinds are backed by real tables: organization, project, milestone, task, subtask, risk, decision, resource, team member, stakeholder, KPI, budget item. Navigation goes large to small and **isolates**: double-clicking a project hides the others, a milestone shows its tasks, a task shows its subtasks, risks, dates and costs. Breadcrumbs always show the way back. The canvas supports pan, zoom, drag with positions persisted per user and organization, search, filters, focus mode, path finding between two nodes, blast radius at 1–3 hops, critical nodes with a written explanation, orphan detection, minimap and legend.

**Relationships** are derived from real foreign keys, `task_dependencies`, `risks.linked_task_id`, `budget_items` and `traceability_links`. Exactly one is computed: `shares_resource_with`, a deterministic date-overlap over `project_resource_allocations` that reveals two projects competing for the same person — a collision no per-project dashboard can see. It is marked `INFERRED`, never `OBSERVED`, and every edge states its provenance, confidence and evidence.

**KPIs** are interactive: clicking one re-aims the dashboard rather than merely displaying a number. "Projects at risk" activates the Risk lens and selects the affected projects; "Critical nodes" enters focus mode; "Blocked days" switches to the Process lens and selects the blocked work; "Budget variance" opens Finance. Units never mix — days, money, percentages and scores render distinctly, and a metric that cannot be computed says "data unavailable" rather than showing 0.

**Lenses** (Overview, Process, Risk, Finance, Resources, Dependencies, Benefits, What-if) reproject the *same* canvas; none navigates away. Portfolio and Program filters are **disabled and labelled "not configured"** because no such tables exist, and the Benefits lens keeps an honest placeholder for the same reason. What-if reuses the existing non-persistent simulation and says so.

**Isabella** has a single entry point here. The insights panel is closed by default and opens from the graph toolbar showing its finding count; it carries the six deterministic CAP-047 rules with their full evidence package, and Accept / Reject / Defer call the existing `recordInsightFeedbackAction`, persisting to `audit_logs`. Isabella receives a minimal subgraph (anchors plus one hop, capped), never the whole graph.

Two numbers that look contradictory are not: "Projects at risk" counts distinct projects holding an open severe risk, while the health dimension "Risk score" is a 0–100 score from `clamp(100 − high×12 − otherOpen×3)`. Different questions, different units.

Related screens: PMO Command Center (Dashboard 1, the health and focus source), Process Intelligence (Dashboard 2, the flow and overlay source), and the per-project Living Graph, all of which remain unchanged.

Source: src/app/[locale]/(app)/pmo-living-graph/page.tsx, src/lib/pmo-intelligence/*, src/lib/pmo-living-graph/*.
Verify: as an owner/admin with `PMO_LIVING_GRAPH_ENABLED=true`, open /pmo-living-graph, click the "Projects at risk" KPI and confirm the Risk lens activates and the affected projects are selected; then double-click a project and confirm the others disappear.

# ES: Pantalla PMO Intelligence Center (Dashboard 3 — PMO Living Graph)

El tercer dashboard en `/pmo-living-graph`, visible en navegación como "Dashboard 3". Es una **capa de orquestación, no una nueva fuente de verdad** (ADR-012): compone lo que el PMO Command Center y Process Intelligence ya calculan y lo correlaciona sobre un grafo navegable. No define ninguna fórmula propia — cada número es trazable hasta la función que lo produjo, y por eso los otros dos dashboards nunca pueden contradecirlo.

El acceso se controla en el servidor con `canAccessPmoLivingGraph`: la flag `PMO_LIVING_GRAPH_ENABLED` (apagada por defecto) **y** rol owner/admin. El resto recibe 404, y con la flag apagada la ruta no existe, no se ejecuta ninguna consulta y la navegación queda igual.

**Grafo.** Cada proyecto es un subgrafo y todos se unen en un grafo de portafolio. Doce tipos de nodo respaldados por tablas reales: organización, proyecto, hito, tarea, subtarea, riesgo, decisión, recurso, miembro de equipo, stakeholder, KPI y partida de presupuesto. La navegación va de lo grande a lo pequeño y **aísla**: al hacer doble clic en un proyecto desaparecen los demás, un hito muestra sus tareas, y una tarea muestra sus subtareas, riesgos, fechas y costos. Las migas de pan siempre muestran el camino de vuelta. El lienzo permite desplazar, acercar, arrastrar con posiciones persistidas por usuario y organización, buscar, filtrar, modo enfoque, buscar ruta entre dos nodos, radio de impacto a 1–3 saltos, nodos críticos con explicación escrita, detección de nodos sin conexión, minimapa y leyenda.

**Las relaciones** se derivan de claves foráneas reales, `task_dependencies`, `risks.linked_task_id`, `budget_items` y `traceability_links`. Solo una se calcula: `shares_resource_with`, un solapamiento determinista de fechas sobre `project_resource_allocations` que revela dos proyectos compitiendo por la misma persona — una colisión que ningún dashboard por proyecto puede ver. Se marca `INFERRED`, nunca `OBSERVED`, y cada relación declara su procedencia, confianza y evidencia.

**Los KPIs son interactivos**: al hacer clic reorientan el dashboard en lugar de solo mostrar un número. "Proyectos en riesgo" activa el lente Riesgo y selecciona los proyectos afectados; "Nodos críticos" entra en modo enfoque; "Días bloqueados" cambia al lente Proceso y selecciona el trabajo bloqueado; "Variación de presupuesto" abre Finanzas. Las unidades nunca se mezclan — días, dinero, porcentajes y puntajes se muestran distinto — y una métrica que no puede calcularse dice "dato no disponible" en vez de mostrar 0.

**Los lentes** (Panorama, Proceso, Riesgo, Finanzas, Recursos, Dependencias, Beneficios, Simulación) reproyectan el *mismo* lienzo; ninguno navega fuera. Los filtros de Portafolio y Programa están **deshabilitados y etiquetados "no configurado"** porque no existen esas tablas, y el lente Beneficios mantiene un placeholder honesto por la misma razón. La Simulación reutiliza el motor existente no persistente y lo advierte.

**Isabella** tiene aquí un único punto de entrada. El panel de hallazgos está cerrado por defecto y se abre desde la barra del grafo mostrando su conteo; contiene las seis reglas deterministas de CAP-047 con su paquete de evidencia completo, y Aceptar / Rechazar / Diferir llaman a la acción existente `recordInsightFeedbackAction`, que persiste en `audit_logs`. Isabella recibe un subgrafo mínimo (anclas más un salto, acotado), nunca el grafo completo.

Dos números que parecen contradictorios no lo son: "Proyectos en riesgo" cuenta proyectos distintos con un riesgo severo abierto, mientras que la dimensión de salud "Puntaje de riesgo" es un puntaje 0–100 de `clamp(100 − altos×12 − otrosAbiertos×3)`. Preguntas distintas, unidades distintas.

Pantallas relacionadas: PMO Command Center (Dashboard 1, fuente de salud y foco), Process Intelligence (Dashboard 2, fuente de flujo y overlays) y el Living Graph por proyecto, que permanecen sin cambios.

Fuente: src/app/[locale]/(app)/pmo-living-graph/page.tsx, src/lib/pmo-intelligence/*, src/lib/pmo-living-graph/*.
Verifica: como owner/admin con `PMO_LIVING_GRAPH_ENABLED=true`, abre /pmo-living-graph, haz clic en el KPI "Proyectos en riesgo" y confirma que se activa el lente Riesgo y se seleccionan los proyectos afectados; luego haz doble clic en un proyecto y confirma que los demás desaparecen.
