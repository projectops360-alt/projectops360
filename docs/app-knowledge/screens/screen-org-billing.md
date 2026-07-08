---
slug: screen-org-billing
route: /organization/billing
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/organization/billing/page.tsx
  - src/lib/billing/service.ts
  - src/lib/billing/config.ts
  - src/config/navigation.ts
---

# EN: Organization Billing screen

The Billing & Plan screen is the organization-level billing hub, reachable from the sidebar bottom navigation (Billing, credit-card icon) at /organization/billing. It is a fully server-rendered page (no client component). The header shows the organization name and quick links to Members, Teams and Contacts, plus a Plans & Pricing link that appears only for platform admins (isPlatformAdmin: PLATFORM_ADMIN_EMAILS allowlist, or org owner as fallback). The Current Plan card shows the plan label, subscription status badge (active, trialing, past_due, canceled, suspended) and monthly/yearly price; the "Manage subscription" button is intentionally disabled with a "Payment integration coming soon" tooltip — no payment flow exists yet. The Usage & Limits grid compares six metrics against plan entitlements — billable users, active projects, free viewers, documents indexed, AI credits per month and memory storage MB — with progress bars and near-limit/at-limit warnings computed by checkLimit; pending invites are noted as not billable. A Plan Features card lists FEATURE_FIELDS with check/cross icons, and a read-only comparison grid shows all active plans. Data is read via getOrgBilling and getPlansWithEntitlements in lib/billing/service (tables: subscriptions, plans, plan_entitlements, organization_members, projects, project_memory_items). The page writes nothing. Related screens: Members, Teams, External Contacts, Plans (admin).
Source: src/app/[locale]/(app)/organization/billing/page.tsx, src/lib/billing/service.ts, src/lib/billing/config.ts.
Verify: click Billing in the sidebar bottom navigation, or go to /organization/billing.

# ES: Pantalla Facturación de la organización

La pantalla de Facturación y plan es el centro de facturación a nivel de organización, accesible desde la navegación inferior de la barra lateral (Facturación, icono de tarjeta) en /organization/billing. Es una página renderizada por completo en el servidor. El encabezado muestra el nombre de la organización y enlaces rápidos a Miembros, Equipos y Contactos, más un enlace a Planes y precios visible solo para administradores de plataforma (isPlatformAdmin: lista PLATFORM_ADMIN_EMAILS o, en su defecto, el propietario de la organización). La tarjeta de Plan actual muestra la etiqueta del plan, el estado de la suscripción (activa, en prueba, vencida, cancelada, suspendida) y el precio mensual o anual; el botón "Gestionar suscripción" está deshabilitado a propósito con el aviso "Integración de pagos próximamente" — todavía no existe flujo de pago. La sección de Uso y límites compara seis métricas contra los límites del plan — usuarios facturables, proyectos activos, observadores gratis, documentos indexados, créditos de IA por mes y memoria en MB — con barras de progreso y avisos de límite calculados por checkLimit; las invitaciones pendientes no cuentan como asiento. Una tarjeta lista las funciones del plan y una cuadrícula de solo lectura compara los planes activos. Los datos se leen con getOrgBilling y getPlansWithEntitlements (tablas: subscriptions, plans, plan_entitlements, organization_members, projects, project_memory_items). La página no escribe nada. Pantallas relacionadas: Miembros, Equipos, Contactos externos y Planes (administración).
Fuente: src/app/[locale]/(app)/organization/billing/page.tsx, src/lib/billing/service.ts, src/lib/billing/config.ts.
Verifica: pulsa Facturación en la parte inferior de la barra lateral, o navega a /organization/billing.
