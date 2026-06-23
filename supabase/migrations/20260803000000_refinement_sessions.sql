-- ============================================================================
-- ProjectOps360° — Work Refinement Center (Phase 2)
-- Migration: 20260803000000_refinement_sessions.sql
--
-- Adds the collaborative layer on top of Phase 1's per-item refinement:
--   1. refinement_sessions          — a facilitated refinement review
--   2. refinement_session_items     — the work items under review + outcomes
--   3. work_item_links              — relate a work item to decisions,
--                                     meetings, communications, documents, risks
--   4. project_backlog_items.parent_item_id — split lineage (parent → children)
--
-- House conventions: additive, member RLS via is_org_member(),
-- update_updated_at() trigger, partial indexes.
-- ============================================================================

-- ── 1. split lineage on the work item ────────────────────────────────────────

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES public.project_backlog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backlog_parent
  ON public.project_backlog_items (parent_item_id)
  WHERE deleted_at IS NULL AND parent_item_id IS NOT NULL;

-- ── 2. refinement_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refinement_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id     uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE SET NULL,
  title            text NOT NULL,
  delivery_method  text,
  status           text NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned','active','completed','canceled')),
  facilitator_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes            text,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_refsessions_project ON public.refinement_sessions (project_id, status) WHERE deleted_at IS NULL;

-- ── 3. refinement_session_items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refinement_session_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id       uuid NOT NULL REFERENCES public.refinement_sessions(id) ON DELETE CASCADE,
  backlog_item_id  uuid NOT NULL REFERENCES public.project_backlog_items(id) ON DELETE CASCADE,
  position         integer NOT NULL DEFAULT 0,
  reviewed         boolean NOT NULL DEFAULT false,
  outcome          text,
  decisions        text,
  notes            text,
  action_items     text,
  talking_points   jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, backlog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_refsessitems_session ON public.refinement_session_items (session_id, position);

-- ── 4. work_item_links ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.work_item_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  backlog_item_id  uuid NOT NULL REFERENCES public.project_backlog_items(id) ON DELETE CASCADE,
  entity_type      text NOT NULL
                   CHECK (entity_type IN ('decision','meeting','communication','document','risk','issue')),
  entity_id        uuid NOT NULL,
  label            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (backlog_item_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_wil_item ON public.work_item_links (backlog_item_id);
CREATE INDEX IF NOT EXISTS idx_wil_project ON public.work_item_links (project_id);

-- ── 5. triggers + RLS ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at ON public.refinement_sessions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.refinement_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.refinement_session_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.refinement_session_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['refinement_sessions','refinement_session_items','work_item_links'] LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON public.%1$s FOR SELECT USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members update %1$s" ON public.%1$s FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members delete %1$s" ON public.%1$s FOR DELETE USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Service role %1$s" ON public.%1$s FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;
