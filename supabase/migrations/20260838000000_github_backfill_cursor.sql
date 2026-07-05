-- ============================================================================
-- GitHub Intelligence — incremental backfill cursor
-- Migration: 20260838000000_github_backfill_cursor.sql
-- Adds last_backfill_at so the sync does the full 30-day history backfill once,
-- then runs incrementally (commits since last_synced) to preserve API rate limit.
-- Additive only.
-- ============================================================================
ALTER TABLE public.github_repositories
  ADD COLUMN IF NOT EXISTS last_backfill_at timestamptz;
