---
slug: screen-living-graph-view-whatif-simulation
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/overlay-metadata.ts
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-simulation-panel.tsx
  - src/components/graph/living-graph-view.tsx
  - docs/product-brain/28-sprint-03-overlay-clarity.md
---

# EN: Living Graph — What-if Simulation

What-if Simulation answers "what happens if something changes?" without touching real data. Activate it from the Living Graph view selector (Execution Map → Living Graph → Overlay → "What-if Simulation"), then click any node; until you do, a banner and the clarity card say "pick a node to simulate". A floating cockpit panel offers six deterministic scenarios: delay 1 day / 3 days / 1 week, mark as blocked (assumes ~5 days held), remove blocker (recovers ~3 days), and duration +50% of the node's own duration. The engine propagates the delay downstream through outgoing dependencies (up to 12 hops), attenuating 15% per hop to account for parallel slack, and reports: estimated propagated days, affected node count, how many affected nodes sit on the critical path, up to three milestones at risk, the strongest downstream dependency, and a risk delta (high when the critical path is hit or 5+ nodes are affected; medium at 2+; low otherwise). The panel compares "Current plan" vs "Simulated plan" in days, and affected nodes get an orange impact ring; red marks critical-path impact, slate means "not applied (estimate)". It is a sandbox by contract (PD-005): no project data changes, and "Apply simulation" does not exist yet. Action: test a scenario, then mitigate — resequence, resolve upstream blockers, or re-baseline. Source: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-simulation-panel.tsx, src/lib/graph/overlay-metadata.ts. Verify: open a project → Execution Map → Living Graph → view selector → What-if Simulation.

# ES: Living Graph — Vista Simulación What-if

La Simulación What-if responde "¿qué pasa si algo cambia?" sin tocar datos reales. Se activa desde el selector de vistas del Living Graph (Execution Map → Living Graph → Capa → "Simulación what-if") y luego se hace clic en cualquier nodo; mientras no lo hagas, un aviso y la tarjeta de claridad piden "elige un nodo para simular". Un panel flotante ofrece seis escenarios deterministas: retrasar 1 día / 3 días / 1 semana, marcar como bloqueado (asume ~5 días retenidos), quitar bloqueo (recupera ~3 días) y duración +50% de la duración propia del nodo. El motor propaga el retraso aguas abajo por las dependencias salientes (hasta 12 saltos), atenuando 15% por salto por la holgura del trabajo paralelo, y reporta: días propagados estimados, cantidad de nodos afectados, cuántos están en la ruta crítica, hasta tres hitos en riesgo, la dependencia aguas abajo más fuerte y un delta de riesgo (alto si toca la ruta crítica o afecta 5+ nodos; medio con 2+; bajo en otro caso). El panel compara "Plan actual" vs "Plan simulado" en días, y los nodos afectados llevan un anillo naranja de impacto; el rojo marca ruta crítica afectada y el gris "no aplicado (estimación)". Es un sandbox por contrato (PD-005): ningún dato del proyecto cambia y "Aplicar simulación" aún no existe. Acción: prueba un escenario y mitiga — re-secuencia, resuelve bloqueos aguas arriba o re-planifica la línea base. Fuente: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-simulation-panel.tsx, src/lib/graph/overlay-metadata.ts. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → What-if Simulation.
