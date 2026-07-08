---
slug: screen-project-charter-print
route: /projects/[projectId]/charter/print
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/charter/print/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/charter/print/charter-print-client.tsx
  - src/lib/print-document.ts
---

# EN: Project Charter Print / PDF screen

A printable document version of the Project Charter, reached from the "Print / PDF" button on the Charter screen. The server page loads the project, the charter (project_charters) and its child tables — project_charter_roles, project_governance_rules, project_approval_matrix and project_signoffs — all read-only; this screen writes nothing. The client renders a formal document inside #charter-report-print (print CSS in globals.css isolates it): full logo header, a deterministic folio code CHR-<shortId>-V<version> derived from the charter id and version so the on-page folio matches the PDF filename (Pops360-Charter-CHR-…), the status badge, all charter text sections from CHARTER_SECTIONS, the governance tables, and signature blocks for Project Sponsor, Project Manager and Steering Committee (names auto-matched from defined charter roles) plus a client signature line — it is intended for client approval and signature. A non-printing toolbar offers "Back to Charter" and a "Download PDF" button that calls printWithFilename to open the browser print dialog with the canonical filename. Related screens: the editable Charter (/charter) and the stakeholder summary (/charter/summary).
Source: src/app/[locale]/(app)/projects/[projectId]/charter/print/page.tsx, charter-print-client.tsx.
Verify: open /projects/[projectId]/charter and click "Print / PDF".

# ES: Pantalla Charter imprimible / PDF

Versión de documento imprimible del Charter del Proyecto, a la que se llega con el botón "Imprimir / PDF" de la pantalla de Charter. La página de servidor carga el proyecto, el charter (project_charters) y sus tablas hijas — project_charter_roles, project_governance_rules, project_approval_matrix y project_signoffs — todo en modo lectura; esta pantalla no escribe nada. El cliente muestra un documento formal dentro de #charter-report-print (el CSS de impresión en globals.css lo aísla): encabezado con logotipo, un folio determinista CHR-<shortId>-V<versión> derivado del id y la versión del charter para que el folio en pantalla coincida con el nombre del PDF (Pops360-Charter-CHR-…), la insignia de estado, todas las secciones de texto del charter, las tablas de gobernanza y bloques de firma para Patrocinador, Gerente de Proyecto y Comité Directivo (nombres tomados de los roles definidos) más una línea de firma del cliente — está pensado para aprobación y firma del cliente. Una barra no imprimible ofrece "Volver al Charter" y "Descargar PDF", que llama a printWithFilename para abrir el diálogo de impresión con el nombre canónico. Pantallas relacionadas: el Charter editable (/charter) y el resumen para stakeholders (/charter/summary).
Fuente: src/app/[locale]/(app)/projects/[projectId]/charter/print/page.tsx, charter-print-client.tsx.
Verifica: abre /projects/[projectId]/charter y pulsa "Imprimir / PDF".
