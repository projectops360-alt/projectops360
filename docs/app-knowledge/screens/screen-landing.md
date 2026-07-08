---
slug: screen-landing
route: /landing
domain: app_screens
tier: learned_pattern
sources:
  - src/app/landing/page.tsx
  - src/components/landing/hero.tsx
  - src/components/landing/pricing.tsx
  - src/components/landing/capabilities.tsx
---

# EN: Landing screen

The public marketing page of ProjectOps360°, served at `/landing` outside the authenticated app shell and outside the `[locale]` route group. It is a static composition of eleven landing components rendered in order: Hero (with the landing navigation bar, an animated hero graph, and a logos strip), Capabilities, Methodology, Industries, Comms, AiSection, Quote, About, Pricing, FinalCta, and Footer. The Pricing section presents four plans defined in code — Personal (per month), Team and Business (per user/month, Business is the featured plan), and Enterprise (no listed price) — with feature checklists. Copy is translated with react-i18next (unlike the app, which uses next-intl), and call-to-action buttons resolve their destinations through the `useAuthPaths` helper, pointing visitors to the login and signup screens. The page reads and writes no Supabase data and calls no server actions; it is purely presentational marketing content with decorative animated backgrounds. Related screens: Login (`/login`) and Signup (`/signup`), which the hero, pricing, and final CTA link into.

Source: src/app/landing/page.tsx, src/components/landing/*.tsx.
Verify: open /landing while logged out and scroll through the sections; the CTAs lead to /login and /signup.

# ES: Pantalla Landing

La página pública de marketing de ProjectOps360°, servida en `/landing` fuera del shell autenticado de la aplicación y fuera del grupo de rutas `[locale]`. Es una composición estática de once componentes de landing renderizados en orden: Hero (con la barra de navegación, un grafo animado y una franja de logotipos), Capabilities, Methodology, Industries, Comms, AiSection, Quote, About, Pricing, FinalCta y Footer. La sección de precios presenta cuatro planes definidos en el código — Personal (por mes), Team y Business (por usuario/mes; Business es el plan destacado) y Enterprise (sin precio listado) — con listas de características. Los textos se traducen con react-i18next (a diferencia de la aplicación, que usa next-intl), y los botones de llamada a la acción resuelven su destino mediante el helper `useAuthPaths`, dirigiendo a los visitantes a las pantallas de inicio de sesión y registro. La página no lee ni escribe datos en Supabase y no llama server actions; es contenido de marketing puramente presentacional. Pantallas relacionadas: Login (`/login`) y Signup (`/signup`).

Fuente: src/app/landing/page.tsx, src/components/landing/*.tsx.
Verifica: abre /landing sin sesión iniciada y recorre las secciones; los CTA llevan a /login y /signup.
