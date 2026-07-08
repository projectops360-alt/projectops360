---
slug: screen-projects-list
route: /projects
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/page.tsx
  - src/app/[locale]/(app)/projects/project-list-client.tsx
  - src/app/[locale]/(app)/projects/actions.ts
  - src/components/projects/project-card.tsx
  - src/components/projects/create-project-dialog.tsx
---

# EN: Projects list screen

The organization's project portfolio at `/projects`, reached from the main navigation or from Command Center links. The server page queries the Supabase `projects` table scoped to the current organization (soft-deleted rows excluded, newest first) and resolves localized status labels via next-intl. The client component (`ProjectListClient`) renders a "create" button that opens the `CreateProjectDialog`, and either an empty state (folder icon plus localized empty copy) or a responsive grid of `ProjectCard`s, each linking to that project's Command Center at `/projects/{id}`. Project creation goes through the `createProject` server action in `actions.ts`: input is validated with Zod (name, description, status, and a project type such as software_development or several construction types), the project row is inserted, a type-specific template can be instantiated (`getTemplateForType` / `instantiateTemplate` from `lib/execution`), a Project Charter is created via `createCharterForProject` (`lib/charter/service`), and the operation is recorded with `logAudit`. Data read: `projects`. Data written: `projects` plus template- and charter-related tables on creation. Related screens: the per-project Command Center and all project tabs, the Import screen (alternative way to create a project from a file), and the Home dashboard.

Source: src/app/[locale]/(app)/projects/page.tsx, project-list-client.tsx, actions.ts.
Verify: open Projects from the app navigation; create a project with the button and see its card appear.

# ES: Pantalla Lista de proyectos

El portafolio de proyectos de la organización en `/projects`, accesible desde la navegación principal o desde enlaces del Command Center. La página de servidor consulta la tabla `projects` de Supabase limitada a la organización actual (excluyendo eliminados, más recientes primero) y resuelve etiquetas de estado localizadas con next-intl. El componente cliente (`ProjectListClient`) muestra un botón de crear que abre el `CreateProjectDialog`, y un estado vacío (icono de carpeta con textos localizados) o una cuadrícula de tarjetas `ProjectCard`, cada una enlazando al Command Center de ese proyecto en `/projects/{id}`. La creación pasa por la server action `createProject` en `actions.ts`: valida con Zod (nombre, descripción, estado y tipo de proyecto, como desarrollo de software o varios tipos de construcción), inserta la fila del proyecto, puede instanciar una plantilla según el tipo (`getTemplateForType` / `instantiateTemplate` de `lib/execution`), crea un Charter mediante `createCharterForProject` (`lib/charter/service`) y registra la operación con `logAudit`. Lee: `projects`. Escribe: `projects` y tablas de plantilla y charter al crear. Pantallas relacionadas: el Command Center por proyecto y sus pestañas, la pantalla de Importación y el dashboard de inicio.

Fuente: src/app/[locale]/(app)/projects/page.tsx, project-list-client.tsx, actions.ts.
Verifica: abre Proyectos desde la navegación; crea un proyecto con el botón y observa su tarjeta aparecer.
