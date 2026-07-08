---
slug: screen-project-team
route: /projects/[projectId]/team
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/team/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/team/team-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/team/role-board.tsx
  - src/app/[locale]/(app)/projects/[projectId]/team/actions.ts
  - src/lib/team-roles/service.ts
  - src/lib/team-roles/board-model.ts
  - src/lib/team-roles/config.ts
---

# EN: Project Team & Roles screen

The Team screen (/projects/[projectId]/team) is the Project Team & Roles Center. The server page uses `lib/team-roles/service` to load the project team (`project_team_members`), RACI assignments (`project_raci_assignments`), stakeholder access (`stakeholder_access`), the company directory and company teams (`organization_team_members` + `profiles`), external contacts and the project's `milestones`, then computes a team-completeness score (has PM, has approver, missing critical roles). `TeamClient` has three tabs: "Members & roles" (with a List view and a drag-and-drop Role Assignment Board built on dnd-kit, where people from the directory are dragged into role buckets with optimistic UI and undo), "RACI", and "Stakeholder access". Server actions cover adding individual members or whole company teams, editing/removing/restoring members, assigning and moving people between roles (with server-side dedup), AI role recommendations (recommendRolesAction / addRecommendedRolesAction), RACI add/delete plus generateRaciDraftAction, and granting or revoking read-only stakeholder viewers. A code comment confirms project teams are operational: adding people here never creates a paid seat. Related screens: Stakeholders, Organization members/teams, Charter governance roles, Resources.
Source: team/page.tsx, team-client.tsx, role-board.tsx, team/actions.ts, lib/team-roles/service.ts.
Verify: open a project and go to Team (/projects/[projectId]/team).

# ES: Pantalla Equipo y roles del proyecto

La pantalla de Equipo (/projects/[projectId]/team) es el Centro de Equipo y Roles del proyecto. La página de servidor usa `lib/team-roles/service` para cargar el equipo (`project_team_members`), asignaciones RACI (`project_raci_assignments`), accesos de stakeholders (`stakeholder_access`), el directorio y los equipos de la empresa (`organization_team_members` + `profiles`), contactos externos y los `milestones` del proyecto, y calcula un puntaje de completitud del equipo (hay PM, hay aprobador, roles críticos faltantes). `TeamClient` tiene tres pestañas: "Miembros y roles" (con vista Lista y un tablero de asignación de roles con arrastrar y soltar basado en dnd-kit, donde se arrastran personas del directorio a cubetas de rol, con interfaz optimista y deshacer), "RACI" y "Acceso de stakeholders". Las acciones de servidor permiten agregar miembros individuales o equipos completos de la empresa, editar/quitar/restaurar miembros, asignar y mover personas entre roles (con deduplicación en servidor), recomendaciones de roles con IA (recommendRolesAction / addRecommendedRolesAction), alta/baja de RACI más generateRaciDraftAction, y otorgar o revocar visores de solo lectura para stakeholders. Un comentario del código confirma que agregar personas aquí nunca crea un asiento de pago. Relacionadas: Stakeholders, Miembros/equipos de la organización, roles de gobernanza del Charter, Recursos.
Fuente: team/page.tsx, team-client.tsx, role-board.tsx, team/actions.ts, lib/team-roles/service.ts.
Verifica: abre un proyecto y entra a Equipo (/projects/[projectId]/team).
