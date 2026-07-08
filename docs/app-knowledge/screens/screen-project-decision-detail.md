---
slug: screen-project-decision-detail
route: /projects/[projectId]/decisions/[decisionId]
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/decisions/[decisionId]/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/decisions/[decisionId]/decision-detail-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/decisions/actions.ts
  - src/components/links/linked-records.tsx
---

# EN: Project Decision Detail screen

Full view of a single decision, reached by clicking a decision card in the project decision log. The server page loads the decision (decisions table), project stakeholders, and the decision's traceability links in both directions from traceability_links (source_type or target_type = "decision"). Linked-record titles are resolved by batch queries against decisions, meetings, communication_items and documents; the page also loads full catalogs of those four entity types to feed the "Add link" dialog. The detail client displays date, decision maker, source (meeting, communication, document, manual, other), evidence, description, rationale, linked stakeholders and a Linked Records section where the user can add or remove typed links (related_to, caused_by, depends_on, supersedes, derived_from, contradicts) with optional context notes. Edit and archive reuse the list-screen actions: updateDecisionAction rewrites the i18n fields, logs to audit_logs and regenerates the vector embedding; archiveDecisionAction soft-deletes after confirmation. A back link returns to the decisions list. Related screens: decisions list (/decisions), Project Memory (memory items can link to decisions) and the project audit log.
Source: src/app/[locale]/(app)/projects/[projectId]/decisions/[decisionId]/page.tsx, decision-detail-client.tsx, ../actions.ts.
Verify: open /projects/[projectId]/decisions and click any decision.

# ES: Pantalla Detalle de Decisión

Vista completa de una decisión, a la que se llega al hacer clic en una tarjeta de la bitácora de decisiones. La página de servidor carga la decisión (tabla decisions), los stakeholders del proyecto y los enlaces de trazabilidad de la decisión en ambas direcciones desde traceability_links (source_type o target_type = "decision"). Los títulos de los registros vinculados se resuelven con consultas por lote a decisions, meetings, communication_items y documents; la página también carga catálogos completos de esos cuatro tipos para el diálogo "Agregar enlace". El cliente muestra fecha, decisor, origen (reunión, comunicación, documento, manual, otro), evidencia, descripción, justificación, stakeholders vinculados y una sección de Registros Vinculados donde se pueden agregar o quitar enlaces tipificados (related_to, caused_by, depends_on, supersedes, derived_from, contradicts) con notas de contexto opcionales. Editar y archivar reutilizan las acciones de la lista: updateDecisionAction reescribe los campos i18n, registra en audit_logs y regenera el embedding vectorial; archiveDecisionAction hace borrado suave tras confirmación. Un enlace regresa a la lista. Relacionadas: lista de decisiones (/decisions), Memoria del Proyecto (los elementos de memoria pueden vincularse a decisiones) y la bitácora de auditoría.
Fuente: src/app/[locale]/(app)/projects/[projectId]/decisions/[decisionId]/page.tsx, decision-detail-client.tsx, ../actions.ts.
Verifica: abre /projects/[projectId]/decisions y haz clic en cualquier decisión.
