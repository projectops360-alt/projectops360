---
slug: screen-navigator-preview
route: /navigator-preview
domain: app_screens
tier: learned_pattern
sources:
  - src/app/navigator-preview/page.tsx
  - src/components/navigator/ProjectOpsNavigatorButton.tsx
  - src/components/navigator/ProjectOpsNavigatorDrawer.tsx
---

# EN: Navigator preview screen

A temporary development-only route. The file comment states it explicitly: "TEMPORARY preview route to visually verify the ProjectOpsNavigatorButton renders and the drawer opens. NOT part of the shipped feature — deleted after verification." The page wraps its content in a `NextIntlClientProvider` (locale "en", empty messages) and renders a faux app header — a ProjectOps360° label, a fake "Search everything… ⌘K" pill, a bell icon, and an avatar — so the real `ProjectOpsNavigatorButton` can be inspected in a realistic context. Clicking the bilingual Navigator button (Compass icon) opens the `ProjectOpsNavigatorDrawer`, the contextual help/guidance drawer whose sibling components include GuidedOnboardingProgress, ModuleGuidanceCard, NavigatorActions, NavigatorChecklist, and ProjectLifecycleMap. The main area only shows a heading and an instruction to click the button. The page reads and writes no Supabase data and calls no server actions. It lives outside the `[locale]` group and outside the authenticated `(app)` shell, so it is reachable without the normal app chrome. Related: the Navigator button itself ships in the real app header.

Source: src/app/navigator-preview/page.tsx, src/components/navigator/ProjectOpsNavigatorButton.tsx.
Verify: open /navigator-preview and click the Navigator button in the faux header to open the drawer.

# ES: Pantalla Vista previa del Navigator

Una ruta temporal solo para desarrollo. El comentario del archivo lo dice explícitamente: es una "vista previa TEMPORAL para verificar visualmente que el ProjectOpsNavigatorButton se renderiza y el drawer se abre. NO forma parte de la funcionalidad publicada — se elimina tras la verificación". La página envuelve su contenido en un `NextIntlClientProvider` (locale "en", mensajes vacíos) y muestra un encabezado de aplicación ficticio — etiqueta ProjectOps360°, una píldora falsa de búsqueda "⌘K", un icono de campana y un avatar — para inspeccionar el `ProjectOpsNavigatorButton` real en un contexto realista. Al hacer clic en el botón bilingüe Navigator (icono de brújula) se abre el `ProjectOpsNavigatorDrawer`, el panel contextual de ayuda cuyos componentes hermanos incluyen GuidedOnboardingProgress, ModuleGuidanceCard, NavigatorActions, NavigatorChecklist y ProjectLifecycleMap. El área principal solo muestra un título y la instrucción de pulsar el botón. No lee ni escribe datos en Supabase ni llama server actions, y vive fuera del grupo `[locale]` y del shell autenticado `(app)`.

Fuente: src/app/navigator-preview/page.tsx, src/components/navigator/ProjectOpsNavigatorButton.tsx.
Verifica: abre /navigator-preview y pulsa el botón Navigator del encabezado ficticio para abrir el drawer.
