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
  - src/lib/billing/plan-capabilities.server.ts
  - src/lib/billing/config.ts
  - src/lib/admin-console/access.server.ts
---

# EN: Plans & Pricing admin screen

A platform-admin-only editor for the global subscription plans (Personal, Team, Business/PMO, Enterprise) at `/organization/plans`, reached from the "Plans & pricing" button on Billing. The page awaits `isPlatformAdmin(org.email)` from `lib/admin-console/access.server` — the `admin_authorized_users` table plus a hardcoded platform owner, **not** the deprecated org-owner fallback — and calls `notFound()` for everyone else. The intro warns that plans are global: an edit changes every organization, including the public landing pricing. Each plan is a card with pricing/metadata (name, currency, monthly and yearly price, description, Active checkbox), numeric `LIMIT_FIELDS` where an empty box means unlimited, and `FEATURE_FIELDS` checkboxes. For enterprise plans the two price inputs are replaced by a read-only "Contact Sales" field. Below them a read-only "Intelligence capabilities" matrix, loaded by `getPlanCapabilityCatalog` from the `plan_capabilities` table and grouped by the tier that first includes each capability, documents what the plan unlocks — it is display-only and not editable here. One Save button per card calls `updatePlanAction` (updates `plans`) then `updateEntitlementsAction` (updates or inserts the `plan_entitlements` row); both re-check the platform-admin gate and write `logAudit` entries. Editing prices here changes nothing in any payment provider — no billing integration exists. Related: screen-org-billing, screen-org-members.
Source: organization/plans/{page.tsx,plans-admin-client.tsx,actions.ts}, lib/billing/service.ts, lib/billing/plan-capabilities.server.ts.
Verify: as a platform admin open Billing and click Plans & pricing, or go to /organization/plans (anyone else gets a 404).

# ES: Pantalla Planes y precios (administración)

Un editor exclusivo para administradores de plataforma de los planes globales de suscripción (Personal, Team, Business/PMO, Enterprise) en `/organization/plans`, accesible desde el botón "Planes y precios" de Facturación. La página espera a `isPlatformAdmin(org.email)` de `lib/admin-console/access.server` —la tabla `admin_authorized_users` más un propietario de plataforma fijo en código, **no** el respaldo obsoleto de propietario de organización— y devuelve `notFound()` a cualquier otro usuario. La introducción advierte que los planes son globales: una edición afecta a todas las organizaciones, incluida la tarifa pública de la landing. Cada plan es una tarjeta con precios y metadatos (nombre, moneda, precio mensual y anual, descripción, casilla de Activo), los campos numéricos de `LIMIT_FIELDS` donde vacío significa ilimitado, y las casillas de `FEATURE_FIELDS`. En los planes enterprise los dos campos de precio se sustituyen por un campo de solo lectura "Contactar ventas". Debajo, una matriz de solo lectura de "Capacidades de inteligencia", cargada por `getPlanCapabilityCatalog` desde la tabla `plan_capabilities` y agrupada por el nivel a partir del cual se incluye cada capacidad, documenta lo que desbloquea el plan; es informativa y no se edita aquí. Un botón Guardar por tarjeta llama a `updatePlanAction` (actualiza `plans`) y luego a `updateEntitlementsAction` (actualiza o inserta la fila de `plan_entitlements`); ambas vuelven a comprobar la autorización y registran auditoría con `logAudit`. Cambiar precios aquí no modifica nada en ningún proveedor de pago: no existe integración de facturación. Relacionadas: screen-org-billing, screen-org-members.
Fuente: organization/plans/{page.tsx,plans-admin-client.tsx,actions.ts}, lib/billing/service.ts, lib/billing/plan-capabilities.server.ts.
Verifica: como administrador de plataforma abre Facturación y pulsa Planes y precios, o navega a /organization/plans (los demás reciben un 404).
