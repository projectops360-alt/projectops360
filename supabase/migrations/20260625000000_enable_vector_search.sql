-- ============================================================================
-- ProjectOps360° — Enable Vector Search (pgvector)
-- ============================================================================
-- Enables pgvector extension, adds embedding columns to searchable entities,
-- creates HNSW indexes for fast cosine similarity search, and creates the
-- match_documents RPC function for cross-entity semantic search.
-- ============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Embedding columns ────────────────────────────────────────────────────────────

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.communication_items
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ── HNSW indexes for fast cosine similarity search ────────────────────────────────
-- Partial indexes: only index rows that have embeddings and are not soft-deleted

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_embedding
  ON public.roadmap_tasks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_communication_items_embedding
  ON public.communication_items
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_embedding
  ON public.meetings
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_decisions_embedding
  ON public.decisions
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON public.documents
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

-- ── Comments ─────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.roadmap_tasks.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';
COMMENT ON COLUMN public.communication_items.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';
COMMENT ON COLUMN public.meetings.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';
COMMENT ON COLUMN public.decisions.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';
COMMENT ON COLUMN public.documents.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';

-- ── RPC: match_documents ─────────────────────────────────────────────────────────
-- Cross-entity semantic search function.
-- Returns matching rows from all searchable tables where cosine similarity
-- exceeds the given threshold, scoped to the organization and optionally project.

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

  RETURN;
END;
$$;