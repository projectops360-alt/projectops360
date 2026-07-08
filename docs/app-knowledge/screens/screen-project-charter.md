---
slug: screen-project-charter
route: /projects/[projectId]/charter
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/charter/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/charter/charter-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/charter/charter-extra.tsx
  - src/app/[locale]/(app)/projects/[projectId]/charter/actions.ts
  - src/lib/charter/service.ts
  - src/lib/charter/fields.ts
---

# EN: Project Charter & Governance screen

The living Project Charter: the governance foundation of a project. The page auto-creates a charter row if none exists (covers older projects) and loads it with versions, roles, governance rules, approval matrix, sign-offs, project team members and the unified People Directory for person suggestions. The editor shows a section navigation (charter text sections from CHARTER_SECTIONS) plus governance tabs: Roles, Approval Matrix, Governance Rules, Sign-Off and an AI tools tab (gap analysis, scope-creep detection, charter Q&A, stakeholder summary, generate full governance set). Header actions: "Generate with AI" fills only empty fields; "Submit for approval" is gated (100% required fields, at least one role, one approval rule and one sign-off); reviewers can Approve (locks the charter, snapshots a version into project_charter_versions and pushes sections into Project Memory) or Reject (status revision_required with notes). Editing an approved charter opens a new revision and bumps the version. A completion bar shows missing fields and governance blockers. Data: project_charters, project_charter_versions, project_charter_roles, project_governance_rules, project_approval_matrix, project_signoffs, project_team_members; transitions write audit_logs. Links go to the Stakeholder view (/charter/summary), Print/PDF (/charter/print) and the Delivery framework (/delivery?setup=true). The ?onboard=true param shows an onboarding banner.
Source: src/app/[locale]/(app)/projects/[projectId]/charter/page.tsx, charter-client.tsx, charter-extra.tsx, actions.ts.
Verify: open a project and go to /projects/[projectId]/charter.

# ES: Pantalla Charter y Gobernanza del Proyecto

El Charter vivo del proyecto: su base de gobernanza. La página crea automáticamente el charter si no existe (cubre proyectos antiguos) y lo carga con versiones, roles, reglas de gobernanza, matriz de aprobación, firmas, miembros del equipo y el Directorio de Personas unificado para sugerir personas. El editor muestra navegación por secciones de texto (CHARTER_SECTIONS) más pestañas de gobernanza: Roles, Matriz de Aprobación, Reglas de Gobernanza, Firmas (Sign-Off) y una pestaña de herramientas de IA (análisis de brechas, detección de scope creep, preguntas al charter, resumen para stakeholders, generación del modelo de gobernanza completo). Acciones del encabezado: "Generar con IA" rellena solo campos vacíos; "Enviar a aprobación" tiene compuerta de preparación (100% de campos requeridos, al menos un rol, una regla de aprobación y una firma); el revisor puede Aprobar (bloquea el charter, guarda una versión en project_charter_versions y sincroniza secciones a la Memoria del Proyecto) o Rechazar (estado revision_required con notas). Editar un charter aprobado abre una nueva revisión y sube la versión. Una barra de completitud señala campos faltantes y bloqueos de gobernanza. Datos: project_charters, project_charter_versions, project_charter_roles, project_governance_rules, project_approval_matrix, project_signoffs, project_team_members; las transiciones registran audit_logs. Enlaces a la vista de stakeholders (/charter/summary), Imprimir/PDF (/charter/print) y el Marco de ejecución (/delivery?setup=true). El parámetro ?onboard=true muestra un banner de bienvenida.
Fuente: src/app/[locale]/(app)/projects/[projectId]/charter/page.tsx, charter-client.tsx, charter-extra.tsx, actions.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/charter.
