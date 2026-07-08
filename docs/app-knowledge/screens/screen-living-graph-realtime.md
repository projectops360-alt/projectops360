---
slug: screen-living-graph-realtime
route: /projects/[projectId]/execution-map/realtime
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/realtime/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/realtime/actions.ts
  - src/lib/living-graph-realtime-ui/load-snapshot.ts
  - src/components/living-graph-realtime/realtime-living-graph.tsx
---

# EN: Realtime Living Graph screen

The Realtime Living Graph ("Project Execution Map — Realtime") is a full-viewport, live, hierarchy-safe execution graph reached via the "Realtime" link in the Living Graph header. The server page (force-dynamic) loads an initial snapshot through `loadRealtimeGraphSnapshot`, which reads from the canonical owners (never `process_nodes` or raw events) and fails closed — if the project is not in the caller's organization it renders notFound. The client (RealtimeLivingGraph) narrows the graph NotebookLM-style: you start from a milestone-scoped root and click nodes to reveal the next level; "Expand all" stays scoped to the selected milestone/task, with a large-graph guard that asks you to arm the action before expanding big scopes. It includes milestone focus, a node inspector, a sync bar, and evidence/dependency overlays. Delivery combines a live Supabase channel push with a polling fallback: the client polls a cheap content signature via `getRealtimeGraphSignatureAction` and refetches the approved snapshot delta via `getRealtimeGraphSnapshotAction` only when the signature changes. The screen never mutates canonical data. A header link returns to the Living Graph. Related screens: screen-living-graph, screen-execution-map.
Source: realtime/page.tsx, realtime/actions.ts, components/living-graph-realtime/realtime-living-graph.tsx.
Verify: Living Graph > "Realtime" button (/projects/[projectId]/execution-map/realtime).

# ES: Pantalla Grafo Vivo en Tiempo Real

El Grafo Vivo en Tiempo Real ("Mapa de Ejecución del Proyecto — Tiempo Real") es un grafo de ejecución en vivo, jerárquicamente seguro y a pantalla completa, accesible con el enlace "Tiempo real" del encabezado del Grafo Vivo. La página de servidor (force-dynamic) carga un snapshot inicial con `loadRealtimeGraphSnapshot`, que lee de los dueños canónicos (nunca de `process_nodes` ni de eventos crudos) y falla de forma cerrada: si el proyecto no pertenece a la organización del usuario, muestra notFound. El cliente (RealtimeLivingGraph) estrecha el grafo al estilo NotebookLM: se parte de una raíz por hito y se hace clic en los nodos para revelar el siguiente nivel; "Expandir todo" queda acotado al hito o tarea seleccionados, con una salvaguarda para grafos grandes que pide confirmación antes de expandir ámbitos extensos. Incluye enfoque por hito, un inspector de nodos, una barra de sincronización y superposiciones de evidencia y dependencias. La entrega combina un canal en vivo de Supabase con un respaldo por sondeo: el cliente consulta una firma de contenido barata con `getRealtimeGraphSignatureAction` y solo cuando cambia recarga el delta aprobado con `getRealtimeGraphSnapshotAction`. La pantalla nunca muta datos canónicos. Un enlace regresa al Grafo Vivo. Pantallas relacionadas: screen-living-graph, screen-execution-map.
Fuente: realtime/page.tsx, realtime/actions.ts, components/living-graph-realtime/realtime-living-graph.tsx.
Verifica: Grafo Vivo > botón "Tiempo real" (/projects/[projectId]/execution-map/realtime).
