-- ============================================================================
-- ProjectOps360° — UX-014 / PD-013 task "AI Prompt" field removal knowledge
-- ============================================================================
-- Lets Isabella answer where the task "AI Prompt / Prompt de IA" field went,
-- how to ask AI about a task now, and whether old data was deleted. Idempotent.
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-task-ai-prompt-removed', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-task-ai-prompt-removed', 'verified', '32-product-ux-contracts.md → UX-014; 30-product-decision-log.md → PD-013')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-task-ai-prompt-removed', 'en', 'Where did the task AI Prompt field go? How do I ask AI about a task?',
'The task editor no longer shows an "AI Prompt" field. That field was internal implementation metadata (the prompt used during AI-assisted development and the target AI tool), not a user-facing AI interaction — and it confused users who expected typing in it to produce an AI answer.

- To ask AI about a task, use "Ask Isabella about this task" in the task editor. Isabella opens and analyzes the current task context (title, description, status, owner, dates, acceptance criteria, notes) and responds in the assistant panel.
- Was the old prompt data deleted? No. Any existing internal prompt metadata was preserved (a normal task save never nulls it); it is simply no longer shown as a normal user-facing field.
- Normal task fields are unchanged: description, status, priority, dates, acceptance criteria, implementation notes, testing notes, assignment.
Source: UX-014 / PD-013. Verify: open Workboard → open a task → there is no "Prompt de IA" field, and an "Ask Isabella about this task" action is present.'),
    ('pi-task-ai-prompt-removed', 'es', '¿A dónde se fue el campo Prompt de IA de la tarea? ¿Cómo le pido a la IA que la analice?',
'El editor de tareas ya no muestra un campo "Prompt de IA". Ese campo era metadato interno de implementación (el prompt usado durante el desarrollo asistido por IA y la herramienta de IA destino), no una interacción de IA para el usuario — y confundía a quienes esperaban que escribir ahí generara una respuesta de IA.

- Para pedir análisis de IA sobre una tarea, usa "Preguntar a Isabella sobre esta tarea" en el editor. Isabella se abre y analiza el contexto actual de la tarea (título, descripción, estado, responsable, fechas, criterios de aceptación, notas) y responde en el panel del asistente.
- ¿Se borraron los datos del prompt anterior? No. Cualquier metadato interno existente se conservó (un guardado normal nunca lo borra); simplemente ya no se muestra como campo normal.
- Los campos normales de la tarea no cambian: descripción, estado, prioridad, fechas, criterios de aceptación, notas de implementación, notas de prueba, asignación.
Fuente: UX-014 / PD-013. Verifica: abre el Workboard → abre una tarea → no hay campo "Prompt de IA", y existe la acción "Preguntar a Isabella sobre esta tarea".')
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
