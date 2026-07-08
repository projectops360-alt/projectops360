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

A lightweight settings hub for one project, reached from the project's Settings tab. It is mostly navigation, not forms: the page itself performs no writes. After validating the project against the user's organization, it renders a header ("Manage stakeholders, audit trail, and project metadata") and a grid of quick-link cards: Stakeholders (with a live count from the stakeholders table, linking to /projects/[projectId]/stakeholders), Audit Log (linking to /projects/[projectId]/audit), and Import / Merge Project Data, which links to the org-level import wizard preloaded for this project (/import?projectId=...) to upload Excel, CSV or PDF files and merge them into the project. A fourth card, GitHub Intelligence, appears only when the GITHUB_INTELLIGENCE_ENABLED feature flag is on and the project's project_type is software_development; it links to /projects/[projectId]/settings/integrations/github and is hidden entirely otherwise. Below, a Project Metadata section shows read-only cards for start date, target end date and creation date, formatted per locale. Data read: projects (id, slug, title, status, dates, project_type) and a stakeholders count. Related screens: Stakeholders, Audit trail, Project Import, GitHub integration settings, Project Overview (where project editing/archiving lives).
Source: settings/page.tsx, lib/env.ts.
Verify: open a project → Settings tab; the GitHub card only shows for software projects with the flag enabled.

# ES: Pantalla Configuración del Proyecto

Un centro ligero de configuración por proyecto; se llega desde la pestaña Settings del proyecto. Es sobre todo navegación, no formularios: la página en sí no escribe nada. Tras validar que el proyecto pertenece a la organización, muestra un encabezado ("Gestiona stakeholders, auditoría y metadatos del proyecto") y una cuadrícula de tarjetas de acceso rápido: Stakeholders (con conteo en vivo de la tabla stakeholders, enlaza a /projects/[projectId]/stakeholders), Registro de Auditoría (enlaza a /projects/[projectId]/audit) e Importar / Fusionar datos, que lleva al asistente de importación de la organización precargado para este proyecto (/import?projectId=...) para subir Excel, CSV o PDF y fusionarlos. Una cuarta tarjeta, GitHub Intelligence, aparece solo cuando el feature flag GITHUB_INTELLIGENCE_ENABLED está activo y el project_type del proyecto es software_development; enlaza a /projects/[projectId]/settings/integrations/github y en cualquier otro caso queda oculta. Debajo, la sección Metadatos del Proyecto muestra tarjetas de solo lectura con fecha de inicio, fecha objetivo y fecha de creación, formateadas según el idioma. Lee: projects (id, slug, título, estado, fechas, tipo) y el conteo de stakeholders. Relacionadas: Stakeholders, Auditoría, Importación de proyectos, Configuración de GitHub, Resumen del proyecto (donde se edita/archiva el proyecto).
Fuente: settings/page.tsx, lib/env.ts.
Verifica: abre un proyecto → pestaña Settings; la tarjeta de GitHub solo aparece en proyectos de software con el flag activo.
