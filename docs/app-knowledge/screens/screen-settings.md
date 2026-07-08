---
slug: screen-settings
route: /settings
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/settings/page.tsx
  - src/components/settings/theme-control.tsx
  - src/components/settings/language-control.tsx
---

# EN: Settings screen

The personal preferences screen at `/settings` inside the authenticated app. It is intentionally small: after confirming the session with `getOrgContext()`, the server page renders two cards with inline bilingual copy. The Appearance card hosts `ThemeControl`, letting the user pick Light, Dark, or System theme. The Language card hosts `LanguageControl`, which offers English and Español buttons; selecting one writes the `NEXT_LOCALE` cookie (one-year max-age) and hard-navigates to the equivalent localized URL via `buildLocaleSwitchPath`, so the whole app reloads in the chosen language — the page copy states this explicitly. No Supabase tables are read or written on this screen and there are no server actions; preferences are client-side (cookie/theme). Organization-level configuration is not here: billing, plans, members, teams, and external contacts live under `/organization/*`, and per-project settings live in each project's own Settings tab. Related screens: Team (workspace users), the Organization pages, and every localized screen affected by the language switch.

Source: src/app/[locale]/(app)/settings/page.tsx, src/components/settings/theme-control.tsx, src/components/settings/language-control.tsx.
Verify: open Settings from the app navigation, toggle the theme, then switch the language and watch the app reload in the other locale.

# ES: Pantalla Configuración

La pantalla de preferencias personales en `/settings`, dentro de la aplicación autenticada. Es intencionalmente pequeña: tras confirmar la sesión con `getOrgContext()`, la página de servidor muestra dos tarjetas con textos bilingües en línea. La tarjeta Apariencia contiene `ThemeControl`, que permite elegir tema Claro, Oscuro o Sistema. La tarjeta Idioma contiene `LanguageControl`, con botones English y Español; al elegir uno se escribe la cookie `NEXT_LOCALE` (vigencia de un año) y se navega de forma dura a la URL localizada equivalente mediante `buildLocaleSwitchPath`, de modo que toda la aplicación se recarga en el idioma elegido — el propio texto de la página lo indica. En esta pantalla no se leen ni escriben tablas de Supabase y no hay server actions; las preferencias son del lado del cliente (cookie/tema). La configuración organizacional no está aquí: facturación, planes, miembros, equipos y contactos externos viven bajo `/organization/*`, y los ajustes por proyecto en la pestaña Settings de cada proyecto. Pantallas relacionadas: Equipo, las páginas de Organización y todas las pantallas afectadas por el cambio de idioma.

Fuente: src/app/[locale]/(app)/settings/page.tsx, src/components/settings/theme-control.tsx, src/components/settings/language-control.tsx.
Verifica: abre Configuración desde la navegación, cambia el tema y luego el idioma; la aplicación se recarga en el otro idioma.
