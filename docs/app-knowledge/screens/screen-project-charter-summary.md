---
slug: screen-project-charter-summary
route: /projects/[projectId]/charter/summary
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/charter/summary/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/charter/charter-extra.tsx
  - src/app/[locale]/(app)/projects/[projectId]/charter/actions.ts
---

# EN: Charter Stakeholder Summary screen

A read-only "Project Foundation & Status Context" view for stakeholders, reached from the "Stakeholder view" button on the Charter screen. It is a fully server-rendered summary — no editing. The header shows the project name, the charter status badge (from CHARTER_STATUS_META) and the version, with a note that this view helps stakeholders understand current status relative to the approved charter. Below, a StakeholderSummaryButton (from charter-extra.tsx) generates an AI stakeholder summary on demand via the stakeholderSummaryAction server action. Six field cards show project purpose (project_goal or executive_summary), major deliverables, in scope, success criteria, governance model and reporting cadence, each showing "To be defined." when empty. Then a "Key milestones" card lists up to 8 milestones with target dates, and two cards list up to 6 open risks (status open/identified/mitigating) and up to 6 pending decisions (status proposed). Data read: project_charters, milestones, risks and decisions tables, scoped to the org and project. A back link returns to the Charter. Related screens: Charter editor (/charter) and printable charter (/charter/print).
Source: src/app/[locale]/(app)/projects/[projectId]/charter/summary/page.tsx, ../charter-extra.tsx.
Verify: open /projects/[projectId]/charter and click "Stakeholder view".

# ES: Pantalla Resumen del Charter para Stakeholders

Vista de solo lectura "Fundación y Contexto de Estado del Proyecto" para interesados, a la que se llega con el botón "Vista stakeholders" del Charter. Se renderiza por completo en el servidor — sin edición. El encabezado muestra el nombre del proyecto, la insignia de estado del charter (CHARTER_STATUS_META) y la versión, con una nota que indica que esta vista ayuda a entender el estado actual respecto al charter aprobado. Debajo, el botón StakeholderSummaryButton (de charter-extra.tsx) genera bajo demanda un resumen con IA mediante la acción de servidor stakeholderSummaryAction. Seis tarjetas muestran propósito del proyecto (project_goal o executive_summary), entregables principales, dentro del alcance, criterios de éxito, modelo de gobernanza y cadencia de reportes; cada una muestra "Por definir." si está vacía. Luego, una tarjeta de "Hitos clave" lista hasta 8 hitos con fecha objetivo, y dos tarjetas listan hasta 6 riesgos abiertos (open/identified/mitigating) y hasta 6 decisiones pendientes (proposed). Datos leídos: tablas project_charters, milestones, risks y decisions, acotadas a la organización y al proyecto. Un enlace regresa al Charter. Relacionadas: editor del Charter (/charter) y charter imprimible (/charter/print).
Fuente: src/app/[locale]/(app)/projects/[projectId]/charter/summary/page.tsx, ../charter-extra.tsx.
Verifica: abre /projects/[projectId]/charter y pulsa "Vista stakeholders".
