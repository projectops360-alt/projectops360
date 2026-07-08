---
slug: screen-project-decisions
route: /projects/[projectId]/decisions
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/decisions/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/decisions/decision-list-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/decisions/actions.ts
  - src/components/decisions/create-decision-dialog.tsx
  - src/components/decisions/decision-filters.tsx
---

# EN: Project Decisions screen

The project decision log. The server page loads all non-deleted decisions for the project ordered by decision date (newest first) plus the project stakeholders for the linked-stakeholders multi-select. The client shows a filterable card list: filters by status (proposed, accepted, rejected, deferred, revoked), impact area (scope, schedule, budget, risk, quality, communication, document, other) and date range, applied client-side. A create button opens CreateDecisionDialog with title, description, rationale, decision maker, decision date, source (meeting, communication, document, manual, other, with optional source record), impact area, evidence URL, status and linked stakeholders. Server actions: createDecisionAction and updateDecisionAction write to the decisions table with per-locale i18n fields (title_i18n, description_i18n, rationale_i18n), log to audit_logs, generate a vector embedding (generateAndStoreEmbedding) for semantic search, and can create a traceability link to the source record; archiveDecisionAction soft-deletes with confirmation. Each card links to the decision detail screen. An empty state prompts creating the first decision. Related screens: decision detail (/decisions/[decisionId]), Project Memory (decisions tab) and the Charter summary (pending decisions).
Source: src/app/[locale]/(app)/projects/[projectId]/decisions/page.tsx, decision-list-client.tsx, actions.ts.
Verify: open a project and go to /projects/[projectId]/decisions.

# ES: Pantalla Decisiones del Proyecto

La bitácora de decisiones del proyecto. La página de servidor carga todas las decisiones no eliminadas ordenadas por fecha de decisión (más recientes primero) y los stakeholders del proyecto para el selector múltiple de vinculación. El cliente muestra una lista de tarjetas con filtros por estado (propuesta, aceptada, rechazada, diferida, revocada), área de impacto (alcance, cronograma, presupuesto, riesgo, calidad, comunicación, documento, otro) y rango de fechas, aplicados en el cliente. El botón de crear abre CreateDecisionDialog con título, descripción, justificación, decisor, fecha, origen (reunión, comunicación, documento, manual, otro, con registro origen opcional), área de impacto, URL de evidencia, estado y stakeholders vinculados. Acciones de servidor: createDecisionAction y updateDecisionAction escriben en la tabla decisions con campos i18n por idioma (title_i18n, description_i18n, rationale_i18n), registran en audit_logs, generan un embedding vectorial (generateAndStoreEmbedding) para búsqueda semántica y pueden crear un enlace de trazabilidad al registro origen; archiveDecisionAction hace borrado suave con confirmación. Cada tarjeta enlaza al detalle. Hay estado vacío que invita a crear la primera decisión. Relacionadas: detalle de decisión (/decisions/[decisionId]), Memoria del Proyecto (pestaña de decisiones) y resumen del Charter (decisiones pendientes).
Fuente: src/app/[locale]/(app)/projects/[projectId]/decisions/page.tsx, decision-list-client.tsx, actions.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/decisions.
