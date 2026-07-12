-- ============================================================================
-- P2-T2 — project_event_objects (PD-018 §A.1 row 9: object-centric refs)
-- ============================================================================
-- OCEL-style side table: one canonical event may reference multiple objects,
-- each with an explicit role (focal/context/impacted/response/…). The event's
-- existing subject_type/subject_id remains the PRIMARY object (backward
-- compatible). Additive only — no changes to project_event_log or risks.
-- Written exclusively by the server-side Event Ingestion Service (one pipeline).
-- RLS mirrors project_event_log (RI-15 inheritance: a ref row is visible only
-- to principals who can read its parent event).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_event_objects (
  event_id    uuid NOT NULL REFERENCES public.project_event_log(event_id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id   uuid NOT NULL,
  role        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, object_type, object_id, role)
);

COMMENT ON TABLE public.project_event_objects IS
  'PD-018: object-centric event references (OCEL 2.0 style). One event ↔ many objects with roles. The event subject stays the primary object; these rows are additive. Written only by the Event Ingestion Service.';
COMMENT ON COLUMN public.project_event_objects.role IS
  'Ontological role of the object in the event (PD-016 §2.3): focal | context | impacted | protected | response | control | materialization | evidence | responsibility | reference.';

-- Query paths: "all events touching object X" and "all objects of event Y" (PK covers event_id prefix).
CREATE INDEX IF NOT EXISTS idx_peo_object
  ON public.project_event_objects (object_type, object_id);

-- ── RLS: mirror of project_event_log (inheritance, RI-15) ────────────────────
ALTER TABLE public.project_event_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read project_event_objects via parent event"
  ON public.project_event_objects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_event_log e
      WHERE e.event_id = project_event_objects.event_id
        AND public.is_org_member(e.organization_id)
        AND e.visibility <> 'audit_only'
    )
  );

CREATE POLICY "Service role full access on project_event_objects"
  ON public.project_event_objects FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- No member INSERT/UPDATE/DELETE policy: clients can never write directly.
