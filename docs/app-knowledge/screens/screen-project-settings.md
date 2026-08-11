---
slug: screen-project-settings
route: /projects/[projectId]/settings
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/settings/page.tsx
  - src/lib/env.ts
---

# EN: Project Settings screen

A lightweight settings hub for one project, reached from the project's Settings tab. It is navigation, not forms: the page performs no writes at all, and it holds no toggle for anything the project owns. After validating the project against the user's organization (`notFound()` otherwise), it renders the header "Manage stakeholders, audit trail, and project metadata" and a grid of link cards: Stakeholders, carrying a live `count` from the `stakeholders` table and linking to `/projects/[projectId]/stakeholders`; Audit Log, linking to `/projects/[projectId]/audit`; and Import / Merge Project Data, which leaves the project and opens the org-level import wizard preloaded with this project (`/import?projectId=…`) to upload Excel, CSV or PDF and merge it. A fourth card, GitHub Intelligence, renders only when `isGitHubIntelligenceFlagEnabled()` is true **and** the project's `project_type` is `software_development`; otherwise it is hidden entirely rather than disabled, so a construction project shows three cards and gives no hint the integration exists. Below, a read-only Project Metadata section shows start date, target end date and creation date formatted per locale — start and target dates are omitted when null. All page copy is inline `isEs` ternaries rather than message keys. Editing, archiving and permanent deletion of the project live on the Overview header, not here. Related: screen-project-stakeholders, screen-project-audit, screen-import, screen-project-github-integration, screen-project-overview.
Source: settings/page.tsx, lib/env.ts.
Verify: open a project → Settings tab; the GitHub card only appears for software projects with the flag enabled.

# ES: Pantalla Configuración del Proyecto

Un centro ligero de configuración por proyecto; se llega desde la pestaña Settings del proyecto. Es navegación, no formularios: la página no escribe absolutamente nada y no contiene ningún interruptor de las propiedades del proyecto. Tras validar que el proyecto pertenece a la organización del usuario (si no, `notFound()`), muestra el encabezado "Gestiona stakeholders, auditoría y metadatos del proyecto" y una cuadrícula de tarjetas de enlace: Stakeholders, con un conteo en vivo de la tabla `stakeholders` y enlace a `/projects/[projectId]/stakeholders`; Registro de Auditoría, con enlace a `/projects/[projectId]/audit`; e Importar / Fusionar datos, que sale del proyecto y abre el asistente de importación de la organización precargado con este proyecto (`/import?projectId=…`) para subir Excel, CSV o PDF y fusionarlos. Una cuarta tarjeta, GitHub Intelligence, aparece solo cuando `isGitHubIntelligenceFlagEnabled()` es verdadero **y** el `project_type` del proyecto es `software_development`; en cualquier otro caso queda oculta por completo en lugar de deshabilitada, así que un proyecto de construcción ve tres tarjetas y no recibe ninguna pista de que la integración existe. Debajo, la sección de Metadatos del Proyecto es de solo lectura y muestra fecha de inicio, fecha objetivo y fecha de creación según el idioma; las dos primeras se omiten si son nulas. Todos los textos son ternarios `isEs` en línea, no claves de traducción. Editar, archivar y eliminar permanentemente el proyecto viven en el encabezado del Resumen, no aquí. Relacionadas: screen-project-stakeholders, screen-project-audit, screen-import, screen-project-github-integration, screen-project-overview.
Fuente: settings/page.tsx, lib/env.ts.
Verifica: abre un proyecto → pestaña Settings; la tarjeta de GitHub solo aparece en proyectos de software con el flag activo.
