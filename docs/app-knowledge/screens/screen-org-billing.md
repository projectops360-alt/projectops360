---
slug: screen-org-billing
route: /organization/billing
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/organization/billing/page.tsx
  - src/lib/billing/service.ts
  - src/lib/billing/config.ts
  - src/lib/admin-console/access.server.ts
  - src/config/navigation.ts
---

# EN: Organization Billing screen

The Billing & plan hub at `/organization/billing`, reached from the sidebar bottom navigation (`bottomNav`, credit-card icon). It is fully server-rendered — there is no client component and the page writes nothing. The header shows the organization name plus links to Members, Teams and External contacts; a "Plans & pricing" link appears only when `isPlatformAdmin(org.email)` passes, which now checks the `admin_authorized_users` table and a hardcoded platform owner, **not** the old org-owner fallback. The Current plan card shows the plan label, a status badge (`active`, `trialing`, `past_due`, `canceled`, `suspended`), and either the monthly/yearly price or "Custom contract" for enterprise plans. The "Manage subscription" button is permanently disabled with a "Payment integration coming soon" title — **no Stripe or any payment provider is wired up**. Usage & limits compares six metrics against entitlements via `checkLimit` with progress bars and near/at-limit warnings; be aware that `getUsage` currently hardcodes AI credits and memory storage to `0` (metering is unbuilt), so only billable users, active projects, free viewers and documents indexed are real. Reads go through `getOrgBilling` and `getPlansWithEntitlements` over `subscriptions`, `plans`, `plan_entitlements`, `organization_members`, `projects` and `project_memory_items`. Related: screen-org-members, screen-org-plans, screen-org-teams, screen-org-external-contacts.
Source: organization/billing/page.tsx, lib/billing/service.ts, lib/billing/config.ts.
Verify: click Billing at the bottom of the sidebar, or open /organization/billing.

# ES: Pantalla Facturación de la organización

El centro de Facturación y plan en `/organization/billing`, accesible desde la navegación inferior de la barra lateral (`bottomNav`, icono de tarjeta). Se renderiza por completo en el servidor: no hay componente cliente y la página no escribe nada. El encabezado muestra el nombre de la organización y enlaces a Miembros, Equipos y Contactos externos; el enlace "Planes y precios" solo aparece cuando `isPlatformAdmin(org.email)` lo permite, comprobación que ahora consulta la tabla `admin_authorized_users` y un propietario de plataforma fijo en código, **no** el antiguo respaldo de propietario de organización. La tarjeta de Plan actual muestra la etiqueta del plan, una insignia de estado (`active`, `trialing`, `past_due`, `canceled`, `suspended`) y el precio mensual o anual, o bien "Contrato personalizado" en los planes enterprise. El botón "Gestionar suscripción" está deshabilitado de forma permanente con el aviso "Integración de pagos próximamente": **no hay Stripe ni ningún proveedor de pago conectado**. Uso y límites compara seis métricas con los derechos del plan mediante `checkLimit`, con barras de progreso y avisos de cercanía o tope; conviene saber que `getUsage` fija hoy en `0` los créditos de IA y el almacenamiento de memoria (la medición no está construida), así que solo son reales los usuarios facturables, los proyectos activos, los observadores gratuitos y los documentos indexados. Las lecturas pasan por `getOrgBilling` y `getPlansWithEntitlements` sobre `subscriptions`, `plans`, `plan_entitlements`, `organization_members`, `projects` y `project_memory_items`. Relacionadas: screen-org-members, screen-org-plans, screen-org-teams, screen-org-external-contacts.
Fuente: organization/billing/page.tsx, lib/billing/service.ts, lib/billing/config.ts.
Verifica: pulsa Facturación al final de la barra lateral, o abre /organization/billing.
