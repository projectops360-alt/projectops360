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
  - src/lib/delivery/config.ts
  - src/lib/delivery/recommend.ts
  - src/lib/delivery/service.ts
  - supabase/migrations/20260904000000_sap_activate_delivery_method.sql
  - supabase/migrations/20260908000000_delivery_platform.sql
---

# EN: Adaptive Delivery Framework screen

Configures and runs how the project executes. With no active framework (or `?setup=true`, linked from the Charter), a wizard asks a diagnostic: project type, uncertainty, governance, documentation, change control, stakeholder feedback, vendor dependency and cadence. For implementation-type projects only (`PLATFORM_RELEVANT_TYPES` = `erp`, `data_bi`) it also asks an optional **Platform** (SAP, Oracle, Dynamics, Salesforce, Workday, Other). `recommendFrameworkAction` runs the pure rule engine: its first and highest-precedence rule fires on `platform === "sap"` **and** `projectType === "erp"` — never on the project type alone — recommending `sap_activate` at 84% (92% under heavy governance or regulatory). A blank platform recommends nothing vendor-specific. `saveFrameworkAction` writes `project_delivery_frameworks` (including the new `platform` column) and rebuilds `project_board_columns`; `activateFrameworkAction` sets status active. Overview shows adaptive metrics from live `roadmap_tasks` counts, attribute cards, editable WIP limits, suggested `MEETING_RHYTHM` with `scheduleFrameworkMeetingsAction` writing `project_events`, and — only when the method is `sap_activate` — a panel listing the six SAP Activate phases (Discover, Prepare, Explore, Realize, Deploy, Run) with their Q0–Q5 quality gates and exit criteria. Other tabs: Backlog (`project_backlog_items`, AI generate/prioritize, AI `milestones`, promote to tasks), Cycles (`project_execution_cycles`, `project_cycle_items`) and AI & Health (`project_scope_creep_alerts`). Related: screen-project-charter, screen-project-workboard, screen-project-rhythm-center.
Source: delivery/page.tsx, delivery-client.tsx, delivery-tabs.tsx, actions.ts, src/lib/delivery/config.ts, recommend.ts.
Verify: open a project and go to /projects/[projectId]/delivery (or /delivery?setup=true); pick "ERP / System Implementation" + Platform "SAP" and press Recommend framework.

# ES: Pantalla Marco de Ejecución Adaptativo (Delivery)

Configura y opera cómo se ejecuta el proyecto. Si no hay marco activo (o con `?setup=true`, enlazado desde el Charter), un asistente hace un diagnóstico: tipo de proyecto, incertidumbre, gobernanza, documentación, control de cambios, feedback de stakeholders, dependencia de proveedores y cadencia. Solo para proyectos de implementación (`PLATFORM_RELEVANT_TYPES` = `erp`, `data_bi`) pregunta además una **Plataforma** opcional (SAP, Oracle, Dynamics, Salesforce, Workday, Otra). `recommendFrameworkAction` ejecuta el motor de reglas puro: su primera regla, la de mayor precedencia, se dispara con `platform === "sap"` **y** `projectType === "erp"` — nunca por el tipo de proyecto solo — y recomienda `sap_activate` con 84% de confianza (92% con gobernanza fuerte o regulatoria). Una plataforma sin responder no recomienda nada específico de un proveedor. `saveFrameworkAction` guarda en `project_delivery_frameworks` (incluida la nueva columna `platform`) y reconstruye `project_board_columns`; `activateFrameworkAction` activa el marco. El Resumen muestra métricas adaptativas desde los conteos vivos de `roadmap_tasks`, tarjetas de atributos, límites de WIP editables, el ritmo sugerido `MEETING_RHYTHM` con `scheduleFrameworkMeetingsAction` escribiendo en `project_events` y —solo si el método es `sap_activate`— un panel con las seis fases de SAP Activate (Descubrimiento, Preparación, Exploración, Realización, Despliegue, Soporte) con sus quality gates Q0–Q5 y criterios de salida. Otras pestañas: Backlog (`project_backlog_items`, generar/priorizar con IA, hitos con IA, promover a tareas), Ciclos (`project_execution_cycles`, `project_cycle_items`) e IA y Salud (`project_scope_creep_alerts`). Relacionadas: screen-project-charter, screen-project-workboard, screen-project-rhythm-center.
Fuente: delivery/page.tsx, delivery-client.tsx, delivery-tabs.tsx, actions.ts, src/lib/delivery/config.ts, recommend.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/delivery (o /delivery?setup=true); elige "ERP / Implementación de sistemas" + Plataforma "SAP" y pulsa Recomendar marco.
