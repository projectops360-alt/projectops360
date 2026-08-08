---
slug: screen-living-graph-view-timeline-playback
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/overlay-metadata.ts
  - src/components/graph/living-graph-timeline.tsx
  - src/components/graph/living-graph-view.tsx
  - docs/product-brain/28-sprint-03-overlay-clarity.md
---

# EN: Living Graph — Timeline Playback

Timeline Playback answers "how did the project get here?" by replaying recorded process events in chronological order. Activate it from the Living Graph view selector (Execution Map → Living Graph → Overlay → "Timeline Playback"); the timeline layout is recommended. A transport bar appears under the canvas with play/pause, step back/forward, reset, a speed selector (0.5×–4×), a scrubber, and the current position plus the date and label of the event at the playhead. While playing, the playhead advances one event every 1.2 seconds divided by the speed. The visual rule is deterministic: nodes whose timestamp is after the playhead render as "not yet occurred" (dimmed, with their incoming edges hidden), nodes at or before it render as past, and the node matching the current event glows as active (matched per detail level; at the Milestones level no single node is active). The clarity legend reads: brand color = changed/active node, green = completed, slate = not yet occurred. Empty state is honest by design (PD-004): if all events fall on fewer than two distinct calendar days — typical of a one-shot import — the overlay shows "requires project history" instead of fake playback; limited history plays only what was captured. Switching overlays resets playback. Action: replay the evolution to understand decisions and delays. Source: src/lib/graph/overlay-metadata.ts, src/components/graph/living-graph-timeline.tsx, src/components/graph/living-graph-view.tsx. Verify: open a project → Execution Map → Living Graph → view selector → Timeline Playback.

# ES: Living Graph — Vista Reproducción de Línea de Tiempo

La Reproducción de Línea de Tiempo responde "¿cómo llegó aquí el proyecto?" reproduciendo los eventos de proceso registrados en orden cronológico. Se activa desde el selector de vistas del Living Graph (Execution Map → Living Graph → Capa → "Reproducción temporal"); se recomienda el layout de línea de tiempo. Bajo el lienzo aparece una barra de transporte con reproducir/pausar, paso atrás/adelante, reiniciar, selector de velocidad (0.5×–4×), un deslizador y la posición actual con la fecha y etiqueta del evento en el cabezal. Al reproducir, el cabezal avanza un evento cada 1.2 segundos divididos por la velocidad. La regla visual es determinista: los nodos con fecha posterior al cabezal se muestran como "aún no ocurridos" (atenuados y con sus aristas entrantes ocultas), los anteriores como pasado, y el nodo del evento actual brilla como activo (según el nivel de detalle; en el nivel Milestones no hay nodo activo único). La leyenda indica: color de marca = nodo cambiado/activo, verde = completado, gris = aún no ocurrido. El estado vacío es honesto por diseño (PD-004): si todos los eventos caen en menos de dos días calendario distintos — típico de una importación única — la capa muestra "requiere historial del proyecto" en lugar de una reproducción falsa; con historial limitado solo se reproduce lo capturado. Cambiar de capa reinicia la reproducción. Acción: reproduce la evolución para entender decisiones y retrasos. Fuente: src/lib/graph/overlay-metadata.ts, src/components/graph/living-graph-timeline.tsx, src/components/graph/living-graph-view.tsx. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Timeline Playback.
