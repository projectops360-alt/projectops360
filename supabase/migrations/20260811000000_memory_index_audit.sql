-- ============================================================================
-- ProjectOps360° — Memory index audit fields (admin/debug visibility)
-- Migration: 20260811000000_memory_index_audit.sql
--
-- Adds lightweight observability to project_memory_items so the UI can show,
-- per item: when it was last embedded, with which model, and a content hash
-- (to detect stale embeddings). Set by processMemoryItem on a successful index.
-- Additive only.
-- ============================================================================

ALTER TABLE public.project_memory_items
  ADD COLUMN IF NOT EXISTS indexed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS content_hash    text;

COMMENT ON COLUMN public.project_memory_items.indexed_at IS
  'When the embedding was last generated (NULL = never indexed).';
COMMENT ON COLUMN public.project_memory_items.embedding_model IS
  'Embedding model used (e.g. text-embedding-3-small).';
COMMENT ON COLUMN public.project_memory_items.content_hash IS
  'SHA-256 of the text that was embedded — lets the UI flag stale embeddings.';
