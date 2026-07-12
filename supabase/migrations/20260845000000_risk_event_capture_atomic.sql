-- ============================================================================
-- P2-T2 Acceptance Remediation — atomic risk event capture (PD-018; Fase 2)
-- ============================================================================
-- Adds the transactional boundary that keeps a Risk mutation and its canonical
-- event + object_refs in the SAME PostgreSQL transaction, so that when the
-- pilot flag is ON the two effects can never diverge silently:
--   * a failed event never leaves a mutated Risk without evidence;
--   * a failed Risk mutation never leaves an event asserting a fact that did
--     not happen;
--   * a retry never duplicates an event (dedup_key, same as the TS gateway).
--
-- Design (CLAUDE.md rule #5 — one pipeline; do NOT duplicate the gateway):
--   * Validation, registry membership, dedup_key computation and payload
--     serialization stay in the TS ingestion gateway (validated/normalized
--     BEFORE the RPC is called). The RPC only owns the atomic persistence.
--   * The per-project sequence reuses the existing next_project_event_seq().
--   * The tamper-evident hash mirrors computeEventHash (ingestion.ts): the
--     caller passes payload_text = JSON.stringify(payload) so SQL and TS share
--     the exact same field + serialization; only sequence + previous_hash are
--     assigned inside the tx (they cannot be known before it).
--   * The helper does NOT swallow exceptions: any failure propagates so the
--     outer transaction (Risk mutation included) is rolled back by Postgres.
--
-- Additive: no changes to project_event_log / project_event_objects / risks.
-- SECURITY DEFINER + SET search_path = public (same convention as
-- next_project_event_seq). Only the service_role (admin client) calls these.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Internal helper: atomic event + object_refs append ──────────────────────
-- p_event      = the NormalizedRow (snake_case) produced by normalizeProjectEvent
--                WITHOUT sequence_number / event_hash / previous_event_hash /
--                recorded_at (those are assigned here or by DDL defaults).
-- p_payload_text = JSON.stringify(payload) from TS (hash consistency).
-- p_refs       = [{"object_type","object_id","role"}, ...] (OCEL 2.0).
-- Returns {"ok","deduped","event_id","sequence_number" | "error"}.
CREATE OR REPLACE FUNCTION public._append_event_atomic(
  p_event        jsonb,
  p_payload_text text,
  p_refs         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id        uuid  := (p_event->>'project_id')::uuid;
  v_dedup_key          text  := p_event->>'dedup_key';
  v_existing_event_id  uuid;
  v_seq                bigint;
  v_prev_hash          text;
  v_event_id           uuid  := gen_random_uuid();
  v_stable             text;
  v_hash               text;
BEGIN
  -- Idempotency: a retry with the same dedup_key returns the existing event.
  -- (The caller's Risk mutation is itself idempotent on retry — UPDATE of
  -- status, or a fresh INSERT the writer already de-duplicates upstream.)
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id INTO v_existing_event_id
    FROM public.project_event_log
    WHERE project_id = v_project_id AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing_event_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'deduped', true, 'event_id', v_existing_event_id);
    END IF;
  END IF;

  -- Per-project monotonic sequence (reused from the existing PEG).
  v_seq := public.next_project_event_seq(v_project_id);

  -- Tamper-evident chain: previous hash = last event's hash for this project.
  SELECT event_hash INTO v_prev_hash
  FROM public.project_event_log
  WHERE project_id = v_project_id
  ORDER BY sequence_number DESC
  LIMIT 1;

  -- Hash (mirrors computeEventHash in ingestion.ts): join('|') of the stable
  -- fields. payload_text comes from TS so the chain stays consistent with the
  -- non-atomic emission path.
  v_stable := concat_ws('|',
    v_project_id::text,
    v_seq::text,
    p_event->>'event_type',
    COALESCE(p_event->>'subject_id', ''),
    p_event->>'actor_type',
    p_event->>'occurred_at',
    COALESCE(p_event->>'from_state', ''),
    COALESCE(p_event->>'to_state', ''),
    COALESCE(p_payload_text, '{}'),
    COALESCE(v_prev_hash, '')
  );
  v_hash := encode(digest(v_stable, 'sha256'), 'hex');

  INSERT INTO public.project_event_log (
    event_id, sequence_number, organization_id, project_id, portfolio_id, case_id,
    event_category, event_type, event_schema_version, event_importance, event_lifecycle_class,
    subject_type, subject_id, actor_type, actor_id, occurred_at,
    source_module, source_entity_type, source_entity_id, from_state, to_state,
    caused_by, correlation_id, saga_id, provenance, confidence,
    impact_schedule, impact_cost, impact_quality, impact_risk, impact_scope,
    payload, visibility, permission_scope, invalidation_tags,
    dedup_key, event_hash, previous_event_hash,
    is_compensating_event, compensates_event_id
  ) VALUES (
    v_event_id, v_seq,
    (p_event->>'organization_id')::uuid, v_project_id,
    NULLIF(p_event->>'portfolio_id', '')::uuid,
    COALESCE(NULLIF(p_event->>'case_id', '')::uuid, v_project_id),
    p_event->>'event_category', p_event->>'event_type',
    COALESCE((p_event->>'event_schema_version')::int, 1),
    p_event->>'event_importance', p_event->>'event_lifecycle_class',
    p_event->>'subject_type',
    NULLIF(p_event->>'subject_id', '')::uuid,
    p_event->>'actor_type',
    NULLIF(p_event->>'actor_id', '')::uuid,
    (p_event->>'occurred_at')::timestamptz,
    p_event->>'source_module',
    NULLIF(p_event->>'source_entity_type', ''),
    NULLIF(p_event->>'source_entity_id', '')::uuid,
    NULLIF(p_event->>'from_state', ''),
    NULLIF(p_event->>'to_state', ''),
    -- caused_by / invalidation_tags are JSON arrays in the row; ->> would yield
    -- JSON syntax (["…"]) which Postgres cannot cast to uuid[]/text[]. Rebuild
    -- the native array from the jsonb elements instead.
    COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p_event->'caused_by') x), '{}'::uuid[]),
    NULLIF(p_event->>'correlation_id', '')::uuid,
    NULLIF(p_event->>'saga_id', '')::uuid,
    COALESCE(p_event->'provenance', '{}'::jsonb),
    NULLIF(p_event->>'confidence', '')::numeric,
    NULLIF(p_event->>'impact_schedule', ''),
    NULLIF(p_event->>'impact_cost', ''),
    NULLIF(p_event->>'impact_quality', ''),
    NULLIF(p_event->>'impact_risk', ''),
    NULLIF(p_event->>'impact_scope', ''),
    COALESCE(p_event->'payload', '{}'::jsonb),
    COALESCE(p_event->>'visibility', 'normal'),
    COALESCE(p_event->'permission_scope', '{}'::jsonb),
    COALESCE((SELECT array_agg(x::text) FROM jsonb_array_elements_text(p_event->'invalidation_tags') x), '{}'::text[]),
    v_dedup_key, v_hash, v_prev_hash,
    COALESCE((p_event->>'is_compensating_event')::boolean, false),
    NULLIF(p_event->>'compensates_event_id', '')::uuid
  );

  -- Object-centric refs (idempotent upsert on the PK; same shape as the TS path).
  IF p_refs IS NOT NULL AND jsonb_array_length(p_refs) > 0 THEN
    INSERT INTO public.project_event_objects (event_id, object_type, object_id, role)
    SELECT v_event_id, r->>'object_type', (r->>'object_id')::uuid, r->>'role'
    FROM jsonb_array_elements(p_refs) AS r
    ON CONFLICT (event_id, object_type, object_id, role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'deduped', false, 'event_id', v_event_id, 'sequence_number', v_seq);
  -- NOTE: no EXCEPTION handler — failures propagate so the outer transaction
  -- (Risk mutation + this append) rolls back atomically.
