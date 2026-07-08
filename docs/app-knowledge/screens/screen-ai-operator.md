---
slug: screen-ai-operator
route: /ai-operator
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/ai-operator/page.tsx
---

# EN: AI Operator screen

A lightweight hub at `/ai-operator` that groups the app's AI-powered intake modules. After confirming the session with `getOrgContext()`, the page shows a centered Bot icon with a title and description pulled from the next-intl `placeholders.aiOperator` namespace — the "placeholders" namespace is an honest signal that this surface is still an early hub rather than a full module. Below the header are exactly two navigation cards. The first, "Project Import Intelligence", links to `/import` and describes uploading Excel, CSV, JSON, Word, or PDF files to turn them into a full project (bilingual copy is inlined in the component). The second links to the global Drawing Intelligence screen at `/drawing-intelligence`, with its title and description coming from the `drawingIntelligence.aiOperatorCard` translations. Both cards are simple `Link`s with hover affordances and arrow icons. The screen reads no Supabase tables beyond the auth/org check, writes nothing, and calls no server actions — it is purely a launcher. There is no chat or agent execution on this page despite the name. Related screens: Import (`/import`), global Drawing Intelligence (`/drawing-intelligence`), and the Home dashboard whose "AI Operator Briefing" section is a separate, data-driven feature.

Source: src/app/[locale]/(app)/ai-operator/page.tsx.
Verify: open /ai-operator from the app; the two cards navigate to Import and Drawing Intelligence.

# ES: Pantalla Operador IA

Un hub ligero en `/ai-operator` que agrupa los módulos de ingesta con IA de la aplicación. Tras confirmar la sesión con `getOrgContext()`, la página muestra un icono de robot centrado con título y descripción tomados del namespace `placeholders.aiOperator` de next-intl — que el namespace se llame "placeholders" es una señal honesta de que esta superficie sigue siendo un hub inicial y no un módulo completo. Bajo el encabezado hay exactamente dos tarjetas de navegación. La primera, "Importación Inteligente de Proyectos", enlaza a `/import` y describe subir archivos Excel, CSV, JSON, Word o PDF para convertirlos en un proyecto completo (texto bilingüe en el propio componente). La segunda enlaza a la pantalla global de Drawing Intelligence en `/drawing-intelligence`, con título y descripción de las traducciones `drawingIntelligence.aiOperatorCard`. Ambas tarjetas son simples `Link` con efectos al pasar el cursor. La pantalla no lee tablas de Supabase más allá de la verificación de sesión, no escribe nada y no llama server actions — es puramente un lanzador. A pesar del nombre, aquí no hay chat ni ejecución de agentes. Pantallas relacionadas: Importación (`/import`), Drawing Intelligence global (`/drawing-intelligence`) y el dashboard de inicio, cuyo "Resumen del Operador IA" es una funcionalidad aparte basada en datos.

Fuente: src/app/[locale]/(app)/ai-operator/page.tsx.
Verifica: abre /ai-operator en la aplicación; las dos tarjetas navegan a Importación y Drawing Intelligence.
