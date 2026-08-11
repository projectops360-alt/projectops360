---
slug: screen-landing
route: /landing
domain: app_screens
tier: learned_pattern
sources:
  - src/app/landing/page.tsx
  - src/app/landing/layout.tsx
  - src/components/landing/hero.tsx
  - src/components/landing/nav.tsx
  - src/components/landing/pricing.tsx
  - src/components/landing/capabilities.tsx
  - src/components/landing/auth-links.ts
  - src/lib/billing/public-plans.ts
  - src/lib/billing/config.ts
  - src/middleware.ts
---

# EN: Landing screen

The public marketing page of ProjectOps360°, served at `/landing` outside the authenticated app shell and outside the `[locale]` route group. You reach it by clicking the URL directly, or automatically: the middleware redirects any anonymous visitor hitting the site root (`/` or `/es`) to `/landing` rather than to the login form. It is a server component that awaits `connection()` and then composes Hero (landing nav bar, background image, animated hero graph, logos strip), Capabilities, Methodology, Industries, Comms, AiSection, Quote, About, Pricing, FinalCta and Footer; the layout wraps everything in `LandingI18nProvider` and mounts `LandingPwaInstallPrompt`, the app-install banner. Pricing is no longer hardcoded: `getPublicPricingPlans()` reads the active rows of the `plans` table (`plan_code`, `name`, `price_monthly`, `price_yearly`, `currency`, `is_enterprise`, `sort_order`) with the admin client, joins the plan capability catalog, and the client renders each card, formats the price with `Intl.NumberFormat`, marks `business` as most popular and points every CTA at `signup?plan=<planCode>`. This is the only Supabase read on the page; nothing is written and no server action runs. Copy uses react-i18next deliberately, not next-intl, and `useAuthPaths` mirrors that choice onto the app routes, so a Spanish visitor is sent to `/es/login` and `/es/signup`. Related: screen-login, screen-signup, screen-org-plans.
Source: src/app/landing/{page,layout}.tsx, src/components/landing/*, src/lib/billing/public-plans.ts, src/middleware.ts.
Verify: open the site root while logged out — you land on /landing; scroll to Pricing and check the plans match the `plans` table.

# ES: Pantalla Landing

La página pública de marketing de ProjectOps360°, servida en `/landing` fuera del shell autenticado y fuera del grupo de rutas `[locale]`. Se llega escribiendo la URL o de forma automática: el middleware redirige a `/landing` a cualquier visitante anónimo que entre a la raíz del sitio (`/` o `/es`), en lugar de mandarlo al formulario de inicio de sesión. Es un componente de servidor que espera `connection()` y luego compone Hero (barra de navegación, imagen de fondo, grafo animado y franja de logotipos), Capabilities, Methodology, Industries, Comms, AiSection, Quote, About, Pricing, FinalCta y Footer; el layout envuelve todo en `LandingI18nProvider` y monta `LandingPwaInstallPrompt`, el banner de instalación de la aplicación. Los precios ya no están escritos en el código: `getPublicPricingPlans()` lee con el cliente admin las filas activas de la tabla `plans` (`plan_code`, `name`, `price_monthly`, `price_yearly`, `currency`, `is_enterprise`, `sort_order`), las cruza con el catálogo de capacidades por plan, y el cliente dibuja cada tarjeta, formatea el importe con `Intl.NumberFormat`, marca `business` como el más popular y dirige cada CTA a `signup?plan=<planCode>`. Esa es la única lectura de Supabase de la página; no escribe nada ni ejecuta server actions. Los textos usan react-i18next a propósito, no next-intl, y `useAuthPaths` traslada esa elección a las rutas de la aplicación, de modo que un visitante en español va a `/es/login` y `/es/signup`. Relacionadas: screen-login, screen-signup, screen-org-plans.
Fuente: src/app/landing/{page,layout}.tsx, src/components/landing/*, src/lib/billing/public-plans.ts, src/middleware.ts.
Verifica: abre la raíz del sitio sin sesión iniciada — caes en /landing; baja hasta Precios y comprueba que los planes coinciden con la tabla `plans`.
