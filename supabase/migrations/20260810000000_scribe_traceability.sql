-- ============================================================================
-- ProjectOps360° — ProjectOps Scribe: bidirectional traceability + vectorization
-- Migration: 20260810000000_scribe_traceability.sql
--
-- The forward link already exists (project_scribe_items.created_entity_*). This
-- migration adds:
--   1. The REVERSE link on the generated work item:
--        project_backlog_items.source_memory_item_id / source_scribe_item_id
--      (so a task can show "Created from ProjectOps Scribe" and link back).
--   2. Vectorization of generated work items (embedding column + HNSW index)
--      and their inclusion in the match_documents() semantic search RPC.
--   3. 'work_item' added to traceability_links CHECK (so memory→work_item links
--      are allowed for completeness).
--   4. Backfill of the reverse link from existing project_scribe_items.
--
-- Additive only; safe to run once. Existing data is never overwritten.
-- ============================================================================

-- ── 1. Reverse provenance + embedding on generated work items ───────────────
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS source_memory_item_id uuid REFERENCES public.project_memory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_scribe_item_id uuid REFERENCES public.project_scribe_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_backlog_source_memory
  ON public.project_backlog_items (source_memory_item_id);

CREATE INDEX IF NOT EXISTS idx_backlog_embedding
  ON public.project_backlog_items
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

COMMENT ON COLUMN public.project_backlog_items.source_memory_item_id IS
  'The Project Memory item (ProjectOps Scribe capture) this work item was generated from. NULL for manually created items.';
COMMENT ON COLUMN public.project_backlog_items.source_scribe_item_id IS
  'The specific project_scribe_items extraction that produced this work item.';

-- ── 2. Allow memory→work_item traceability links ────────────────────────────
ALTER TABLE public.traceability_links
  DROP CONSTRAINT IF EXISTS traceability_links_source_type_check;
ALTER TABLE public.traceability_links
  ADD CONSTRAINT traceability_links_source_type_check
  CHECK (source_type IN (
    'decision', 'meeting', 'communication', 'document',
    'action_item', 'stakeholder', 'project',
    'memory', 'task', 'milestone', 'risk', 'work_item'
  ));
ALTER TABLE public.traceability_links
  DROP CONSTRAINT IF EXISTS traceability_links_target_type_check;
ALTER TABLE public.traceability_links
  ADD CONSTRAINT traceability_links_target_type_check
  CHECK (target_type IN (
    'decision', 'meeting', 'communication', 'document',
    'action_item', 'stakeholder', 'project',
    'memory', 'task', 'milestone', 'risk', 'work_item'
  ));

-- ── 3. Backfill the reverse link from existing scribe extractions ───────────
-- project_scribe_items already records created_entity_type='work_item' +
-- created_entity_id (the backlog row). Use it to fill the reverse pointers
-- without overwriting anything already set.
UPDATE public.project_backlog_items b
SET source_memory_item_id = si.memory_item_id,
    source_scribe_item_id = si.id
FROM public.project_scribe_items si
WHERE si.created_entity_type = 'work_item'
  AND si.created_entity_id = b.id
  AND b.source_memory_item_id IS NULL;

