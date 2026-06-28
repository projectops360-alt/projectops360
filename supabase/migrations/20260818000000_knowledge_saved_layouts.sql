-- ============================================================================
-- ProjectOps360° — Isabella corpus: Living Graph Saved Layouts (UX-007 / PD-008)
-- ============================================================================
-- Additive seed for the single new Product Brain package
-- `pi-living-graph-saved-layouts`. The canonical generated seed
-- (20260817000000_knowledge_product_brain.sql) was already applied in prod, so
-- this incremental migration delivers ONLY the new package to the already-seeded
-- corpus. Same CTE shape as the generator; idempotent (ON CONFLICT DO NOTHING +
-- RETURNING means a second run inserts nothing). Embeddings fill via the existing
-- indexer; lexical search works immediately.
-- Mirrors src/lib/knowledge-os/seeds/product-brain-knowledge.ts — edit there and
-- regenerate the canonical file; keep this body in sync if the package changes.
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-living-graph-saved-layouts', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-living-graph-saved-layouts', 'verified', 'Product Decision PD-008 (UX-007); 12-living-graph-strategy.md → Manual workspace organization')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-living-graph-saved-layouts', 'en', 'How do I save the Living Graph layout?', 'In ProjectOps360°, you can manually arrange nodes in the Living Graph and click Save Layout. The saved layout is visual only — it does NOT change tasks, dependencies, blockers, edges, execution status, capacity, or project data; it stores node positions and the viewport. It is saved for the current project and graph context (view level + layout mode) and is personal to you. Switching layout mode or level loads that context''s saved layout rather than destroying your arrangement. You can reset to auto-layout, reset to your saved layout, or clear it at any time. When the graph changes, existing nodes with saved positions are restored and new nodes are placed automatically (a notice tells you the layout was partially applied); deleted nodes are ignored. Saving never changes graph edges or relationships — node position is presentation state only.
Source: Product Decision PD-008 (UX-007) / 12-living-graph-strategy.md → Manual workspace organization.
Verify: Execution Map → Living Graph → drag nodes → Save Layout (top-center); refresh and the arrangement returns. Use the layout menu to reset to auto-layout or clear.'),
    ('pi-living-graph-saved-layouts', 'es', '¿Cómo guardo el diseño del Living Graph?', 'En ProjectOps360°, puedes acomodar manualmente los nodos del Living Graph y hacer clic en Guardar diseño. El diseño guardado es solo visual — NO cambia tareas, dependencias, bloqueos, aristas, estado de ejecución, capacidad ni datos del proyecto; almacena las posiciones de los nodos y el viewport. Se guarda para el proyecto y el contexto de grafo actual (nivel de vista + modo de diseño) y es personal tuyo. Cambiar de modo de diseño o de nivel carga el diseño guardado de ese contexto en lugar de destruir tu disposición. Puedes restaurar el diseño automático, restaurar tu diseño guardado o borrarlo cuando quieras. Cuando el grafo cambia, los nodos existentes con posición guardada se restauran y los nodos nuevos se colocan automáticamente (un aviso indica que el diseño se aplicó parcialmente); los nodos eliminados se ignoran. Guardar nunca cambia las aristas ni las relaciones del grafo — la posición del nodo es solo estado de presentación.
Fuente: Decisión de Producto PD-008 (UX-007) / 12-living-graph-strategy.md → Manual workspace organization.
Verifica: Execution Map → Living Graph → arrastra nodos → Guardar diseño (arriba al centro); recarga y la disposición vuelve. Usa el menú de diseño para restaurar el automático o borrar.')
  ) AS c(slug, language, title, body) ON c.slug = p.slug
  RETURNING id, version_id, package_id, organization_id, language, body
)
INSERT INTO public.knowledge_chunks (
  localization_id, version_id, package_id, organization_id, language,
  ordinal, body, content_hash, index_status
)
SELECT
  l.id, l.version_id, l.package_id, l.organization_id, l.language,
  0, l.body, encode(digest(l.body, 'sha256'), 'hex'), 'pending'
FROM loc l;
