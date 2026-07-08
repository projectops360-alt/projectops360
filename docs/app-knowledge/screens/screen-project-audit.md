---
slug: screen-project-audit
route: /projects/[projectId]/audit
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/audit/page.tsx
  - src/lib/audit/index.ts
---

# EN: Project Audit Log screen

A read-only governance trail of who changed what in the project. The page is fully server-rendered with no client component and no write actions. It verifies the project belongs to the user's organization, then loads the 50 most recent rows from the audit_logs table for that org and project (columns: actor, action, entity type, entity id, metadata, timestamp), plus display names from the profiles table for each actor. Each entry renders as a card with a colored action badge (green create, blue update, red delete — unknown actions fall back to the update style), the localized entity-type label, an optional title from the metadata, "by <actor>" (or an unknown-actor label) and a localized date-time. Two metadata enrichments are shown: for traceability_links entries, pills with the link type and the source → target entity types; and a purple "AI" pill when metadata.source is "ai_extraction", marking records produced by AI extraction flows. An empty state with a shield icon appears when no records exist, and a breadcrumb returns to the project overview. Entries are produced by the logAudit helper called from server actions across modules (charter, decisions, documents, memory, links). Related screens: any screen whose actions write audit entries.
Source: src/app/[locale]/(app)/projects/[projectId]/audit/page.tsx.
Verify: open a project and go to /projects/[projectId]/audit.

# ES: Pantalla Bitácora de Auditoría del Proyecto

Rastro de gobernanza de solo lectura sobre quién cambió qué en el proyecto. La página se renderiza por completo en el servidor, sin componente de cliente ni acciones de escritura. Verifica que el proyecto pertenezca a la organización del usuario y carga las 50 filas más recientes de la tabla audit_logs para esa organización y proyecto (actor, acción, tipo de entidad, id, metadatos, fecha), más los nombres visibles desde la tabla profiles para cada actor. Cada entrada es una tarjeta con insignia de acción coloreada (verde crear, azul actualizar, rojo eliminar — acciones desconocidas usan el estilo de actualizar), la etiqueta localizada del tipo de entidad, un título opcional tomado de los metadatos, "por <actor>" (o etiqueta de actor desconocido) y fecha-hora localizada. Se muestran dos enriquecimientos: para entradas de traceability_links, píldoras con el tipo de enlace y los tipos origen → destino; y una píldora morada "AI" cuando metadata.source es "ai_extraction", que marca registros creados por flujos de extracción con IA. Hay estado vacío con icono de escudo cuando no hay registros, y una miga de pan regresa al resumen del proyecto. Las entradas las produce el helper logAudit invocado desde acciones de servidor de otros módulos (charter, decisiones, documentos, memoria, enlaces). Relacionadas: cualquier pantalla cuyas acciones escriban auditoría.
Fuente: src/app/[locale]/(app)/projects/[projectId]/audit/page.tsx.
Verifica: abre un proyecto y ve a /projects/[projectId]/audit.