-- ── 4. Recreate match_documents() to also search generated work items ───────
-- Preserves every existing branch (tasks, communications, meetings, decisions,
-- documents, memory) and adds a project_backlog_items branch as entity_type
-- 'work_item'.
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  filter_organization_id uuid,
  filter_project_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- roadmap_tasks (project-scoped)
  IF filter_project_id IS NOT NULL THEN
    RETURN QUERY
    SELECT rt.id, 'task'::text, rt.title, COALESCE(rt.description, ''),
           1 - (rt.embedding <=> query_embedding)
    FROM public.roadmap_tasks rt
    WHERE rt.embedding IS NOT NULL AND rt.deleted_at IS NULL
      AND rt.organization_id = filter_organization_id
      AND rt.project_id = filter_project_id
      AND 1 - (rt.embedding <=> query_embedding) > match_threshold
    ORDER BY rt.embedding <=> query_embedding LIMIT match_count;
  END IF;

  -- project_backlog_items / generated work items
  RETURN QUERY
  SELECT bi.id, 'work_item'::text, COALESCE(bi.title, ''), COALESCE(bi.description, ''),
         1 - (bi.embedding <=> query_embedding)
  FROM public.project_backlog_items bi
  WHERE bi.embedding IS NOT NULL
    AND bi.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR bi.project_id = filter_project_id)
    AND 1 - (bi.embedding <=> query_embedding) > match_threshold
  ORDER BY bi.embedding <=> query_embedding LIMIT match_count;

  -- communication_items
  RETURN QUERY
  SELECT ci.id, 'communication'::text,
         COALESCE(ci.title_i18n->>'en', ci.title_i18n->>'es', ''),
         COALESCE(ci.summary_i18n->>'en', ci.summary_i18n->>'es', ci.content_i18n->>'en', ci.content_i18n->>'es', ''),
         1 - (ci.embedding <=> query_embedding)
  FROM public.communication_items ci
  WHERE ci.embedding IS NOT NULL AND ci.deleted_at IS NULL
    AND ci.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR ci.project_id = filter_project_id)
    AND 1 - (ci.embedding <=> query_embedding) > match_threshold
  ORDER BY ci.embedding <=> query_embedding LIMIT match_count;

  -- meetings
  RETURN QUERY
  SELECT m.id, 'meeting'::text,
         COALESCE(m.title_i18n->>'en', m.title_i18n->>'es', ''),
         COALESCE(m.summary_i18n->>'en', m.summary_i18n->>'es', m.agenda_i18n->>'en', m.agenda_i18n->>'es', ''),
         1 - (m.embedding <=> query_embedding)
  FROM public.meetings m
  WHERE m.embedding IS NOT NULL AND m.deleted_at IS NULL
    AND m.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR m.project_id = filter_project_id)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding LIMIT match_count;

  -- decisions
  RETURN QUERY
  SELECT d.id, 'decision'::text,
         COALESCE(d.title_i18n->>'en', d.title_i18n->>'es', ''),
         COALESCE(d.description_i18n->>'en', d.description_i18n->>'es', d.rationale_i18n->>'en', d.rationale_i18n->>'es', ''),
         1 - (d.embedding <=> query_embedding)
  FROM public.decisions d
  WHERE d.embedding IS NOT NULL AND d.deleted_at IS NULL
    AND d.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR d.project_id = filter_project_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding LIMIT match_count;

  -- documents
  RETURN QUERY
  SELECT doc.id, 'document'::text,
         COALESCE(doc.title_i18n->>'en', doc.title_i18n->>'es', ''),
         COALESCE(doc.description_i18n->>'en', doc.description_i18n->>'es', ''),
         1 - (doc.embedding <=> query_embedding)
  FROM public.documents doc
  WHERE doc.embedding IS NOT NULL AND doc.deleted_at IS NULL
    AND doc.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR doc.project_id = filter_project_id)
    AND 1 - (doc.embedding <=> query_embedding) > match_threshold
  ORDER BY doc.embedding <=> query_embedding LIMIT match_count;

  -- project_memory_items
  RETURN QUERY
  SELECT mi.id, 'memory'::text, COALESCE(mi.title, ''), COALESCE(mi.summary, mi.content, ''),
         1 - (mi.embedding <=> query_embedding)
  FROM public.project_memory_items mi
  WHERE mi.embedding IS NOT NULL AND mi.deleted_at IS NULL
    AND mi.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR mi.project_id = filter_project_id)
    AND 1 - (mi.embedding <=> query_embedding) > match_threshold
  ORDER BY mi.embedding <=> query_embedding LIMIT match_count;

  RETURN;
END;
$$;
