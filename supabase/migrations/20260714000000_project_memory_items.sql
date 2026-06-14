-- ============================================================================
-- ProjectOps360° — Project Memory Items (MVP)
-- Migration: 20260714000000_project_memory_items.sql
--
-- The capture layer for "Project Memory": one row = one captured piece of
-- project context (manual note, pasted email, meeting note, decision note,
-- risk signal, evidence, stakeholder communication, change-request context,
-- document reference, or system event).
--
-- This is the production capture table behind the (previously read-only)
-- Project Memory tab. It reuses ALL existing infrastructure:
--   • pgvector embeddings + match_documents RPC (extended here)
--   • traceability_links for entity linking (CHECK widened here)
--   • ai_runs for AI classification audit (prompt/source types widened here)
--   • is_org_member() RLS helper
--
-- Changes:
--   1. CREATE TABLE project_memory_items (+ indexes, RLS, updated_at trigger)
--   2. Widen traceability_links source/target CHECK with: memory, task,
--      milestone, risk  (memory items link to existing project entities)
--   3. Widen ai_runs.prompt_type CHECK with 'memory_classification'
--   4. Widen ai_runs.source_type CHECK with 'memory'
--   5. Recreate match_documents() RPC to also search project_memory_items
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 1: project_memory_items
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_memory_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL
                      REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Core content (plain text — memory items are free-form captures)
  title               text NOT NULL,
  content             text,
  summary             text,

  -- Provenance
  source_type         text NOT NULL DEFAULT 'manual_note'
                      CHECK (source_type IN (
                        'manual_note', 'email', 'chat_message', 'meeting_note',
                        'decision', 'action_item', 'risk_signal', 'evidence',
                        'approval', 'change_request', 'system_event', 'document'
                      )),
  source_system       text,
  source_external_id  text,
  author_name         text,
  author_email        text,
  participants        jsonb NOT NULL DEFAULT '[]',
  occurred_at         timestamptz,

  -- Classification (importance/sentiment may be set by a human or by AI)
  importance_level    text NOT NULL DEFAULT 'medium'
                      CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
  sentiment           text
                      CHECK (sentiment IS NULL OR sentiment IN (
                        'positive', 'neutral', 'negative', 'concerned', 'mixed'
                      )),
  ai_classification   jsonb NOT NULL DEFAULT '{}',
  tags                jsonb NOT NULL DEFAULT '[]',
  metadata            jsonb NOT NULL DEFAULT '{}',
  visibility          text NOT NULL DEFAULT 'project'
                      CHECK (visibility IN ('project', 'organization', 'private')),

  -- Pipeline state (Phase 9: AI/vector failures must not block the save)
  ai_status           text NOT NULL DEFAULT 'pending'
                      CHECK (ai_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  index_status        text NOT NULL DEFAULT 'pending'
                      CHECK (index_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  -- Vector search
  embedding           vector(1536),

  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_memory_items_org
  ON public.project_memory_items (organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_items_project
  ON public.project_memory_items (project_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_items_source_type
  ON public.project_memory_items (organization_id, source_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_items_importance
  ON public.project_memory_items (organization_id, importance_level)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_items_tags
  ON public.project_memory_items USING gin (tags)
  WHERE deleted_at IS NULL;

-- HNSW vector index — only embedded, non-deleted rows
CREATE INDEX IF NOT EXISTS idx_memory_items_embedding
  ON public.project_memory_items
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.project_memory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Comments ───────────────────────────────────────────────────────────────

COMMENT ON TABLE public.project_memory_items IS
  'Project Memory capture layer: one row = one captured piece of project context (note, email, meeting note, decision, risk signal, evidence, etc.). Indexed into vector search and linkable to project entities via traceability_links.';
COMMENT ON COLUMN public.project_memory_items.source_type IS
  'manual_note | email | chat_message | meeting_note | decision | action_item | risk_signal | evidence | approval | change_request | system_event | document';
COMMENT ON COLUMN public.project_memory_items.ai_classification IS
  'Structured AI classification JSON: {contains_decision, contains_risk, contains_action_item, contains_scope_change, contains_schedule_impact, contains_cost_impact, contains_stakeholder_concern, sentiment, urgency, suggested_tags, suggested_links, confidence}.';
COMMENT ON COLUMN public.project_memory_items.ai_status IS
  'AI classification pipeline state. The item is always saved even if AI fails (pending/processing/completed/failed/skipped).';
COMMENT ON COLUMN public.project_memory_items.index_status IS
  'Vector indexing pipeline state. The item is always saved even if embedding fails.';
COMMENT ON COLUMN public.project_memory_items.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';

-- ──────────────────────────────────────────────
-- SECTION 2: Row Level Security
-- ──────────────────────────────────────────────

ALTER TABLE public.project_memory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read memory items" ON public.project_memory_items;
DROP POLICY IF EXISTS "Members can insert memory items" ON public.project_memory_items;
DROP POLICY IF EXISTS "Members can update memory items" ON public.project_memory_items;
DROP POLICY IF EXISTS "Members can delete memory items" ON public.project_memory_items;
DROP POLICY IF EXISTS "Service role has full access on project_memory_items" ON public.project_memory_items;

CREATE POLICY "Members can read memory items"
  ON public.project_memory_items
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert memory items"
  ON public.project_memory_items
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update memory items"
  ON public.project_memory_items
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete memory items"
  ON public.project_memory_items
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on project_memory_items"
  ON public.project_memory_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 3: Widen traceability_links for memory linking
-- ──────────────────────────────────────────────
-- Memory items link to existing project entities. We add 'memory' plus the
-- entity types that already have tables: task (roadmap_tasks), milestone
-- (milestones), risk (risks). Existing values are preserved.

ALTER TABLE public.traceability_links
  DROP CONSTRAINT IF EXISTS traceability_links_source_type_check;
ALTER TABLE public.traceability_links
  ADD CONSTRAINT traceability_links_source_type_check
  CHECK (source_type IN (
    'decision', 'meeting', 'communication', 'document',
    'action_item', 'stakeholder', 'project',
    'memory', 'task', 'milestone', 'risk'
  ));

ALTER TABLE public.traceability_links
  DROP CONSTRAINT IF EXISTS traceability_links_target_type_check;
ALTER TABLE public.traceability_links
  ADD CONSTRAINT traceability_links_target_type_check
  CHECK (target_type IN (
    'decision', 'meeting', 'communication', 'document',
    'action_item', 'stakeholder', 'project',
    'memory', 'task', 'milestone', 'risk'
  ));

-- ──────────────────────────────────────────────
-- SECTION 4: Widen ai_runs prompt_type + source_type
-- ──────────────────────────────────────────────

ALTER TABLE public.ai_runs
  DROP CONSTRAINT IF EXISTS ai_runs_prompt_type_check;
ALTER TABLE public.ai_runs
  ADD CONSTRAINT ai_runs_prompt_type_check
  CHECK (prompt_type IN (
    'summary', 'decision_analysis', 'stakeholder_mapping',
    'risk_assessment', 'action_extraction',
    'communication_history_summary',
    'drawing_interpretation',
    'memory_classification',
    'custom'
  ));

ALTER TABLE public.ai_runs
  DROP CONSTRAINT IF EXISTS ai_runs_source_type_check;
ALTER TABLE public.ai_runs
  ADD CONSTRAINT ai_runs_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'decision', 'meeting', 'communication',
    'document', 'action_item', 'project',
    'memory'
  ));

-- ──────────────────────────────────────────────
-- SECTION 5: Extend match_documents to search memory items
-- ──────────────────────────────────────────────
-- Recreates the cross-entity semantic search RPC, preserving all existing
-- branches and adding a project_memory_items branch (entity_type 'memory').
-- Always org-scoped; project-scoped when filter_project_id is provided.

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
  -- Search roadmap_tasks (plain text columns, project-scoped)
  IF filter_project_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      rt.id,
      'task'::text AS entity_type,
      rt.title,
      COALESCE(rt.description, '') AS content,
      1 - (rt.embedding <=> query_embedding) AS similarity
    FROM public.roadmap_tasks rt
    WHERE rt.embedding IS NOT NULL
      AND rt.deleted_at IS NULL
      AND rt.organization_id = filter_organization_id
      AND rt.project_id = filter_project_id
      AND 1 - (rt.embedding <=> query_embedding) > match_threshold
    ORDER BY rt.embedding <=> query_embedding
    LIMIT match_count;
  END IF;

  -- Search communication_items (i18n JSONB fields)
  RETURN QUERY
  SELECT
    ci.id,
    'communication'::text AS entity_type,
    COALESCE(ci.title_i18n->>'en', ci.title_i18n->>'es', '') AS title,
    COALESCE(ci.summary_i18n->>'en', ci.summary_i18n->>'es',
             ci.content_i18n->>'en', ci.content_i18n->>'es', '') AS content,
    1 - (ci.embedding <=> query_embedding) AS similarity
  FROM public.communication_items ci
  WHERE ci.embedding IS NOT NULL
    AND ci.deleted_at IS NULL
    AND ci.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR ci.project_id = filter_project_id)
    AND 1 - (ci.embedding <=> query_embedding) > match_threshold
  ORDER BY ci.embedding <=> query_embedding
  LIMIT match_count;

  -- Search meetings
  RETURN QUERY
  SELECT
    m.id,
    'meeting'::text AS entity_type,
    COALESCE(m.title_i18n->>'en', m.title_i18n->>'es', '') AS title,
    COALESCE(m.summary_i18n->>'en', m.summary_i18n->>'es',
             m.agenda_i18n->>'en', m.agenda_i18n->>'es', '') AS content,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.meetings m
  WHERE m.embedding IS NOT NULL
    AND m.deleted_at IS NULL
    AND m.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR m.project_id = filter_project_id)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;

  -- Search decisions
  RETURN QUERY
  SELECT
    d.id,
    'decision'::text AS entity_type,
    COALESCE(d.title_i18n->>'en', d.title_i18n->>'es', '') AS title,
    COALESCE(d.description_i18n->>'en', d.description_i18n->>'es',
             d.rationale_i18n->>'en', d.rationale_i18n->>'es', '') AS content,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.decisions d
  WHERE d.embedding IS NOT NULL
    AND d.deleted_at IS NULL
    AND d.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR d.project_id = filter_project_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;

  -- Search documents
  RETURN QUERY
  SELECT
    doc.id,
    'document'::text AS entity_type,
    COALESCE(doc.title_i18n->>'en', doc.title_i18n->>'es', '') AS title,
    COALESCE(doc.description_i18n->>'en', doc.description_i18n->>'es', '') AS content,
    1 - (doc.embedding <=> query_embedding) AS similarity
  FROM public.documents doc
  WHERE doc.embedding IS NOT NULL
    AND doc.deleted_at IS NULL
    AND doc.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR doc.project_id = filter_project_id)
    AND 1 - (doc.embedding <=> query_embedding) > match_threshold
  ORDER BY doc.embedding <=> query_embedding
  LIMIT match_count;

  -- Search project_memory_items (plain text columns)
  RETURN QUERY
  SELECT
    mi.id,
    'memory'::text AS entity_type,
    COALESCE(mi.title, '') AS title,
    COALESCE(mi.summary, mi.content, '') AS content,
    1 - (mi.embedding <=> query_embedding) AS similarity
  FROM public.project_memory_items mi
  WHERE mi.embedding IS NOT NULL
    AND mi.deleted_at IS NULL
    AND mi.organization_id = filter_organization_id
    AND (filter_project_id IS NULL OR mi.project_id = filter_project_id)
    AND 1 - (mi.embedding <=> query_embedding) > match_threshold
  ORDER BY mi.embedding <=> query_embedding
  LIMIT match_count;

  RETURN;
END;
$$;
