---
slug: screen-org-external-contacts
route: /organization/external-contacts
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/organization/external-contacts/page.tsx
  - src/app/[locale]/(app)/organization/external-contacts/contacts-client.tsx
  - src/app/[locale]/(app)/organization/external-contacts/actions.ts
  - src/lib/team-roles/service.ts
---

# EN: External Contacts screen

The External Contacts screen manages people who work with the organization without a full login — vendors, clients, inspectors, consultants and sponsors. The header explicitly states they do not consume a billable seat. You reach it from the Billing screen header (Contacts button) at /organization/external-contacts. The screen has two parts: an inline add form (name, email, company, contact type from CONTACT_TYPES in lib/team-roles/config, plus an Add button) and a table listing each contact's name, type, company, and email/phone, with a trash icon per row. Adding calls createContactAction, which inserts into the external_contacts table (fields include name, email, company_name, contact_type, phone, notes, can_login, access_status "active") and logs the creation with logAudit. Deleting calls deleteContactAction, a soft delete that sets deleted_at. An updateContactAction exists in actions.ts for editing fields and access status, but the current table UI does not expose inline editing — only add and delete. The page loads contacts server-side through getExternalContacts in lib/team-roles/service, scoped to the organization from getOrgContext; actions only require an authenticated org context. Related screens: Teams (external contacts can be added as team members), Members (internal, seat-based users) and Billing.
Source: src/app/[locale]/(app)/organization/external-contacts/{page.tsx,contacts-client.tsx,actions.ts}, src/lib/team-roles/service.ts.
Verify: open Billing (sidebar) then click Contacts, or go to /organization/external-contacts.

# ES: Pantalla Contactos externos

La pantalla de Contactos externos administra a las personas que trabajan con la organización sin un acceso completo — proveedores, clientes, inspectores, consultores y patrocinadores. El encabezado indica explícitamente que no consumen asiento facturable. Se accede desde el encabezado de Facturación (botón Contactos), en /organization/external-contacts. La pantalla tiene dos partes: un formulario de alta en línea (nombre, correo, empresa, tipo de contacto según CONTACT_TYPES en lib/team-roles/config, y botón Agregar) y una tabla con nombre, tipo, empresa y correo/teléfono de cada contacto, con un icono de papelera por fila. Agregar llama a createContactAction, que inserta en la tabla external_contacts (campos como name, email, company_name, contact_type, phone, notes, can_login y access_status "active") y registra la creación con logAudit. Eliminar llama a deleteContactAction, un borrado suave que escribe deleted_at. Existe una acción updateContactAction en actions.ts para editar campos y estado de acceso, pero la interfaz actual no expone edición en línea — solo agregar y eliminar. La página carga los contactos en el servidor mediante getExternalContacts de lib/team-roles/service, acotados a la organización; las acciones solo requieren contexto autenticado. Pantallas relacionadas: Equipos, Miembros y Facturación.
Fuente: src/app/[locale]/(app)/organization/external-contacts/{page.tsx,contacts-client.tsx,actions.ts}, src/lib/team-roles/service.ts.
Verifica: abre Facturación en la barra lateral y pulsa Contactos, o navega a /organization/external-contacts.
