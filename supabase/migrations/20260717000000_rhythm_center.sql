-- ============================================================================
-- ProjectOps360° — Project Rhythm Center (MVP)
-- Migration: 20260717000000_rhythm_center.sql
--
-- Internal project calendar + meeting control center. Maximum reuse:
--   • NEW project_events  — the calendar layer (all event types).
--   • NEW meeting_attendees — per-meeting attendance with role/status.
--   • EXTEND meetings       — event_id + meeting_type/objective/outcome/ai_summary/
--                             meeting_status + structured agenda_json.
--   • EXTEND action_items   — related_task_id (already has meeting_id).
--   • EXTEND decisions      — meeting_id link.
--   • REUSE  action_items / decisions / project_memory_items + vector /
--            traceability_links / risks / suppliers / resources / budget_items.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. project_events — the calendar layer
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id           uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title                text NOT NULL,
  description          text,
  event_type           text NOT NULL DEFAULT 'other'
                       CHECK (event_type IN (
                         'kickoff_meeting','status_update','stakeholder_review','project_review',
                         'milestone','deliverable_deadline','risk_review','budget_review',
                         'change_review','vendor_followup','resource_planning','action_followup','other'
                       )),
  start_datetime       timestamptz NOT NULL,
  end_datetime         timestamptz,
  status               text NOT NULL DEFAULT 'draft'
                       CHECK (status IN (
                         'draft','scheduled','agenda_ready','in_progress',
                         'completed','follow_up_pending','closed','canceled'
                       )),
  priority             text NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high','critical')),
  source               text NOT NULL DEFAULT 'manual'
                       CHECK (source IN ('manual','template','system','ai')),
  -- Optional links to existing project entities (no FK on change — no table yet).
  related_milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  related_task_id      uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  related_risk_id      uuid REFERENCES public.risks(id) ON DELETE SET NULL,
  related_change_id    uuid,
  metadata             jsonb NOT NULL DEFAULT '{}',
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_project_events_project
  ON public.project_events (project_id, start_datetime) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_events_org
  ON public.project_events (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_events_type
  ON public.project_events (organization_id, event_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_events_status
  ON public.project_events (organization_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.project_events IS
  'Project Rhythm Center calendar layer: all project events (meetings, milestones, deadlines, reviews, follow-ups). Meetings extend an event via meetings.event_id.';

-- ──────────────────────────────────────────────
-- 2. EXTEND meetings (meeting = the detail of a meeting-type event)
-- ──────────────────────────────────────────────

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS event_id         uuid REFERENCES public.project_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS meeting_type     text CHECK (meeting_type IN ('kickoff','status_update','stakeholder_review','project_review')),
  ADD COLUMN IF NOT EXISTS objective        text,
  ADD COLUMN IF NOT EXISTS expected_outcome text,
  ADD COLUMN IF NOT EXISTS agenda_json      jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_summary       jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meeting_status   text NOT NULL DEFAULT 'draft'
                           CHECK (meeting_status IN (
                             'draft','scheduled','agenda_ready','in_progress',
                             'completed','follow_up_pending','closed','canceled'
                           ));

CREATE INDEX IF NOT EXISTS idx_meetings_event ON public.meetings (event_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.meetings.agenda_json IS
  'Structured agenda: [{ "key": "...", "title": "...", "content": "..." }]. Generated from the meeting-type template, editable in the agenda builder.';

-- ──────────────────────────────────────────────
-- 3. EXTEND action_items + decisions for meeting linkage
-- ──────────────────────────────────────────────

ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS related_task_id uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON public.decisions (meeting_id) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- 4. meeting_attendees
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id        uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  -- An attendee may be an app user, a project stakeholder, or free-text.
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stakeholder_id    uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  name              text,
  role              text NOT NULL DEFAULT 'required'
                    CHECK (role IN ('organizer','presenter','required','optional')),
  attendance_status text NOT NULL DEFAULT 'invited'
                    CHECK (attendance_status IN ('invited','accepted','declined','tentative','attended','absent')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON public.meeting_attendees (meeting_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 5. RLS
-- ──────────────────────────────────────────────

ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_events','meeting_attendees'] LOOP
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
