-- ============================================================================
-- ProjectOps360° — Evidence Provenance & Traceability knowledge (PD-012)
-- ============================================================================
-- Teaches Isabella to answer provenance questions ("where did this task come
-- from?", "how many tasks came from voice notes?", "which decisions came from
-- meetings?"). The EXACT NUMBERS and SOURCES come from the deterministic
-- PROVENANCE FACTS block stamped into her context server-side (PD-012); this
-- package teaches her HOW to use them and the hard honesty rules:
--   • cite the source record, include the excerpt when present;
--   • say the source is UNKNOWN (a traceability gap) when no record exists;
--   • NEVER infer a source from text similarity.
--
-- Idempotent (ON CONFLICT DO NOTHING). Lexical retrieval finds it immediately;
-- vector retrieval activates after the chunks are embedded by the indexer.
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-evidence-provenance', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-evidence-provenance', 'verified', '30-product-decision-log.md → PD-012 Evidence Provenance; 17-project-memory.md; 16-isabella-ai-workforce.md')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-evidence-provenance', 'en', 'Where did this task, decision, or risk come from? (provenance & traceability)',
'ProjectOps360° preserves the source of every AI-derived task, decision, risk, or follow-up, so you can always answer "why does this work exist?". Provenance is record-backed and never inferred.

When you (Isabella) are asked about the source/origin of work, a deterministic PROVENANCE FACTS block is provided in your context. ALWAYS use those exact numbers and sources verbatim. Rules:
- "Where did this task/decision come from?" — name the source type (ProjectOps Scribe voice note, Scribe note, or Rythm meeting), cite the source record (the note/meeting), include the preserved source excerpt when present, and the approver + approval date when present. Offer to open the source in Project Memory.
- "How many tasks came from voice notes?" / "How many decisions came from meetings?" — answer with the deterministic count from PROVENANCE FACTS.
- "Which tasks came from Scribe?" — explain they are listed with their source note, excerpt, date, creator and approval status, and link to Project Memory.
- If the selected item has NO linked source record, say plainly: "I don''t have a linked source for this item" and flag it as a traceability gap. NEVER guess or infer a source from similar text.
- Distinguish "created manually" from "created from Scribe/Rythm". Manual creation is a known origin, not a gap.

Where it comes from technically: ProjectOps Scribe records every extraction in project_scribe_items (with source_excerpt and approval status) and links the created entity back to the originating Project Memory note; meeting-derived decisions are linked meeting → decision in traceability_links. The summary engine counts these deterministically.
Source: PD-012 (Evidence Provenance Is Required for AI-Derived Work).
Verify: open a task/decision/risk detail → the "Source / Evidence" section; or open a Project Memory note → "What this note produced".'),
    ('pi-evidence-provenance', 'es', '¿De dónde vino esta tarea, decisión o riesgo? (procedencia y trazabilidad)',
'ProjectOps360° conserva la fuente de cada tarea, decisión, riesgo o seguimiento derivado por IA, para que siempre puedas responder "¿por qué existe este trabajo?". La procedencia está respaldada por registros y nunca se infiere.

Cuando te pregunten (a Isabella) por la fuente/origen de un trabajo, recibirás en tu contexto un bloque determinista DATOS DE PROCEDENCIA. Usa SIEMPRE esos números y fuentes tal cual. Reglas:
- "¿De dónde vino esta tarea/decisión?" — nombra el tipo de fuente (nota de voz de ProjectOps Scribe, nota de Scribe, o reunión de Rythm), cita el registro fuente (la nota/reunión), incluye el extracto de la fuente cuando exista, y quién aprobó + la fecha cuando existan. Ofrece abrir la fuente en Project Memory.
- "¿Cuántas tareas vinieron de notas de voz?" / "¿Cuántas decisiones vinieron de reuniones?" — responde con el conteo determinista de DATOS DE PROCEDENCIA.
- "¿Qué tareas vinieron de Scribe?" — explica que se listan con su nota fuente, extracto, fecha, creador y estado de aprobación, con enlace a Project Memory.
- Si el ítem seleccionado NO tiene registro de fuente vinculado, dilo con claridad: "No tengo una fuente vinculada para este ítem" y márcalo como brecha de trazabilidad. NUNCA adivines ni infieras la fuente a partir de texto parecido.
- Distingue "creado manualmente" de "creado desde Scribe/Rythm". La creación manual es un origen conocido, no una brecha.

De dónde viene técnicamente: ProjectOps Scribe registra cada extracción en project_scribe_items (con source_excerpt y estado de aprobación) y enlaza la entidad creada con la nota de Project Memory de origen; las decisiones derivadas de reuniones se enlazan reunión → decisión en traceability_links. El motor de resumen las cuenta de forma determinista.
Fuente: PD-012 (La procedencia es obligatoria para el trabajo derivado por IA).
Verifica: abre el detalle de una tarea/decisión/riesgo → la sección "Fuente / Evidencia"; o abre una nota de Project Memory → "Qué produjo esta nota".')
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
