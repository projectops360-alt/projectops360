-- ============================================================================
-- ProjectOps360° — ProjectOps Scribe (MVP)
-- Migration: 20260805000000_project_scribe.sql
--
-- Quick-capture assistant INSIDE Project Memory. A Scribe capture is stored as
-- a project_memory_items row (so it shows in the Memory timeline and is
-- vectorized for free). The structured items the AI extracts — and their human
-- review state — live in a small new table project_scribe_items.
--
-- Additive only. Reuses is_org_member() RLS + update_updated_at() trigger.
-- ============================================================================

-- 1. Widen project_memory_items.source_type to include Scribe capture methods.
ALTER TABLE public.project_memory_items
  DROP CONSTRAINT IF EXISTS project_memory_items_source_type_check;
ALTER TABLE public.project_memory_items
  ADD CONSTRAINT project_memory_items_source_type_check
  CHECK (source_type IN (
    'manual_note', 'email', 'chat_message', 'meeting_note',
    'decision', 'action_item', 'risk_signal', 'evidence',
    'approval', 'change_request', 'system_event', 'document',
    -- ProjectOps Scribe capture methods
    'voice_dictation', 'pasted_transcript', 'field_update',
    'client_conversation', 'status_update'
  ));

-- 2. project_scribe_items — AI-extracted items + human review state.
CREATE TABLE IF NOT EXISTS public.project_scribe_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  memory_item_id     uuid NOT NULL REFERENCES public.project_memory_items(id) ON DELETE CASCADE,
  item_type          text NOT NULL
                     CHECK (item_type IN (
                       'action_item','decision','risk','issue','blocker',
                       'dependency','project_impact','open_question','follow_up'
                     )),
  description        text NOT NULL,
  suggested_owner    text,
  suggested_due_date date,
  confidence_score   numeric(5,4),
  source_excerpt     text,
  proposed_action    text,
  status             text NOT NULL DEFAULT 'suggested'
                     CHECK (status IN ('suggested','approved','edited','rejected','saved')),
  created_entity_type text,
  created_entity_id  uuid,
  metadata           jsonb NOT NULL DEFAULT '{}',
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scribe_items_entry ON public.project_scribe_items (memory_item_id);
CREATE INDEX IF NOT EXISTS idx_scribe_items_project ON public.project_scribe_items (project_id, item_type);

COMMENT ON TABLE public.project_scribe_items IS
  'ProjectOps Scribe: AI-extracted items from a capture (memory_item_id), with source_excerpt for traceability and a human review status. created_entity_* links to the task/decision/risk created on approval.';

-- 3. updated_at trigger + RLS.
DROP TRIGGER IF EXISTS set_updated_at ON public.project_scribe_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_scribe_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_scribe_items'] LOOP
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
