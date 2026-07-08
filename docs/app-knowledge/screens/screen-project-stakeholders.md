---
slug: screen-project-stakeholders
route: /projects/[projectId]/stakeholders
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/stakeholders/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/stakeholders/stakeholder-list-client.tsx
  - src/components/stakeholders/stakeholder-card.tsx
  - src/components/stakeholders/create-stakeholder-dialog.tsx
---

# EN: Project Stakeholders screen

The project stakeholder registry. The server page fans out two queries in parallel: the project row (org-scoped) and all non-deleted rows from the stakeholders table ordered by name, then hands them to StakeholderListClient with localized labels. The client shows a title, description and a create button that opens CreateStakeholderDialog; created stakeholders are appended to the list. Stakeholders render in a responsive card grid (2 columns on small screens, 3 on large): each StakeholderCard shows the person with influence and interest badges mapped to high/medium/low localized labels (InfluenceBadge component), plus edit and archive actions — archiving asks for confirmation and soft-deletes the row. When the list is empty, a dashed empty state invites creating the first stakeholder. Data: reads and writes only the stakeholders table (per-project, org-scoped, soft delete via deleted_at). Stakeholders registered here feed other governance screens: the decisions module links decisions to stakeholders, the Charter suggests them in governance roles through the unified People Directory, and Project Memory offers them as linkable entities.
Source: src/app/[locale]/(app)/projects/[projectId]/stakeholders/page.tsx, stakeholder-list-client.tsx, src/components/stakeholders/*.
Verify: open a project and go to /projects/[projectId]/stakeholders.

# ES: Pantalla Stakeholders del Proyecto

El registro de interesados del proyecto. La página de servidor lanza dos consultas en paralelo: la fila del proyecto (acotada a la organización) y todas las filas no eliminadas de la tabla stakeholders ordenadas por nombre, y las entrega a StakeholderListClient con etiquetas localizadas. El cliente muestra título, descripción y un botón de crear que abre CreateStakeholderDialog; los creados se agregan a la lista. Los stakeholders se muestran en una cuadrícula de tarjetas adaptable (2 columnas en pantallas pequeñas, 3 en grandes): cada StakeholderCard muestra a la persona con insignias de influencia e interés mapeadas a etiquetas alta/media/baja (componente InfluenceBadge), más acciones de editar y archivar — archivar pide confirmación y hace borrado suave. Con la lista vacía, un estado vacío con borde punteado invita a crear el primer stakeholder. Datos: lee y escribe solo la tabla stakeholders (por proyecto, acotada a la organización, borrado suave con deleted_at). Los stakeholders registrados aquí alimentan otras pantallas de gobernanza: el módulo de decisiones vincula decisiones a stakeholders, el Charter los sugiere en roles de gobernanza mediante el Directorio de Personas unificado, y la Memoria del Proyecto los ofrece como entidades vinculables.
Fuente: src/app/[locale]/(app)/projects/[projectId]/stakeholders/page.tsx, stakeholder-list-client.tsx, src/components/stakeholders/*.
Verifica: abre un proyecto y ve a /projects/[projectId]/stakeholders.
