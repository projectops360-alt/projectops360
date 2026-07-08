---
slug: screen-org-plans
route: /organization/plans
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/organization/plans/page.tsx
  - src/app/[locale]/(app)/organization/plans/plans-admin-client.tsx
  - src/app/[locale]/(app)/organization/plans/actions.ts
  - src/lib/billing/service.ts
  - src/lib/billing/config.ts
---

# EN: Plans & Pricing admin screen

The Plans & Pricing screen is a platform-admin-only editor for the global subscription plans (Personal, Team, Business/PMO, Enterprise). It lives at /organization/plans and is reached from the "Plans & pricing" button on the Billing screen, which is shown only to platform admins; the page itself calls isPlatformAdmin server-side (PLATFORM_ADMIN_EMAILS allowlist, or org owner as fallback) and returns notFound() for everyone else. A prominent warning explains that prices are global: edits apply to all organizations. Each plan renders as a card with three editable areas: pricing/metadata (name, description, currency, monthly and yearly price, active checkbox), limits (LIMIT_FIELDS numeric inputs where empty means unlimited) and features (FEATURE_FIELDS checkboxes). One Save button per card calls updatePlanAction (updates the plans table) and updateEntitlementsAction (updates or inserts the plan_entitlements row), both gated to platform admins and audited via logAudit. Data is loaded server-side with getPlansWithEntitlements from lib/billing/service, which joins plans with plan_entitlements ordered by sort_order. Enterprise plans get an Enterprise badge; inactive plans show an Inactive badge. A back link returns to /organization/billing, where the resulting limits drive the Usage & Limits cards. Related screens: Billing (consumer of these entitlements) and Members (billable seats counted against max_billable_users).
Source: src/app/[locale]/(app)/organization/plans/{page.tsx,plans-admin-client.tsx,actions.ts}, src/lib/billing/service.ts.
Verify: as a platform admin, open Billing and click Plans & pricing, or go to /organization/plans (others get a 404).

# ES: Pantalla Planes y precios (administración)

La pantalla de Planes y precios es un editor exclusivo para administradores de plataforma de los planes globales de suscripción (Personal, Team, Business/PMO, Enterprise). Vive en /organization/plans y se accede con el botón "Planes y precios" de la pantalla de Facturación, visible solo para administradores de plataforma; la página valida isPlatformAdmin en el servidor (lista PLATFORM_ADMIN_EMAILS o, en su defecto, propietario de la organización) y devuelve notFound() a cualquier otro usuario. Un aviso destacado explica que los precios son globales: los cambios aplican a todas las organizaciones. Cada plan se muestra como una tarjeta con tres áreas editables: precios y metadatos (nombre, descripción, moneda, precio mensual y anual, casilla de activo), límites (campos numéricos de LIMIT_FIELDS donde vacío significa ilimitado) y funciones (casillas de FEATURE_FIELDS). Un botón Guardar por tarjeta llama a updatePlanAction (actualiza la tabla plans) y a updateEntitlementsAction (actualiza o inserta la fila de plan_entitlements), ambas restringidas a administradores de plataforma y auditadas con logAudit. Los datos se cargan con getPlansWithEntitlements de lib/billing/service, que une plans con plan_entitlements ordenados por sort_order. Los planes Enterprise llevan insignia Enterprise y los inactivos, insignia de Inactivo. Un enlace regresa a /organization/billing, donde estos límites alimentan las tarjetas de uso. Pantallas relacionadas: Facturación y Miembros.
Fuente: src/app/[locale]/(app)/organization/plans/{page.tsx,plans-admin-client.tsx,actions.ts}, src/lib/billing/service.ts.
Verifica: como administrador de plataforma, abre Facturación y pulsa Planes y precios, o navega a /organization/plans (otros usuarios reciben 404).
