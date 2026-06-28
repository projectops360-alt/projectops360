-- ============================================================================
-- ProjectOps360° — Isabella PMO Portfolio Briefing knowledge (REG-013 follow-up)
-- ============================================================================
-- Incremental seed for the portfolio-briefing Q&A package added to the manifest
-- after the base corpus was already applied. Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-isabella-portfolio-briefing', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-isabella-portfolio-briefing', 'verified', '16-isabella-ai-workforce.md → Portfolio Health Briefing (PMO); 10-regression-log.md → REG-013')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-isabella-portfolio-briefing', 'en', 'Does Isabella give the PMO a portfolio briefing too?', 'Yes. The PM gets a project briefing inside a project; the PMO gets the same help one level up. When Isabella opens OUTSIDE a project for an owner/admin (PMO), she proactively shows a deterministic Portfolio Briefing across all projects: overall health, what looks good, what needs attention (blocked critical-path work, active blockers, at-risk milestones, high-impact risks, overdue, unassigned, pending decisions), the projects that need attention most (ranked, each with a drill-in link), the top recommended actions, and verify links (Command Center, Reports, Projects). It uses the same canonical rules as the Command Center (task-activity + roadmap progress), so the numbers agree — there is no AI call on open and nothing is invented. Members and viewers do not receive the portfolio briefing.
Source: 16-isabella-ai-workforce.md → Portfolio Health Briefing (PMO).
Verify: as a PMO (owner/admin) open Isabella on the Command Center/home → a Portfolio Briefing appears; as a non-PMO outside a project → only the generic prompt.'),
    ('pi-isabella-portfolio-briefing', 'es', '¿Isabella también le da al PMO un briefing del portafolio?', 'Sí. El PM recibe un briefing del proyecto dentro de un proyecto; el PMO recibe la misma ayuda un nivel más arriba. Cuando Isabella se abre FUERA de un proyecto para un owner/admin (PMO), muestra proactivamente un Briefing del Portafolio determinista sobre todos los proyectos: salud general, lo que va bien, lo que requiere atención (trabajo bloqueado de ruta crítica, bloqueos activos, hitos en riesgo, riesgos de alto impacto, vencidos, sin responsable, decisiones pendientes), los proyectos que más requieren atención (priorizados, cada uno con enlace para entrar), las principales acciones recomendadas, y enlaces de verificación (Command Center, Reportes, Proyectos). Usa las mismas reglas canónicas que el Command Center (task-activity + roadmap), así que los números coinciden — no hay llamada de IA al abrir y no inventa nada. Los miembros y viewers no reciben el briefing del portafolio.
Fuente: 16-isabella-ai-workforce.md → Portfolio Health Briefing (PMO).
Verifica: como PMO (owner/admin) abre Isabella en el Command Center/home → aparece un Briefing del Portafolio; como no-PMO fuera de un proyecto → solo el prompt genérico.')
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
