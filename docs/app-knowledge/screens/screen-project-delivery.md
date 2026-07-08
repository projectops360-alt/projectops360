---
slug: screen-project-delivery
route: /projects/[projectId]/delivery
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/delivery/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/delivery/delivery-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/delivery/delivery-tabs.tsx
  - src/app/[locale]/(app)/projects/[projectId]/delivery/actions.ts
  - src/lib/delivery/service.ts
---

# EN: Adaptive Delivery Framework screen

Configures and runs how the project executes. If no framework is active (or with ?setup=true, linked from the Charter's "Delivery framework" button), a setup Wizard asks a diagnostic (project type, uncertainty, governance, documentation, change control, stakeholder feedback, vendor dependency, cadence); recommendFrameworkAction suggests a delivery method with confidence and board columns, which the user can override, then saveFrameworkAction persists it and activateFrameworkAction turns on execution. Once configured, four tabs appear: Overview (framework attribute cards, execution board columns with WIP limits from project_board_columns colored by live roadmap_tasks status counts, suggested meeting rhythm with scheduleFrameworkMeetingsAction creating weekly meetings in the Rhythm Center, recent project_framework_events), Backlog (project_backlog_items: add/edit, reorder, assign milestones, promote items to Workboard tasks, AI generate and prioritize backlog), Cycles (project_execution_cycles and project_cycle_items: create cycles, add backlog items, promote a whole cycle, AI cycle lessons) and AI & Health (open project_scope_creep_alerts with resolve/dismiss or convert to change request, scope check, framework health, stakeholder summary). The page also reads charter goal/objectives for context. Data written spans the framework, backlog, cycle, alert and meeting tables. Related screens: Charter, Workboard, Rhythm Center.
Source: src/app/[locale]/(app)/projects/[projectId]/delivery/page.tsx, delivery-client.tsx, delivery-tabs.tsx, actions.ts.
Verify: open a project and go to /projects/[projectId]/delivery (or /delivery?setup=true).

# ES: Pantalla Marco de Ejecución Adaptativo (Delivery)

Configura y opera cómo se ejecuta el proyecto. Si no hay marco activo (o con ?setup=true, enlazado desde el botón "Marco de ejecución" del Charter), un Asistente hace un diagnóstico (tipo de proyecto, incertidumbre, gobernanza, documentación, control de cambios, feedback de stakeholders, dependencia de proveedores, cadencia); recommendFrameworkAction sugiere un método de entrega con confianza y columnas de tablero, que el usuario puede cambiar; saveFrameworkAction lo guarda y activateFrameworkAction activa la ejecución. Ya configurado, hay cuatro pestañas: Resumen (tarjetas de atributos del marco, columnas del tablero con límites de WIP desde project_board_columns coloreadas con conteos en vivo de roadmap_tasks, ritmo de reuniones sugerido con scheduleFrameworkMeetingsAction que crea reuniones semanales en el Rhythm Center, eventos recientes de project_framework_events), Backlog (project_backlog_items: crear/editar, reordenar, asignar hitos, promover ítems a tareas del Workboard, generar y priorizar backlog con IA), Ciclos (project_execution_cycles y project_cycle_items: crear ciclos, agregar ítems, promover un ciclo completo, lecciones de ciclo con IA) e IA y Salud (alertas abiertas de project_scope_creep_alerts con resolver/descartar o convertir a solicitud de cambio, chequeo de alcance, salud del marco, resumen para stakeholders). La página también lee objetivo y objetivos del charter como contexto. Se escribe en las tablas de marco, backlog, ciclos, alertas y reuniones. Relacionadas: Charter, Workboard, Rhythm Center.
Fuente: src/app/[locale]/(app)/projects/[projectId]/delivery/page.tsx, delivery-client.tsx, delivery-tabs.tsx, actions.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/delivery (o /delivery?setup=true).
