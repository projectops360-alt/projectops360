-- Isabella knowledge delta for REG-026. Idempotent; embeddings are filled by
-- the existing Knowledge OS indexer after deployment.

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES (NULL, 'pi-import-milestone-order-integrity', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (
    package_id, organization_id, version_no, is_current, confidence_tier, source_refs
  )
  SELECT
    p.id, NULL, 1, true, 'verified',
    jsonb_build_array('import-order-integrity.md; 10-regression-log.md → REG-026')
  FROM pkg p
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (
    version_id, package_id, organization_id, language, title, body
  )
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN (VALUES
    (
      'en',
      'Why can an imported milestone appear before P0, and how is it fixed?',
      E'Imported milestone order is project data. ProjectOps360° preserves the canonical source sequence in project_import_entities.source_order and writes it to milestones.order_index; the Living Graph renders that order and must never infer precedence from UUIDs, timestamps, database return order, or visual node position. If the order is wrong, verify the source file, import source_order, project milestone order_index, and graph projection—in that order. Repair only the verified project''s milestone indexes, then query and compare the exact final sequence. Do not drag nodes to hide corrupted data and do not modify tasks, dependencies, events, other projects, or saved layouts.\nSource: import-order-integrity.md; REG-026.\nVerify: inspect the project''s milestones ordered by order_index, then open Execution Map → Living Graph → Milestones.'
    ),
    (
      'es',
      '¿Por qué un hito importado puede aparecer antes de P0 y cómo se corrige?',
      E'El orden de los hitos importados es un dato del proyecto. ProjectOps360° conserva la secuencia canónica en project_import_entities.source_order y la escribe en milestones.order_index; el Living Graph representa ese orden y nunca debe inferir precedencia por UUID, fechas, orden de retorno de la base de datos ni posición visual. Si el orden está mal, verifica en este orden: archivo fuente, source_order de la importación, order_index de los hitos y proyección del grafo. Corrige únicamente los índices de hitos del proyecto verificado y luego consulta y compara la secuencia final exacta. No arrastres nodos para ocultar datos corruptos ni modifiques tareas, dependencias, eventos, otros proyectos o layouts guardados.\nFuente: import-order-integrity.md; REG-026.\nVerifica: consulta los hitos del proyecto ordenados por order_index y luego abre Execution Map → Living Graph → Hitos.'
    )
  ) AS c(language, title, body) ON true
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
