---
slug: screen-project-documents
route: /projects/[projectId]/documents
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/documents/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/documents/document-list-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/documents/actions.ts
  - src/components/documents/create-document-dialog.tsx
---

# EN: Project Documents screen

The project document repository. The server page loads all non-deleted rows from the documents table for the project, newest first. The client renders a filterable list with client-side filters for status (draft, review, approved, archived), document type (evidence, contract, specification, report, presentation, other) and storage type (upload vs external_url). The create button opens CreateDocumentDialog, which supports two storage modes: uploading a file to the Supabase Storage "documents" bucket (the dialog uploads directly from the browser, then the server action stores the file path, name, size and mime type) or registering an external URL. createDocumentAction and updateDocumentAction validate with zod (a file is required for uploads, a URL for external links), write i18n title/description to the documents table, log to audit_logs and revalidate the project layout; archiveDocumentAction soft-deletes with confirmation. Each item links to the document detail screen. Empty state prompts adding the first document. Related screens: document detail (/documents/[documentId]), Project Memory (documents tab and linking), and decisions (documents can be a decision source or linked record).
Source: src/app/[locale]/(app)/projects/[projectId]/documents/page.tsx, document-list-client.tsx, actions.ts.
Verify: open a project and go to /projects/[projectId]/documents.

# ES: Pantalla Documentos del Proyecto

El repositorio documental del proyecto. La página de servidor carga todas las filas no eliminadas de la tabla documents para el proyecto, de más reciente a más antigua. El cliente muestra una lista con filtros en el cliente por estado (borrador, revisión, aprobado, archivado), tipo de documento (evidencia, contrato, especificación, reporte, presentación, otro) y tipo de almacenamiento (carga de archivo o URL externa). El botón de crear abre CreateDocumentDialog, que admite dos modos: subir un archivo al bucket "documents" de Supabase Storage (el diálogo sube directamente desde el navegador y la acción de servidor guarda ruta, nombre, tamaño y tipo mime) o registrar una URL externa. createDocumentAction y updateDocumentAction validan con zod (archivo obligatorio para cargas, URL para enlaces externos), escriben título y descripción i18n en la tabla documents, registran en audit_logs y revalidan el layout del proyecto; archiveDocumentAction hace borrado suave con confirmación. Cada elemento enlaza al detalle del documento. Hay estado vacío que invita a agregar el primer documento. Relacionadas: detalle de documento (/documents/[documentId]), Memoria del Proyecto (pestaña de documentos y vinculación) y decisiones (un documento puede ser origen o registro vinculado).
Fuente: src/app/[locale]/(app)/projects/[projectId]/documents/page.tsx, document-list-client.tsx, actions.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/documents.
