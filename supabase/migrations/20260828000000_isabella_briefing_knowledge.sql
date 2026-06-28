-- ============================================================================
-- ProjectOps360° — Isabella Project Health Briefing knowledge (REG-013)
-- ============================================================================
-- Incremental seed for the two new Product Brain packages added to the manifest
-- (src/lib/knowledge-os/seeds/product-brain-knowledge.ts) AFTER the base
-- corpus migration 20260817 was already applied to production. The base file is
-- regenerated for fresh DBs (no-drift test), but applied environments need this
-- delta. Idempotent (ON CONFLICT DO NOTHING); embeddings filled by the indexer.
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-isabella-project-briefing', 'product_intelligence', 'published', 'en'),
    (NULL, 'pi-isabella-briefing-no-invention', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-isabella-project-briefing', 'verified', '16-isabella-ai-workforce.md → Project Health Briefing; 10-regression-log.md → REG-013'),
    ('pi-isabella-briefing-no-invention', 'verified', '16-isabella-ai-workforce.md → Project Health Briefing; 10-regression-log.md → REG-013')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-isabella-project-briefing', 'en', 'Why does Isabella show a briefing when I open her inside a project?', 'Because Isabella is project-aware. When opened inside a project she does not wait passively — she checks deterministic project status data and gives a grounded Project Health Briefing about health, blockers (separate from waiting-on-dependency), overdue work, capacity warnings, open risks, recent decisions, and the top recommended next actions, with links to verify each finding (Workboard, Living Graph, Resource Capacity, Project Memory, Status Report). The briefing is built from the canonical rollup and roadmap engines — there is no AI call on open. Opened OUTSIDE a project she keeps the generic guide prompt. Use Refresh briefing to re-run it; Dismiss hides it for the current session only.
Source: 16-isabella-ai-workforce.md → Project Health Briefing (REG-013).
Verify: open any project → Isabella → a Project Briefing appears on load; open Isabella outside a project → only the generic guide prompt.'),
    ('pi-isabella-project-briefing', 'es', '¿Por qué Isabella muestra un briefing cuando la abro dentro de un proyecto?', 'Porque Isabella es consciente del proyecto. Al abrirse dentro de un proyecto no espera pasivamente — revisa datos deterministas de estado y entrega un Briefing de Salud del Proyecto fundamentado sobre la salud, los bloqueos (separados de la espera por dependencia), el trabajo vencido, las advertencias de capacidad, los riesgos abiertos, las decisiones recientes y las principales acciones recomendadas, con enlaces para verificar cada hallazgo (Workboard, Living Graph, Capacidad de Recursos, Memoria del Proyecto, Reporte de Estado). El briefing se construye con los motores canónicos de rollup y roadmap — no hay llamada de IA al abrir. Abierta FUERA de un proyecto mantiene el prompt genérico de guía. Usa Actualizar briefing para volver a generarlo; Ocultar lo esconde solo durante la sesión actual.
Fuente: 16-isabella-ai-workforce.md → Project Health Briefing (REG-013).
Verifica: abre cualquier proyecto → Isabella → aparece un Briefing del Proyecto al cargar; abre Isabella fuera de un proyecto → solo el prompt genérico de guía.'),
    ('pi-isabella-briefing-no-invention', 'en', 'Does Isabella invent project issues in the briefing?', 'No. Isabella only reports issues supported by project data — rollups, Project Memory, risks, capacity, and execution status. She never invents blockers, risks, owners, dates, overdue status, capacity values, critical-path impact, or recommendations. Blocked and Waiting on Dependency are reported separately, and completed/terminal tasks are NEVER counted as active blockers (REG-008/010). If data is missing she says "I don''t have enough data to evaluate X yet"; if nothing is wrong she says the project looks stable. You can refresh the briefing with Refresh briefing.
Source: 16-isabella-ai-workforce.md → Project Health Briefing; REG-013 no-hallucination rules.
Verify: a project with 0 blockers shows "No active blockers detected"; a stale flag on a completed task never appears as a blocker.'),
    ('pi-isabella-briefing-no-invention', 'es', '¿Isabella inventa problemas del proyecto en el briefing?', 'No. Isabella solo reporta problemas respaldados por datos del proyecto — rollups, Memoria del Proyecto, riesgos, capacidad y estado de ejecución. Nunca inventa bloqueos, riesgos, responsables, fechas, estado de vencimiento, valores de capacidad, impacto en la ruta crítica ni recomendaciones. Bloqueado y En espera por dependencia se reportan por separado, y las tareas completadas/terminales NUNCA cuentan como bloqueos activos (REG-008/010). Si faltan datos dice "Aún no tengo datos suficientes para evaluar X"; si no hay problemas dice que el proyecto se ve estable. Puedes regenerar el briefing con Actualizar briefing.
Fuente: 16-isabella-ai-workforce.md → Project Health Briefing; reglas anti-alucinación de REG-013.
Verifica: un proyecto con 0 bloqueos muestra "No se detectan bloqueos activos"; un flag obsoleto en una tarea completada nunca aparece como bloqueo.')
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
