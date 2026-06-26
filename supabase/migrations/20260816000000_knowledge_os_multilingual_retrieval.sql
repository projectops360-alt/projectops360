-- ============================================================================
-- ProjectOps360° — Knowledge OS multilingual lexical retrieval (HOTFIX)
-- Migration: 20260816000000_knowledge_os_multilingual_retrieval.sql
--
-- ROOT CAUSE: retrieval hard-filtered to a single language (filter_language =
-- UI locale). A query whose language differed from the locale matched only the
-- other language's chunks, where cross-language cosine fell below threshold →
-- empty → "AI Suggestion". The corpus was bilingual; retrieval was not.
--
-- This migration makes the LEXICAL half language-agnostic and OR-based:
--   • Parse the query in BOTH english + spanish configs and UNION (OR) them, so
--     it matches chunks in either language regardless of the query's language.
--   • OR semantics (not websearch AND) so one unmatched content word no longer
--     kills the whole match — and so synonym expansion only ever ADDS recall.
--   • filter_language stays as an OPTIONAL row filter (callers now pass NULL to
--     search the whole corpus). Signature is unchanged → backward compatible.
--
-- match_knowledge (vector) already supports filter_language = NULL; no change.
-- NO corpus duplication, NO new embeddings, NO content translation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_knowledge_lexical(
  query_text              text,
  filter_organization_id  uuid,
  filter_language         text DEFAULT NULL,
  match_count             int DEFAULT 8
)
RETURNS TABLE (
  chunk_id        uuid,
  package_id      uuid,
  version_id      uuid,
  slug            text,
  language        text,
  title           text,
  body            text,
  confidence_tier text,
  rank            float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  -- Convert each language's parse into an OR of its lexemes (websearch yields
  -- AND-joined '&'; replacing with '|' gives OR semantics).
  q_en  text := replace(websearch_to_tsquery('english', coalesce(query_text, ''))::text, '&', '|');
  q_es  text := replace(websearch_to_tsquery('spanish', coalesce(query_text, ''))::text, '&', '|');
  q_txt text := nullif(concat_ws(' | ', nullif(q_en, ''), nullif(q_es, '')), '');
  tsq   tsquery;
BEGIN
  IF q_txt IS NULL THEN
    RETURN;  -- nothing meaningful to search for
  END IF;
  tsq := q_txt::tsquery;

  RETURN QUERY
  SELECT
    c.id, c.package_id, c.version_id, p.slug, c.language,
    l.title, c.body, v.confidence_tier,
    ts_rank_cd(c.tsv, tsq)::float AS rank
  FROM public.knowledge_chunks c
  JOIN public.knowledge_package_versions v ON v.id = c.version_id AND v.is_current
  JOIN public.knowledge_packages p          ON p.id = c.package_id
  JOIN public.knowledge_localizations l     ON l.id = c.localization_id
  WHERE c.deleted_at IS NULL
    AND p.status = 'published'
    AND p.deleted_at IS NULL
    AND (p.organization_id IS NULL OR p.organization_id = filter_organization_id)
    AND (filter_language IS NULL OR c.language = filter_language)
    AND c.tsv @@ tsq
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_knowledge_lexical IS
  'Living Guide lexical retrieval — language-agnostic (parses the query in both english+spanish configs, OR-joined) so it matches chunks in either language. filter_language is an optional row filter (callers pass NULL for multilingual search). OR semantics make synonym expansion purely additive to recall.';
