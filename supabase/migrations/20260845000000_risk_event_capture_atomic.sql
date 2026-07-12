-- ============================================================================
-- P2-T2 Acceptance Remediation — atomic risk event capture (PD-018; Fase 2)
-- ============================================================================
-- Adds the transactional boundary that keeps a Risk mutation and its canonical
-- event + object_refs in the SAME PostgreSQL transaction, so that when the
-- pilot flag is ON the two effects can never diverge silently:
--   * a failed event never leaves a mutated Risk without evidence;
--   * a failed Risk mutation never leaves an event asserting a fact that did
--     not happen;
--   * a retry never duplicates an event OR a Risk (dedup_key, stable per
--     operation id — see BLOCKER 2).
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
--   * Failures PROPAGATE (no EXCEPTION swallow) so the outer transaction (Risk
--     mutation included) rolls back atomically.
--
-- Security (BLOCKER 1): every function is SECURITY DEFINER + SET search_path =
-- public. EXECUTE is REVOKEd from PUBLIC and GRANTed ONLY to service_role on
-- the three public RPCs; the internal helper _append_event_atomic is REVOKEd
-- from PUBLIC with NO grant (callable only by the owner, i.e. the capture_*
-- SECURITY DEFINER functions). Each public RPC additionally guards
-- auth.role() <> 'service_role' (defense in depth — do NOT rely on the TS
-- client alone).
--
-- Idempotency (BLOCKER 2/3): the dedup_key is computed in TS from a STABLE
-- operation id supplied by the originating workflow (never a fresh timestamp
-- or a per-retry uuid). capture_risk_registered checks dedup BEFORE inserting
-- the Risk and returns the existing risk_id on a hit. capture_risk_status_change
-- checks dedup BEFORE the UPDATE (a retry never re-mutates the Risk nor bumps
-- updated_at) and enforces an expectedFromStatus precondition (a stale request
-- cannot revert a later state).
--
-- Additive: no changes to project_event_log / project_event_objects / risks.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Internal helper: atomic event + object_refs append ──────────────────────
-- p_event       = the NormalizedRow (snake_case) produced by normalizeProjectEvent
--                 WITHOUT sequence_number / event_hash / previous_event_hash /
--                 recorded_at (those are assigned here or by DDL defaults).
-- p_payload_text = JSON.stringify(payload) from TS (hash consistency).
-- p_refs        = [{"object_type","object_id","role"}, ...] (OCEL 2.0).
-- p_allowed_types = the set of event_type values the CALLER is allowed to append
--                 (BLOCKER 4: structural invariant — the DB rejects an event_type
--                 the calling RPC is not responsible for).
-- Returns {"ok","deduped","event_id","sequence_number" | "error"}.
CREATE OR REPLACE FUNCTION public._append_event_atomic(
  p_event          jsonb,
  p_payload_text   text,
  p_refs           jsonb,
  p_allowed_types  text[] DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id         uuid  := (p_event->>'project_id')::uuid;
  v_dedup_key          text  := p_event->>'dedup_key';
  v_existing_event_id  uuid;
  v_seq                bigint;
  v_prev_hash          text;
  v_event_id           uuid  := gen_random_uuid();
  v_stable             text;
  v_hash               text;
BEGIN
  -- BLOCKER 4 — structural invariant: event_type must be in the caller's allowlist.
  IF p_allowed_types <> '{}' AND NOT (p_event->>'event_type' = ANY (p_allowed_types)) THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;

  -- Idempotency (BLOCKER 2/3): a retry with the same dedup_key returns the
  -- existing event WITHOUT writing anything (no second event, no second ref).
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
  -- (Risk mutation + this append) rolls back atomically. A concurrent duplicate
  -- (unique uq_pel_dedup violation, 23505) also propagates: the whole tx rolls
  -- back (including any Risk INSERT in capture_risk_registered), the client
  -- retries, and the pre-check above returns deduped. No duplicate Risk.
END;
$$;

-- ── Structural invariant helpers (BLOCKER 4) ──────────────────────────────────
-- Minimal, security/consistency-only. NOT a duplicate of the TS registry: these
-- only reject a self-inconsistent or cross-tenant payload, never validate
-- business semantics.

-- Verify the object_refs carry the required (risk focal + project context) refs
-- for the given risk id + project id.
CREATE OR REPLACE FUNCTION public._risk_refs_ok(
  p_refs        jsonb,
  p_risk_id     text,
  p_project_id  text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM jsonb_array_elements(p_refs) r
            WHERE r->>'object_type' = 'risk' AND r->>'object_id' = p_risk_id AND r->>'role' = 'focal')
    AND
    EXISTS (SELECT 1 FROM jsonb_array_elements(p_refs) r
            WHERE r->>'object_type' = 'project' AND r->>'object_id' = p_project_id AND r->>'role' = 'context')
$$;

-- ── Direct capture: risk_registered (INSERT risk + event, one transaction) ────
-- p_risk = the exact fields the writer would have passed to .from("risks").insert
--          (snake_case) PLUS `id` (a uuid the writer generated with
--          crypto.randomUUID()). The dedup_key in p_event is derived in TS from
--          a STABLE operation id (idempotencyKey), so a retry produces the same
--          key regardless of the fresh uuid/timestamp.
-- On a dedup hit: returns the EXISTING event_id + EXISTING risk_id (read from
--          the stored event's subject_id) and does NOT insert another Risk.
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
  v_risk_id            uuid;
  v_risk_org           uuid  := (p_risk->>'organization_id')::uuid;
  v_risk_project       uuid  := (p_risk->>'project_id')::uuid;
  v_event_org          text  := p_event->>'organization_id';
  v_event_project      text  := p_event->>'project_id';
  v_dedup_key          text  := p_event->>'dedup_key';
  v_existing           RECORD;
  v_project_ok         boolean;
BEGIN
  -- BLOCKER 1 — defense in depth: only the service role (admin client) may call.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- BLOCKER 4 — structural / cross-tenant invariants.
  IF p_event->>'event_type' <> 'risk_registered' THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;
  IF v_risk_org::text <> v_event_org OR v_risk_project::text <> v_event_project THEN
    RAISE EXCEPTION 'invariant_tenant_mismatch';
  END IF;
  IF (p_risk->>'id') IS NULL OR (p_risk->>'id') <> (p_event->>'subject_id')
     OR (p_risk->>'id') <> (p_event->>'source_entity_id') THEN
    RAISE EXCEPTION 'invariant_risk_identity_mismatch';
  END IF;
  IF NOT public._risk_refs_ok(p_refs, p_risk->>'id', v_event_project) THEN
    RAISE EXCEPTION 'invariant_object_refs';
  END IF;
  -- The project must belong to the received org (no cross-tenant Risk creation).
  SELECT EXISTS (SELECT 1 FROM public.projects
                 WHERE id = v_risk_project AND organization_id = v_risk_org
                 AND deleted_at IS NULL) INTO v_project_ok;
  IF NOT v_project_ok THEN
    RAISE EXCEPTION 'invariant_project_not_in_org';
  END IF;

  -- BLOCKER 2 — idempotency FIRST: a retry with the same (stable) dedup_key
  -- returns the existing event + risk id and does NOT insert another Risk.
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id, subject_id INTO v_existing
    FROM public.project_event_log
    WHERE project_id = v_risk_project AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing.event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'deduped', true,
        'event_id', v_existing.event_id,
        'risk_id', v_existing.subject_id
      );
    END IF;
  END IF;

  -- Not deduped: create Risk + event + refs in ONE transaction.
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

  RETURN public._append_event_atomic(p_event, p_payload_text, p_refs, ARRAY['risk_registered'])
    || jsonb_build_object('risk_id', v_risk_id);
END;
$$;

-- ── Direct capture: risk status transition (UPDATE risk + event) ─────────────
-- Used by risk_reopened (status → 'open'). risk_closed is NOT emitted from the
-- closeout bulk-resolve (no RI-05 validation gate); that path is "not capturable
-- yet" per CAP-045 §A.10 #11 (binding). This function is retained for the
-- future validated-closure workflow and for reopen.
--
-- BLOCKER 3 — order: dedup check BEFORE the UPDATE. A retry (same dedup_key)
-- returns deduped WITHOUT touching status or updated_at. An unknown/stale
-- request (current status <> p_expected_from_status) raises WITHOUT any
-- mutation or event.
CREATE OR REPLACE FUNCTION public.capture_risk_status_change(
  p_risk_id            uuid,
  p_new_status         text,
  p_expected_from_status text,
  p_organization_id    uuid,
  p_project_id         uuid,
  p_event              jsonb,
  p_payload_text       text,
  p_refs               jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dedup_key    text  := p_event->>'dedup_key';
  v_existing     RECORD;
  v_current      text;
  v_updated      int;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- BLOCKER 4 — structural invariants.
  IF p_event->>'event_type' NOT IN ('risk_reopened', 'risk_closed') THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;
  IF (p_event->>'subject_id') <> p_risk_id::text THEN
    RAISE EXCEPTION 'invariant_risk_subject_mismatch';
  END IF;
  IF p_event->>'organization_id' <> p_organization_id::text
     OR p_event->>'project_id' <> p_project_id::text THEN
    RAISE EXCEPTION 'invariant_tenant_mismatch';
  END IF;
  IF NOT public._risk_refs_ok(p_refs, p_risk_id::text, p_project_id::text) THEN
    RAISE EXCEPTION 'invariant_object_refs';
  END IF;

  -- BLOCKER 3 — dedup BEFORE the mutation: a retry returns deduped and does NOT
  -- re-update the status nor bump updated_at.
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id INTO v_existing.event_id
    FROM public.project_event_log
    WHERE project_id = p_project_id AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing.event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'deduped', true,
        'event_id', v_existing.event_id,
        'risk_id', p_risk_id
      );
    END IF;
  END IF;

  -- Read the current status (scoped to this org+project) for the precondition.
  SELECT status INTO v_current
  FROM public.risks
  WHERE id = p_risk_id AND organization_id = p_organization_id
    AND project_id = p_project_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'risk_not_found_in_scope';
  END IF;

  -- BLOCKER 3 — expectedFromStatus precondition: a stale request cannot revert
  -- a later state. Fails WITHOUT any mutation or event.
  IF v_current <> p_expected_from_status THEN
    RAISE EXCEPTION 'wrong_from_state';
  END IF;

  -- Apply the transition + append the event in ONE transaction.
  UPDATE public.risks
  SET status = p_new_status, updated_at = now()
  WHERE id = p_risk_id AND organization_id = p_organization_id
    AND project_id = p_project_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'risk_not_found_in_scope';
  END IF;

  RETURN public._append_event_atomic(
    p_event, p_payload_text, p_refs, ARRAY['risk_reopened', 'risk_closed']
  ) || jsonb_build_object('risk_id', p_risk_id);
END;
$$;

-- ── Direct capture: append-only risk events with no Risk mutation ────────────
-- risk_assessed / risk_materialized (and the other append-only risk events) do
-- not change the risk row. The "operation" IS the event, so atomicity = a
-- single atomic append via the helper.
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
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- BLOCKER 4 — structural invariants: append-only risk events only, and the
  -- focal/context refs must point at the event subject (the risk).
  IF p_event->>'event_type' NOT IN (
    'risk_assessed', 'risk_materialized',
    'risk_owner_assigned', 'risk_owner_changed', 'risk_response_plan_approved'
  ) THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;
  IF NOT public._risk_refs_ok(p_refs, p_event->>'subject_id', p_event->>'project_id') THEN
    RAISE EXCEPTION 'invariant_object_refs';
  END IF;

  RETURN public._append_event_atomic(
    p_event, p_payload_text, p_refs,
    ARRAY['risk_assessed', 'risk_materialized',
          'risk_owner_assigned', 'risk_owner_changed', 'risk_response_plan_approved']
  );
END;
$$;

-- ── Privileges (BLOCKER 1) ─────────────────────────────────────────────────────
-- Internal helper: revoke from PUBLIC, grant to NOBODY. Only the owner (the
-- migration role = the same owner as the capture_* SECURITY DEFINER functions)
-- can execute it, so the capture_* functions (which run as that owner) may call
-- it; anon / authenticated / service_role clients cannot invoke it directly.
REVOKE ALL ON FUNCTION public._append_event_atomic(jsonb, text, jsonb, text[]) FROM PUBLIC;

-- Public RPCs: revoke from PUBLIC, grant EXECUTE ONLY to service_role.
REVOKE ALL ON FUNCTION public.capture_risk_registered(jsonb, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_risk_registered(jsonb, jsonb, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.capture_risk_status_change(uuid, text, text, uuid, uuid, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_risk_status_change(uuid, text, text, uuid, uuid, jsonb, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.append_risk_event_atomic(jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_risk_event_atomic(jsonb, text, jsonb) TO service_role;

COMMENT ON FUNCTION public._append_event_atomic IS
  'P2-T2 atomic event append: dedup + per-project sequence + tamper-evident hash + object_refs, in one transaction. Failures propagate (no swallow) so the outer Risk mutation rolls back with the event. Internal helper — REVOKEd from PUBLIC, no GRANT; callable only by the capture_* SECURITY DEFINER functions (same owner).';
COMMENT ON FUNCTION public.capture_risk_registered IS
  'P2-T2: INSERT risk + risk_registered event + object_refs in one transaction (service_role only). Idempotent via a STABLE dedup_key (operation id): a retry returns the existing event_id + risk_id without inserting another Risk. Defaults via COALESCE keep the Risk row byte-identical to the flag-OFF writer path.';
COMMENT ON FUNCTION public.capture_risk_status_change IS
  'P2-T2: UPDATE risk status + event + object_refs in one transaction (service_role only). Dedup is checked BEFORE the UPDATE (a retry never re-mutates nor bumps updated_at). expectedFromStatus precondition rejects stale requests without mutation. Used by risk_reopened; risk_closed is not emitted from the unvalidated closeout path (RI-05).';
COMMENT ON FUNCTION public.append_risk_event_atomic IS
  'P2-T2: atomic append of a risk event that does not mutate the risk row (risk_assessed, risk_materialized, owner/response-plan). service_role only.';