END;
$$;

-- ── Direct capture: risk_registered (INSERT risk + event, one transaction) ────
-- p_risk = the exact fields the writer would have passed to .from("risks").insert
--          (snake_case) PLUS `id` (a uuid the writer generated with
--          crypto.randomUUID()). Generating the id client-side lets the writer
--          build the event with the REAL risk id (subject_id = source_entity_id
--          = risk_id) and compute the dedup_key in TS — reusing computeDedupKey
--          verbatim, no SQL duplication. Columns the writer omits fall back to
--          their DDL defaults via COALESCE, so flag-OFF (writer inserts directly,
--          DB-generated id) and flag-ON (this RPC inserts, writer-generated id)
--          produce structurally identical Risk rows (both are random uuids).
CREATE OR REPLACE FUNCTION public.capture_risk_registered(
  p_risk          jsonb,
  p_event         jsonb,
  p_payload_text  text,
  p_refs          jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_risk_id uuid;
BEGIN
  INSERT INTO public.risks (
    id, organization_id, project_id, title, description, category,
    probability, impact, severity, status, mitigation_plan,
    linked_task_id, linked_milestone_id, origin, confidence_score,
    evidence_json, needs_review, metadata
  )
  SELECT
    id, organization_id, project_id, title, description, COALESCE(category, 'other'),
    COALESCE(probability, 'medium'), COALESCE(impact, 'medium'), COALESCE(severity, 'medium'),
    COALESCE(status, 'open'), mitigation_plan,
    linked_task_id, linked_milestone_id, COALESCE(origin, 'manual'), confidence_score,
    COALESCE(evidence_json, '{}'::jsonb), COALESCE(needs_review, false),
    COALESCE(metadata, '{}'::jsonb)
  FROM jsonb_to_record(p_risk) AS t(
    id uuid, organization_id uuid, project_id uuid, title text, description text, category text,
    probability text, impact text, severity text, status text, mitigation_plan text,
    linked_task_id uuid, linked_milestone_id uuid, origin text, confidence_score numeric,
    evidence_json jsonb, needs_review boolean, metadata jsonb
  )
  RETURNING id INTO v_risk_id;

  -- The event already carries the real risk id (writer-generated); no stamping
  -- needed. Just append the event + refs atomically with the risk INSERT.
  RETURN public._append_event_atomic(p_event, p_payload_text, p_refs);
END;
$$;

-- ── Direct capture: risk status transition (UPDATE risk + event) ─────────────
-- Used by risk_reopened (status → 'open'). risk_closed is NOT emitted from the
-- closeout bulk-resolve (no RI-05 validation gate); that path is "not capturable
-- yet" per CAP-045 §A.10 #11 (binding). This function is retained for the
-- future validated-closure workflow and for reopen.
CREATE OR REPLACE FUNCTION public.capture_risk_status_change(
  p_risk_id        uuid,
  p_new_status     text,
  p_organization_id uuid,
  p_project_id     uuid,
  p_event          jsonb,
  p_payload_text   text,
  p_refs           jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.risks
  SET status = p_new_status, updated_at = now()
  WHERE id = p_risk_id
    AND organization_id = p_organization_id
    AND project_id = p_project_id
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    -- Risk not in scope / already in that state / soft-deleted. Fail loudly so
    -- the caller reports a non-success (no silent divergence).
    RAISE EXCEPTION 'risk_not_found_in_scope';
  END IF;

  RETURN public._append_event_atomic(p_event, p_payload_text, p_refs);
END;
$$;

-- ── Direct capture: append-only risk events with no Risk mutation ────────────
-- risk_assessed / risk_materialized do not change the risk row (the assessment
-- is a confirmation, not an edit; materialization records scope+impact). The
-- "operation" IS the event, so atomicity = a single atomic append.
CREATE OR REPLACE FUNCTION public.append_risk_event_atomic(
  p_event         jsonb,
  p_payload_text  text,
  p_refs          jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public._append_event_atomic(p_event, p_payload_text, p_refs);
END;
$$;

COMMENT ON FUNCTION public._append_event_atomic IS
  'P2-T2 atomic event append: dedup + per-project sequence + tamper-evident hash + object_refs, in one transaction. Failures propagate (no swallow) so the outer Risk mutation rolls back with the event. Internal helper — called only by the capture_* RPCs.';
COMMENT ON FUNCTION public.capture_risk_registered IS
  'P2-T2: INSERT risk + risk_registered event + object_refs in one transaction (pilot flag ON only). Defaults via COALESCE keep the Risk row byte-identical to the flag-OFF writer path.';
COMMENT ON FUNCTION public.capture_risk_status_change IS
  'P2-T2: UPDATE risk status + event + object_refs in one transaction. Used by risk_reopened. risk_closed is not emitted from the unvalidated closeout path (RI-05).';
COMMENT ON FUNCTION public.append_risk_event_atomic IS
  'P2-T2: atomic append of a risk event that does not mutate the risk row (risk_assessed, risk_materialized).';