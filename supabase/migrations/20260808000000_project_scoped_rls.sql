-- ============================================================================
-- ProjectOps360° — Project-scoped Row Level Security
-- Migration: 20260808000000_project_scoped_rls.sql
--
-- Until now RLS was purely ORG-scoped: every org member could read/write every
-- project's data. This migration adds the PROJECT boundary required by the
-- PMO → PM → Team hierarchy, using can_access_project() from the previous
-- migration:
--
--   • projects                     → visible when can_access_project(id)
--   • every table with both        → visible when is_org_member(org) AND
--     organization_id + project_id    (project_id IS NULL OR can_access_project)
--
-- IMPORTANT — why we DROP every existing policy first:
--   PostgreSQL combines multiple PERMISSIVE policies with OR. A leftover
--   org-only "Members can read X" policy would therefore DEFEAT the new
--   project restriction. So for each target table we drop ALL existing
--   policies and recreate a clean, consistent 5-policy set:
--     po_select / po_insert / po_update / po_delete  + service_role bypass.
--
-- Records with project_id IS NULL are org-level (e.g. an org-wide document);
-- they remain visible to any org member, preserving existing behavior.
--
-- Safe to run once; fully idempotent (drops then recreates).
-- NOTE: the service_role (admin client) bypasses RLS entirely — the app's
-- permission layer enforces the same boundaries for those code paths.
-- ============================================================================

-- ── 1. projects (the root of the boundary) ──────────────────────────────────
DO $$
DECLARE pol record;
BEGIN
  ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'projects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;

  -- Read/modify only projects the user may access.
  EXECUTE $p$CREATE POLICY "po_select" ON public.projects
    FOR SELECT USING (public.can_access_project(id))$p$;
  -- Any org member may create a project (they become creator/PM).
  EXECUTE $p$CREATE POLICY "po_insert" ON public.projects
    FOR INSERT WITH CHECK (public.is_org_member(organization_id))$p$;
  EXECUTE $p$CREATE POLICY "po_update" ON public.projects
    FOR UPDATE USING (public.can_access_project(id))
    WITH CHECK (public.is_org_member(organization_id))$p$;
  EXECUTE $p$CREATE POLICY "po_delete" ON public.projects
    FOR DELETE USING (public.can_access_project(id))$p$;
  EXECUTE $p$CREATE POLICY "po_service_role" ON public.projects
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role')$p$;
END $$;

-- ── 2. Every table scoped by both organization_id AND project_id ────────────
DO $$
DECLARE
  t   text;
  pol record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name   = c.table_name
     AND tb.table_type   = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name  = 'organization_id'
      AND c.table_name  <> 'projects'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c2
        WHERE c2.table_schema = 'public'
          AND c2.table_name   = c.table_name
          AND c2.column_name  = 'project_id'
      )
    GROUP BY c.table_name
    ORDER BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop ALL existing policies so no permissive org-only policy survives.
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Clean project-aware policy set. project_id IS NULL = org-level row.
    EXECUTE format($f$CREATE POLICY "po_select" ON public.%I
      FOR SELECT USING (
        public.is_org_member(organization_id)
        AND (project_id IS NULL OR public.can_access_project(project_id))
      )$f$, t);

    EXECUTE format($f$CREATE POLICY "po_insert" ON public.%I
      FOR INSERT WITH CHECK (
        public.is_org_member(organization_id)
        AND (project_id IS NULL OR public.can_access_project(project_id))
      )$f$, t);

    EXECUTE format($f$CREATE POLICY "po_update" ON public.%I
      FOR UPDATE USING (
        public.is_org_member(organization_id)
        AND (project_id IS NULL OR public.can_access_project(project_id))
      ) WITH CHECK (
        public.is_org_member(organization_id)
        AND (project_id IS NULL OR public.can_access_project(project_id))
      )$f$, t);

    EXECUTE format($f$CREATE POLICY "po_delete" ON public.%I
      FOR DELETE USING (
        public.is_org_member(organization_id)
        AND (project_id IS NULL OR public.can_access_project(project_id))
      )$f$, t);

    EXECUTE format($f$CREATE POLICY "po_service_role" ON public.%I
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')$f$, t);
  END LOOP;
END $$;
