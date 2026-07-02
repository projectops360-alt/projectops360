-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2 — Event Log Foundation: project_event_log (immutable PEG ledger)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Append-only ledger of immutable project facts. Additive: does NOT touch or
-- replace process_nodes / process_edges. Only the server-side Event Ingestion
-- Service (admin/service_role) writes here. Corrections are compensating events,
-- never edits. See docs/product-brain/00-product-constitution.md §4.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.project_event_log (
  event_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_seq            bigint GENERATED ALWAYS AS IDENTITY,
  sequence_number       bigint NOT NULL,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  portfolio_id          uuid,
  case_id               uuid NOT NULL,

  event_category        text NOT NULL,
  event_type            text NOT NULL,
  event_schema_version  integer NOT NULL DEFAULT 1,
  event_importance      text NOT NULL DEFAULT 'NORMAL'
                          CHECK (event_importance IN ('LOW','NORMAL','HIGH','CRITICAL')),
  event_lifecycle_class text NOT NULL DEFAULT 'BUSINESS_EVENT'
                          CHECK (event_lifecycle_class IN (
                            'BUSINESS_EVENT','SYSTEM_EVENT','AI_EVENT',
                            'DERIVED_EVENT','EXTERNAL_EVENT','SYNTHETIC_BACKFILL_EVENT')),

  subject_type          text NOT NULL,
  subject_id            uuid,

  actor_type            text NOT NULL CHECK (actor_type IN ('human','system','ai','external')),
  actor_id              uuid,

  occurred_at           timestamptz NOT NULL,
  recorded_at           timestamptz NOT NULL DEFAULT now(),

  source_module         text NOT NULL,
  source_entity_type    text,
  source_entity_id      uuid,

  from_state            text,
  to_state              text,

  caused_by             uuid[] NOT NULL DEFAULT '{}',
  correlation_id        uuid,
  saga_id               uuid,

  provenance            jsonb NOT NULL DEFAULT '{}',
  confidence            numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  impact_schedule       text CHECK (impact_schedule IN ('none','low','medium','high','critical')),
  impact_cost           text CHECK (impact_cost     IN ('none','low','medium','high','critical')),
  impact_quality        text CHECK (impact_quality  IN ('none','low','medium','high','critical')),
  impact_risk           text CHECK (impact_risk     IN ('none','low','medium','high','critical')),
  impact_scope          text CHECK (impact_scope    IN ('none','low','medium','high','critical')),

  payload               jsonb NOT NULL DEFAULT '{}',
  visibility            text NOT NULL DEFAULT 'normal'
                          CHECK (visibility IN ('normal','confidential','audit_only')),
  permission_scope      jsonb NOT NULL DEFAULT '{}',
  invalidation_tags     text[] NOT NULL DEFAULT '{}',

  -- tamper-evident chain (best-effort during early rollout)
  event_hash            text,
  previous_event_hash   text,

  -- idempotency
  dedup_key             text,

  is_compensating_event boolean NOT NULL DEFAULT false,
  compensates_event_id  uuid REFERENCES public.project_event_log(event_id),

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_pel_project_seq UNIQUE (project_id, sequence_number),
  CONSTRAINT chk_pel_compensation CHECK (
    (is_compensating_event = false AND compensates_event_id IS NULL)
    OR (is_compensating_event = true AND compensates_event_id IS NOT NULL)
  )
);

-- Idempotent ingestion: same fact emitted twice → single row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pel_dedup
  ON public.project_event_log (project_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Replay / query indexes.
CREATE INDEX IF NOT EXISTS idx_pel_project_seq  ON public.project_event_log (project_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_pel_case_seq     ON public.project_event_log (case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_pel_project_time ON public.project_event_log (project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_pel_subject      ON public.project_event_log (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_pel_type         ON public.project_event_log (project_id, event_category, event_type);
CREATE INDEX IF NOT EXISTS idx_pel_correlation  ON public.project_event_log (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pel_saga         ON public.project_event_log (saga_id) WHERE saga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pel_org          ON public.project_event_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_pel_payload_gin  ON public.project_event_log USING gin (payload);

-- ── Per-project monotonic sequence counter ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_event_counters (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  last_seq   bigint NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_project_event_seq(p_project_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq bigint;
BEGIN
  INSERT INTO public.project_event_counters (project_id, last_seq)
  VALUES (p_project_id, 1)
  ON CONFLICT (project_id)
    DO UPDATE SET last_seq = public.project_event_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

-- ── Immutability: block UPDATE and DELETE (corrections = compensating events) ────
CREATE OR REPLACE FUNCTION public.project_event_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'project_event_log is append-only: % is not allowed (use a compensating event)', TG_OP;
END;
$$;

CREATE TRIGGER trg_pel_no_update BEFORE UPDATE ON public.project_event_log
  FOR EACH ROW EXECUTE FUNCTION public.project_event_log_immutable();
CREATE TRIGGER trg_pel_no_delete BEFORE DELETE ON public.project_event_log
  FOR EACH ROW EXECUTE FUNCTION public.project_event_log_immutable();

-- ── RLS: org members READ (respecting visibility later); only service_role WRITES ─
ALTER TABLE public.project_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_event_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read project_event_log"
  ON public.project_event_log FOR SELECT
  USING (public.is_org_member(organization_id) AND visibility <> 'audit_only');

CREATE POLICY "Service role full access on project_event_log"
  ON public.project_event_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- No member INSERT/UPDATE/DELETE policy: clients can never write directly.

CREATE POLICY "Service role full access on project_event_counters"
  ON public.project_event_counters FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.project_event_log IS
  'Project Event Graph: append-only immutable ledger of project facts. Written only by the server-side Event Ingestion Service. Additive to (does not replace) process_nodes/process_edges.';
