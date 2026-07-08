---
slug: screen-project-document-detail
route: /projects/[projectId]/documents/[documentId]
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/documents/[documentId]/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/documents/[documentId]/document-detail-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/documents/actions.ts
---

# EN: Project Document Detail screen

Detail view of a single project document, reached by clicking an item in the documents list. The server page loads the document row (documents table) scoped to the organization; for documents with storage_type "upload" it generates a one-hour signed URL from the Supabase Storage "documents" bucket so the file can be opened securely. The detail client shows the document title, status badge (draft, review, approved, archived), owner (or "no owner"), storage type (upload or external URL), document type (evidence, contract, specification, report, presentation, other), description, version, and either an "Open file" button (using the signed URL) or an "Open link" button for external URLs. Edit opens the edit dialog, which can replace the uploaded file or switch storage mode, and saves through updateDocumentAction (zod validation, i18n fields, audit_logs entry, path revalidation). Archive soft-deletes via archiveDocumentAction after a confirmation prompt. A back link returns to the documents list. This screen writes nothing on load; all mutations go through the shared server actions. Related screens: documents list (/documents), Project Memory (documents tab), decision detail (documents appear as linkable records).
Source: src/app/[locale]/(app)/projects/[projectId]/documents/[documentId]/page.tsx, document-detail-client.tsx, ../actions.ts.
Verify: open /projects/[projectId]/documents and click any document.

# ES: Pantalla Detalle de Documento

Vista de detalle de un documento del proyecto, a la que se llega al hacer clic en un elemento de la lista de documentos. La página de servidor carga la fila del documento (tabla documents) acotada a la organización; para documentos con storage_type "upload" genera una URL firmada de una hora desde el bucket "documents" de Supabase Storage para abrir el archivo de forma segura. El cliente muestra título, insignia de estado (borrador, revisión, aprobado, archivado), responsable (o "sin responsable"), tipo de almacenamiento (carga o URL externa), tipo de documento (evidencia, contrato, especificación, reporte, presentación, otro), descripción, versión, y un botón "Abrir archivo" (con la URL firmada) o "Abrir enlace" para URLs externas. Editar abre el diálogo de edición, que puede reemplazar el archivo subido o cambiar el modo de almacenamiento, y guarda mediante updateDocumentAction (validación zod, campos i18n, registro en audit_logs, revalidación de ruta). Archivar hace borrado suave con archiveDocumentAction tras confirmación. Un enlace regresa a la lista. La pantalla no escribe nada al cargar; todas las mutaciones pasan por las acciones de servidor compartidas. Relacionadas: lista de documentos (/documents), Memoria del Proyecto (pestaña documentos) y detalle de decisión.
Fuente: src/app/[locale]/(app)/projects/[projectId]/documents/[documentId]/page.tsx, document-detail-client.tsx, ../actions.ts.
Verifica: abre /projects/[projectId]/documents y haz clic en cualquier documento.
