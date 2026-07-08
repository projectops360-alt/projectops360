---
slug: screen-drawing-intelligence-global
route: /drawing-intelligence
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/drawing-intelligence/page.tsx
---

# EN: Drawing Intelligence (global) screen

The org-level entry point for the Drawing/BIM Intelligence module at `/drawing-intelligence`, reached from the navigation or from the AI Operator hub. It is a project selector, not the analysis surface itself. The server page (forced dynamic) queries two Supabase tables in parallel, both scoped to the organization and excluding soft-deleted rows: `projects` (id, slug, localized title) and `drawing_files` (id, project_id) to count drawings per project — the code notes that `drawing_files` may not exist until its migration is applied, in which case counts honestly degrade to zero. The header shows the module title and subtitle from the `drawingIntelligence` translations plus a highlighted badge (`notStorageNote`) clarifying this module is not a file-storage feature. If the org has projects, a card grid lists each project with its drawing count ("N drawings" or "no drawings yet"), and each card links to that project's own Drawing Intelligence tab at `/projects/{id}/drawing-intelligence`, where uploads and analysis actually happen. With no projects, a dashed empty state shows the `global.noProjects` message. Nothing is written from this screen. Related screens: per-project Drawing Intelligence, AI Operator, Projects list.

Source: src/app/[locale]/(app)/drawing-intelligence/page.tsx.
Verify: open /drawing-intelligence from the navigation and click a project card to land on that project's Drawing Intelligence tab.

# ES: Pantalla Drawing Intelligence (global)

El punto de entrada organizacional del módulo de inteligencia de planos/BIM en `/drawing-intelligence`, accesible desde la navegación o desde el hub del Operador IA. Es un selector de proyectos, no la superficie de análisis en sí. La página de servidor (dinámica forzada) consulta en paralelo dos tablas de Supabase, ambas limitadas a la organización y sin registros eliminados: `projects` (id, slug, título localizado) y `drawing_files` (id, project_id) para contar planos por proyecto — el código anota que `drawing_files` puede no existir hasta aplicar su migración, en cuyo caso los conteos degradan honestamente a cero. El encabezado muestra título y subtítulo de las traducciones `drawingIntelligence` más una insignia destacada (`notStorageNote`) aclarando que el módulo no es un almacén de archivos. Si hay proyectos, una cuadrícula de tarjetas lista cada proyecto con su conteo de planos ("N planos" o "sin planos aún"), y cada tarjeta enlaza a la pestaña Drawing Intelligence de ese proyecto en `/projects/{id}/drawing-intelligence`, donde realmente ocurren la subida y el análisis. Sin proyectos, se muestra un estado vacío con el mensaje `global.noProjects`. Desde esta pantalla no se escribe nada. Pantallas relacionadas: Drawing Intelligence por proyecto, Operador IA, Lista de proyectos.

Fuente: src/app/[locale]/(app)/drawing-intelligence/page.tsx.
Verifica: abre /drawing-intelligence desde la navegación y pulsa una tarjeta de proyecto para llegar a su pestaña de Drawing Intelligence.
