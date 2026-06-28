-- ============================================================================
-- ProjectOps360° — Closeout Report process knowledge (UX-010)
-- ============================================================================
-- Incremental seed for the UX-010 Q&A package added to the manifest after the
-- base corpus was already applied. Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-closeout-report-process', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-closeout-report-process', 'verified', '32-product-ux-contracts.md → UX-010; docs/user-manual.md → Project Closeout')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-closeout-report-process', 'en', 'How do I generate the Closeout Report?', 'Open Command Center → Closeout Report. The page guides you through the process: (1) check closeout readiness, (2) resolve pending requirements (each one links to where you fix it — e.g. open tasks → Workboard, decisions → Decisions, budget → Budget), (3) run the Closing Project meeting in Project Memory → Rhythm Center, (4) once that meeting is completed, generate the AI Executive Summary, (5) review the report, (6) Download PDF. The Closing Project meeting runs in the Rhythm Center; the AI narrative is generated only after that meeting is completed — Download PDF exports the report, it does NOT generate the narrative. A Closeout Report is pending when one or more closeout requirements are incomplete (unresolved risks, decisions, follow-ups, open tasks, or missing budget data). Generating the summary requires PM/PMO/member permission (not viewers).
Source: 32-product-ux-contracts.md → UX-010 (Closeout Report process).
Verify: open a project → Closeout Report → the guided workflow + a state-appropriate primary button (Create/Open Closing Project Meeting · Generate Executive Summary · Download PDF).'),
    ('pi-closeout-report-process', 'es', '¿Cómo genero el Reporte de Cierre?', 'Abre Command Center → Reporte de Cierre. La página te guía por el proceso: (1) revisar la preparación de cierre, (2) resolver los requisitos pendientes (cada uno enlaza a dónde se resuelve — p. ej. tareas abiertas → Workboard, decisiones → Decisiones, presupuesto → Presupuesto), (3) ejecutar la reunión de Cierre del Proyecto en Project Memory → Rhythm Center, (4) una vez completada esa reunión, generar el Resumen Ejecutivo con IA, (5) revisar el reporte, (6) Descargar PDF. La reunión de Cierre del Proyecto se ejecuta en el Rhythm Center; la narrativa con IA se genera solo después de completar esa reunión — Descargar PDF exporta el reporte, NO genera la narrativa. Un Reporte de Cierre está pendiente cuando hay requisitos de cierre incompletos (riesgos, decisiones o seguimientos sin resolver, tareas abiertas, o falta de datos de presupuesto). Generar el resumen requiere permiso de PM/PMO/miembro (no visores).
Fuente: 32-product-ux-contracts.md → UX-010 (proceso del Reporte de Cierre).
Verifica: abre un proyecto → Reporte de Cierre → el flujo guiado + un botón principal según el estado (Crear/Abrir reunión de Cierre · Generar Resumen Ejecutivo · Descargar PDF).')
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
