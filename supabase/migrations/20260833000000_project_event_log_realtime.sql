-- ============================================================================
-- LGRE Phase 4, Task 2 — enable Realtime delivery for project_event_log
-- ============================================================================
-- Adds the append-only Project Event Graph ledger to the supabase_realtime
-- publication so the Living Graph Realtime Engine subscription layer can
-- receive INSERT notifications (postgres_changes), project-filtered, under the
-- existing RLS policy "Members read project_event_log".
--
-- This changes DELIVERY only. It does NOT alter the table, its data, its RLS,
-- or its immutability triggers (UPDATE/DELETE remain blocked). Idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'project_event_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_event_log;
  END IF;
END;
$$;
