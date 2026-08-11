---
slug: screen-settings
route: /settings
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/settings/page.tsx
  - src/app/[locale]/(app)/settings/actions.ts
  - src/components/settings/organization-name-form.tsx
  - src/components/settings/theme-control.tsx
  - src/components/settings/language-control.tsx
---

# EN: Settings screen

The personal preferences screen at `/settings` inside the authenticated app, opened from the app navigation. After resolving the session with `getOrgContext()`, the server page renders three cards with inline bilingual copy. The Organization card is new and is the only part that touches the database: owners and admins get `OrganizationNameForm`, whose `renameOrganizationAction` validates the name at 2–120 characters and updates `organizations.name_i18n`, writing the same string to both `en` and `es` because a company name is a proper noun and UX-012 forbids auto-translating user content; the update runs through the user's RLS session, so the `is_pmo_level` policy is the real authority and the role check is only a friendly pre-check. Everyone else sees the name as read-only text with a note that only owners or admins can rename it. The Appearance card hosts `ThemeControl` (Light, Dark, System) which persists to localStorage and re-applies on OS preference changes. The Language card hosts `LanguageControl`: choosing English or Español writes the `NEXT_LOCALE` cookie for a year and hard-navigates to the equivalent localized URL through `buildLocaleSwitchPath`, reloading the whole app. Billing, plans, members, teams and external contacts are not here — they live under `/organization/*`, and per-project configuration lives in each project's Settings tab. Related: screen-team, screen-org-members, screen-org-billing, screen-org-plans, screen-project-settings.
Source: src/app/[locale]/(app)/settings/{page,actions}, src/components/settings/{organization-name-form,theme-control,language-control}.tsx.
Verify: open Settings from the navigation, rename the organization as an owner/admin, toggle the theme, then switch the language and watch the app reload.

# ES: Pantalla Configuración

La pantalla de preferencias personales en `/settings`, dentro de la aplicación autenticada, accesible desde la navegación. Tras resolver la sesión con `getOrgContext()`, la página de servidor muestra tres tarjetas con textos bilingües en línea. La tarjeta Organización es nueva y es la única parte que toca la base de datos: los propietarios y administradores ven `OrganizationNameForm`, cuya acción `renameOrganizationAction` valida el nombre entre 2 y 120 caracteres y actualiza `organizations.name_i18n` escribiendo la misma cadena en `en` y en `es`, porque el nombre de una empresa es un nombre propio y UX-012 prohíbe traducir automáticamente contenido del usuario; la actualización pasa por la sesión RLS del usuario, así que la política `is_pmo_level` es la autoridad real y la comprobación de rol es solo una validación previa amable. El resto de usuarios ve el nombre como texto de solo lectura con una nota de que únicamente propietarios o administradores pueden renombrarlo. La tarjeta Apariencia contiene `ThemeControl` (Claro, Oscuro, Sistema), que guarda la elección en localStorage y la reaplica cuando cambia la preferencia del sistema operativo. La tarjeta Idioma contiene `LanguageControl`: elegir English o Español escribe la cookie `NEXT_LOCALE` durante un año y navega de forma dura a la URL localizada equivalente mediante `buildLocaleSwitchPath`, recargando toda la aplicación. Facturación, planes, miembros, equipos y contactos externos no están aquí: viven en `/organization/*`, y la configuración por proyecto en la pestaña Ajustes de cada proyecto. Relacionadas: screen-team, screen-org-members, screen-org-billing, screen-org-plans, screen-project-settings.
Fuente: src/app/[locale]/(app)/settings/{page,actions}, src/components/settings/{organization-name-form,theme-control,language-control}.tsx.
Verifica: abre Configuración desde la navegación, renombra la organización como propietario o administrador, cambia el tema y después el idioma; la aplicación se recarga.
