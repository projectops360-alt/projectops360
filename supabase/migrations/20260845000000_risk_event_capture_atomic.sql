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
-- public, extensions. Supabase installs pgcrypto into the `extensions` schema,
-- so digest()/hmac() (tamper-evident event_hash + dedup_key) only resolve when
-- `extensions` is on the search_path; `extensions` is a trusted schema. EXECUTE
-- is REVOKEd EXPLICITLY from PUBLIC, anon AND authenticated on
-- ALL functions; the internal helpers (_append_event_atomic, _risk_refs_ok)
-- are REVOKEd from PUBLIC, anon, authenticated AND service_role (no grant —
-- callable only by the owner, i.e. the capture_* SECURITY DEFINER functions).
-- EXECUTE is then GRANTed ONLY to service_role on the three public RPCs. We do
-- NOT assume a grant never existed before — REVOKE is explicit against every
-- role. Each public RPC additionally guards auth.role() <> 'service_role'
-- (defense in depth — do NOT rely on the grants alone).
--
-- Idempotency (BLOCKER 2/3 + round-4 scope & fingerprint): the dedup_key is
-- computed in TS from a STABLE operation id supplied by the originating workflow
-- (never a fresh timestamp or a per-retry uuid). The key intentionally collides
-- for the same (projectId, eventType, commandId) — it does NOT embed the riskId
-- — so a commandId reused on another Risk of the same project is DETECTED in the
-- dedup hit. Every dedup hit enforces:
--   * SCOPE CHECK (BLOCKER 2): event_type / organization_id / project_id, and —
--     for events on an EXISTING risk (assess/materialize/reopen/owner/response/
--     closed) — subject_id = request.riskId. A mismatch raises
--     `idempotency_scope_conflict` (never a silent false success; p_risk_id is
--     never returned as the event's Risk without checking). For risk_registered
--     the subject check is SKIPPED: the stored subject_id is the canonical risk
--     id, not the per-attempt attemptRiskId.
--   * FINGERPRINT CHECK (BLOCKER 3): provenance.idempotency_fingerprint (a stable
--     hash of the significative request fields, excluding occurredAt/sequence/
--     event_hash/attemptRiskId/memoryItemId) must match. A mismatch raises
--     `idempotency_payload_conflict` (a reused idempotency key with a DIFFERENT
--     request is never silently accepted).
-- capture_risk_registered checks dedup BEFORE inserting the Risk and returns
-- the canonical risk_id on a hit; if a concurrent peer committed first, the
-- just-inserted Risk is removed and the peer's risk_id is returned.
-- capture_risk_status_change locks the risk row (SELECT ... FOR UPDATE), re-
-- checks dedup AFTER the lock (scope + fingerprint), enforces an
-- expectedFromStatus precondition, and applies a conditional UPDATE
-- (status = expected) validated by ROW_COUNT — so two concurrent transitions can
-- never both succeed and a dedup hit never leaves the state wrong (BLOCKER 3).
--
-- Invariants (BLOCKER 4): append_risk_event_atomic verifies the REAL risk row
-- before appending — subject_type/source_entity_type, subject_id =
-- source_entity_id, risks.id exists, the risk belongs to the received
-- org+project, deleted_at IS NULL, the project belongs to the same org, and
-- the focal/context refs match. Any failure raises WITHOUT a partial write.
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
--                 (structural invariant — the DB rejects an event_type the
--                 calling RPC is not responsible for).
-- Returns {"ok","deduped","event_id","sequence_number" | "error"}.

CREATE OR REPLACE FUNCTION public._append_event_atomic(
  p_event          jsonb,
  p_payload_text   text,
  p_refs           jsonb,
  p_allowed_types  text[] DEFAULT '{}',
  -- P2-T2 BLOCKER 2 — when TRUE (default; assess/materialize/reopen/owner/
  -- response-plan/closed), the dedup hit verifies the stored event's subject_id
  -- equals the request's subject_id (the stable riskId). When FALSE
  -- (risk_registered), the subject check is SKIPPED: the stored subject_id is
  -- the canonical risk id while the request's is the per-attempt attemptRiskId,
  -- which differs on every retry by construction.
  p_subject_stable boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_project_id         uuid  := (p_event->>'project_id')::uuid;
  v_dedup_key          text  := p_event->>'dedup_key';
  v_existing_event_id  uuid;
  v_existing_subject_id text;
  v_existing_org       text;
  v_existing_project   text;
  v_existing_type      text;
  v_existing_fp        text;
  v_req_fp             text  := p_event->'provenance'->>'idempotency_fingerprint';
  v_seq                bigint;
  v_prev_hash          text;
  v_event_id           uuid  := gen_random_uuid();
  v_stable             text;
  v_hash               text;
BEGIN
  -- Structural invariant: event_type must be in the caller's allowlist.
  IF p_allowed_types <> '{}' AND NOT (p_event->>'event_type' = ANY (p_allowed_types)) THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;

  -- Idempotency: a retry with the same dedup_key returns the existing event
  -- WITHOUT writing anything (no second event, no second ref).
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id, subject_id::text, organization_id::text, project_id::text,
           event_type, provenance->>'idempotency_fingerprint'
      INTO v_existing_event_id, v_existing_subject_id, v_existing_org,
           v_existing_project, v_existing_type, v_existing_fp
    FROM public.project_event_log
    WHERE project_id = v_project_id AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing_event_id IS NOT NULL THEN
      -- P2-T2 BLOCKER 2 — scope check: the existing event must belong to the
      -- same operation scope (event_type / org / project, and — when the subject
      -- is stable — the same riskId). A reused idempotency key on another Risk
      -- raises instead of being silently deduped (no false success).
      IF v_existing_type <> (p_event->>'event_type')
         OR v_existing_org <> (p_event->>'organization_id')
         OR v_existing_project <> v_project_id::text
         OR (p_subject_stable AND v_existing_subject_id <> COALESCE(p_event->>'subject_id', '')) THEN
        RAISE EXCEPTION 'idempotency_scope_conflict';
      END IF;
      -- P2-T2 BLOCKER 3 — fingerprint check: the request must match the
      -- original request. A reused idempotency key with a DIFFERENT request
      -- raises instead of being silently accepted.
      IF COALESCE(v_existing_fp, '') <> COALESCE(v_req_fp, '') THEN
        RAISE EXCEPTION 'idempotency_payload_conflict';
      END IF;
      RETURN jsonb_build_object('ok', true, 'deduped', true, 'event_id', v_existing_event_id, 'subject_id', v_existing_subject_id);
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
SET search_path = public, extensions
AS $$
DECLARE
  v_risk_id            uuid;
  v_risk_org           uuid  := (p_risk->>'organization_id')::uuid;
  v_risk_project       uuid  := (p_risk->>'project_id')::uuid;
  v_event_org          text  := p_event->>'organization_id';
  v_event_project      text  := p_event->>'project_id';
  v_dedup_key          text  := p_event->>'dedup_key';
  v_req_fp             text  := p_event->'provenance'->>'idempotency_fingerprint';
  v_existing_event_id  uuid;
  v_existing_risk_id   uuid;
  v_existing_subject_id text;
  v_existing_org       text;
  v_existing_project   text;
  v_existing_type      text;
  v_existing_fp        text;
  v_project_ok         boolean;
  v_append             jsonb;
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

  -- BLOCKER 2/3 — idempotency FIRST: a retry with the same (stable) dedup_key
  -- returns the existing event + canonical risk id and does NOT insert another
  -- Risk. Scope check (NO subject_id check: the stored subject_id is the
  -- canonical risk id, not the per-attempt attemptRiskId) + fingerprint check.
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id, subject_id, organization_id::text, project_id::text, event_type,
           provenance->>'idempotency_fingerprint'
      INTO v_existing_event_id, v_existing_risk_id, v_existing_org,
           v_existing_project, v_existing_type, v_existing_fp
    FROM public.project_event_log
    WHERE project_id = v_risk_project AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing_event_id IS NOT NULL THEN
      IF v_existing_type <> 'risk_registered'
         OR v_existing_org <> v_risk_org::text
         OR v_existing_project <> v_risk_project::text THEN
        RAISE EXCEPTION 'idempotency_scope_conflict';
      END IF;
      IF COALESCE(v_existing_fp, '') <> COALESCE(v_req_fp, '') THEN
        RAISE EXCEPTION 'idempotency_payload_conflict';
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'deduped', true,
        'event_id', v_existing_event_id,
        'risk_id', v_existing_risk_id
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

  -- P2-T2 BLOCKER 2 — never return p_risk_id as the Risk of the event without
  -- checking. p_subject_stable := FALSE: the stored subject_id is the canonical
  -- risk id, not this attempt's id. If a concurrent peer with the same dedup_key
  -- committed first, _append dedups; our just-inserted Risk is an ORPHAN — remove
  -- it and return the peer's canonical risk_id (read from the stored event's
  -- subject_id). The unique dedup_key constraint covers the race where the peer
  -- commits during our _append INSERT (23505 → whole tx rolls back, including the
  -- Risk; the client retries and the pre-check above returns deduped).
  v_append := public._append_event_atomic(p_event, p_payload_text, p_refs, ARRAY['risk_registered'], false);
  IF (v_append->>'deduped')::boolean THEN
    DELETE FROM public.risks WHERE id = v_risk_id;
    SELECT subject_id INTO v_existing_risk_id
    FROM public.project_event_log
    WHERE project_id = v_risk_project AND dedup_key = v_dedup_key
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true, 'deduped', true,
      'event_id', v_append->>'event_id',
      'risk_id', v_existing_risk_id
    );
  END IF;
  RETURN v_append || jsonb_build_object('risk_id', v_risk_id);
END;
$$;

-- ── Direct capture: risk status transition (UPDATE risk + event) ─────────────
-- Used by risk_reopened (status → 'open'). risk_closed is NOT emitted from the
-- closeout bulk-resolve (no RI-05 validation gate); that path is "not capturable
-- yet" per CAP-045 §A.10 #11 (binding). This function is retained for the
-- future validated-closure workflow and for reopen.
--
-- BLOCKER 3 — concurrency-safe order:
--   1. (optional) fast-path dedup pre-check before locking;
--   2. SELECT ... FOR UPDATE locks the risk row for this transaction;
--   3. re-check dedup AFTER the lock (a concurrent peer with the same command id
--      that committed while we waited now appears here);
--   4. verify the expected-from precondition against the locked row;
--   5. conditional UPDATE (status = expected) validated by ROW_COUNT;
--   6. append the event + refs in the SAME transaction.
-- Two concurrent same-command calls → one event + one transition. Two
-- different-command calls from the same state → only one valid transition.
-- A dedup hit returns BEFORE any mutation, so it can never leave the state
-- wrong. A stale request raises WITHOUT any mutation or event.
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
SET search_path = public, extensions
AS $$
DECLARE
  v_dedup_key          text  := p_event->>'dedup_key';
  v_req_fp             text  := p_event->'provenance'->>'idempotency_fingerprint';
  v_existing_event_id  uuid;
  v_existing_subject_id text;
  v_existing_org       text;
  v_existing_project   text;
  v_existing_type      text;
  v_existing_fp        text;
  v_current            text;
  v_updated            int;
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

  -- (1) Fast-path dedup pre-check (before locking). Avoids a row lock when the
  --     request is an obvious retry. Scope + fingerprint checks guard the hit.
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id, subject_id::text, organization_id::text, project_id::text,
           event_type, provenance->>'idempotency_fingerprint'
      INTO v_existing_event_id, v_existing_subject_id, v_existing_org,
           v_existing_project, v_existing_type, v_existing_fp
    FROM public.project_event_log
    WHERE project_id = p_project_id AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing_event_id IS NOT NULL THEN
      IF v_existing_type <> (p_event->>'event_type')
         OR v_existing_org <> p_organization_id::text
         OR v_existing_project <> p_project_id::text
         OR v_existing_subject_id <> p_risk_id::text THEN
        RAISE EXCEPTION 'idempotency_scope_conflict';
      END IF;
      IF COALESCE(v_existing_fp, '') <> COALESCE(v_req_fp, '') THEN
        RAISE EXCEPTION 'idempotency_payload_conflict';
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'deduped', true,
        'event_id', v_existing_event_id,
        'risk_id', v_existing_subject_id
      );
    END IF;
  END IF;

  -- (2) Lock the risk row for the rest of this transaction (BLOCKER 3). A
  --     concurrent capture_risk_status_change on the same risk waits here until
  --     the first commits; then the re-check below sees the committed event.
  SELECT status INTO v_current
  FROM public.risks
  WHERE id = p_risk_id AND organization_id = p_organization_id
    AND project_id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'risk_not_found_in_scope';
  END IF;

  -- (3) Re-check dedup AFTER acquiring the lock: a concurrent peer with the
  --     SAME command id that committed while we waited now shows up here → we
  --     return deduped WITHOUT touching the row. Scope + fingerprint checks guard
  --     the hit.
  IF v_dedup_key IS NOT NULL THEN
    SELECT event_id, subject_id::text, organization_id::text, project_id::text,
           event_type, provenance->>'idempotency_fingerprint'
      INTO v_existing_event_id, v_existing_subject_id, v_existing_org,
           v_existing_project, v_existing_type, v_existing_fp
    FROM public.project_event_log
    WHERE project_id = p_project_id AND dedup_key = v_dedup_key
    LIMIT 1;
    IF v_existing_event_id IS NOT NULL THEN
      IF v_existing_type <> (p_event->>'event_type')
         OR v_existing_org <> p_organization_id::text
         OR v_existing_project <> p_project_id::text
         OR v_existing_subject_id <> p_risk_id::text THEN
        RAISE EXCEPTION 'idempotency_scope_conflict';
      END IF;
      IF COALESCE(v_existing_fp, '') <> COALESCE(v_req_fp, '') THEN
        RAISE EXCEPTION 'idempotency_payload_conflict';
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'deduped', true,
        'event_id', v_existing_event_id,
        'risk_id', v_existing_subject_id
      );
    END IF;
  END IF;

  -- (4) Precondition: the locked row is still in the expected state. A stale
  --     request (the risk has since moved) is rejected WITHOUT any mutation.
  IF v_current <> p_expected_from_status THEN
    RAISE EXCEPTION 'wrong_from_state';
  END IF;

  -- (5) Conditional transition: only if the row is STILL in the expected state
  --     (redundant under the FOR UPDATE lock, but defensive and proves the
  --     invariant via ROW_COUNT). Under the lock no concurrent writer can race
  --     between the precondition and the UPDATE.
  UPDATE public.risks
  SET status = p_new_status, updated_at = now()
  WHERE id = p_risk_id AND organization_id = p_organization_id
    AND project_id = p_project_id AND deleted_at IS NULL
    AND status = p_expected_from_status;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'wrong_from_state';
  END IF;

  -- (6) Append the event + refs in the SAME transaction.
  RETURN public._append_event_atomic(
    p_event, p_payload_text, p_refs, ARRAY['risk_reopened', 'risk_closed']
  ) || jsonb_build_object('risk_id', p_risk_id);
END;
$$;

-- ── Direct capture: append-only risk events with no Risk mutation ────────────
-- risk_assessed / risk_materialized (and the other append-only risk events) do
-- not change the risk row. The "operation" IS the event, so atomicity = a
-- single atomic append via the helper.
--
-- BLOCKER 4 — before appending, verify the REAL risk row the event claims to
-- describe: subject_type/source_entity_type are 'risk'/'risks', subject_id =
-- source_entity_id, the risk exists, belongs to the received org+project, is
-- not deleted, and its project belongs to the same org. The focal/context
-- refs must match those ids. Any failure raises WITHOUT a partial write.
CREATE OR REPLACE FUNCTION public.append_risk_event_atomic(
  p_event         jsonb,
  p_payload_text  text,
  p_refs          jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_subject_id  uuid;
  v_risk_ok     boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- BLOCKER 4 — event_type allowlist (append-only risk events only).
  IF p_event->>'event_type' NOT IN (
    'risk_assessed', 'risk_materialized',
    'risk_owner_assigned', 'risk_owner_changed', 'risk_response_plan_approved'
  ) THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;

  -- subject/source consistency.
  IF p_event->>'subject_type' <> 'risk' THEN
    RAISE EXCEPTION 'invariant_subject_type';
  END IF;
  IF COALESCE(p_event->>'source_entity_type', '') <> 'risks' THEN
    RAISE EXCEPTION 'invariant_source_entity_type';
  END IF;
  v_subject_id := NULLIF(p_event->>'subject_id', '')::uuid;
  IF v_subject_id IS NULL OR (p_event->>'subject_id') <> COALESCE(p_event->>'source_entity_id', '') THEN
    RAISE EXCEPTION 'invariant_subject_source_mismatch';
  END IF;

  -- The risk must exist, belong to the received org+project, not be deleted,
  -- and its project must belong to the same org.
  SELECT EXISTS (
    SELECT 1
    FROM public.risks r
    JOIN public.projects p ON p.id = r.project_id AND p.organization_id = r.organization_id
    WHERE r.id = v_subject_id
      AND r.organization_id = (p_event->>'organization_id')::uuid
      AND r.project_id = (p_event->>'project_id')::uuid
      AND r.deleted_at IS NULL
      AND p.deleted_at IS NULL
  ) INTO v_risk_ok;
  IF NOT v_risk_ok THEN
    RAISE EXCEPTION 'invariant_risk_not_in_scope';
  END IF;

  -- The focal/context refs must point at this risk + this project.
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

-- ── Privileges (BLOCKER 1 — privilege hardening) ──────────────────────────────
-- REVOKE explicitly from EVERY role (PUBLIC, anon, authenticated) on ALL
-- functions. Do NOT assume a grant never existed before. Then grant EXECUTE
-- ONLY to service_role on the three public RPCs. The two internal helpers get
-- NO grant (REVOKE from service_role too) — callable only by their owner (the
-- migration role = the same owner as the capture_* SECURITY DEFINER functions).

-- Internal helper _append_event_atomic: revoke from everyone, grant to nobody.
REVOKE ALL ON FUNCTION public._append_event_atomic(jsonb, text, jsonb, text[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._append_event_atomic(jsonb, text, jsonb, text[], boolean) FROM anon;
REVOKE ALL ON FUNCTION public._append_event_atomic(jsonb, text, jsonb, text[], boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public._append_event_atomic(jsonb, text, jsonb, text[], boolean) FROM service_role;

-- Internal helper _risk_refs_ok: revoke from everyone, grant to nobody.
REVOKE ALL ON FUNCTION public._risk_refs_ok(jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._risk_refs_ok(jsonb, text, text) FROM anon;
REVOKE ALL ON FUNCTION public._risk_refs_ok(jsonb, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public._risk_refs_ok(jsonb, text, text) FROM service_role;

-- Public RPCs: revoke from PUBLIC, anon, authenticated; grant ONLY to service_role.
REVOKE ALL ON FUNCTION public.capture_risk_registered(jsonb, jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_risk_registered(jsonb, jsonb, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.capture_risk_registered(jsonb, jsonb, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.capture_risk_registered(jsonb, jsonb, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.capture_risk_status_change(uuid, text, text, uuid, uuid, jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_risk_status_change(uuid, text, text, uuid, uuid, jsonb, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.capture_risk_status_change(uuid, text, text, uuid, uuid, jsonb, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.capture_risk_status_change(uuid, text, text, uuid, uuid, jsonb, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.append_risk_event_atomic(jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_risk_event_atomic(jsonb, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.append_risk_event_atomic(jsonb, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.append_risk_event_atomic(jsonb, text, jsonb) TO service_role;

COMMENT ON FUNCTION public._append_event_atomic IS
  'P2-T2 atomic event append: dedup + per-project sequence + tamper-evident hash + object_refs, in one transaction. Failures propagate (no swallow) so the outer Risk mutation rolls back with the event. Dedup hit enforces a scope check (event_type/org/project, and — when p_subject_stable — subject_id=riskId) raising idempotency_scope_conflict, and a request-fingerprint check (provenance.idempotency_fingerprint) raising idempotency_payload_conflict. Internal helper — REVOKEd from PUBLIC/anon/authenticated/service_role (no grant); callable only by the capture_* SECURITY DEFINER functions (same owner).';
COMMENT ON FUNCTION public._risk_refs_ok IS
  'P2-T2 structural invariant helper: the object_refs must carry (risk focal + project context). REVOKEd from every role (no grant); called only by the capture_* SECURITY DEFINER functions.';
COMMENT ON FUNCTION public.capture_risk_registered IS
  'P2-T2: INSERT risk + risk_registered event + object_refs in one transaction (service_role only). Idempotent via a STABLE dedup_key (operation id): a retry returns the existing event_id + canonical risk_id without inserting another Risk. Dedup hit enforces a scope check (org/project; NO subject_id — the stored subject is the canonical risk id, not the per-attempt id) raising idempotency_scope_conflict, and a fingerprint check (the logical Risk + source item) raising idempotency_payload_conflict. If a concurrent peer committed first, the just-inserted Risk is removed and the peer''s canonical risk_id is returned. Defaults via COALESCE keep the Risk row byte-identical to the flag-OFF writer path.';
COMMENT ON FUNCTION public.capture_risk_status_change IS
  'P2-T2: UPDATE risk status + event + object_refs in one transaction (service_role only). Concurrency-safe: SELECT … FOR UPDATE + dedup re-check after the lock + expectedFromStatus precondition + conditional UPDATE validated by ROW_COUNT. Each dedup hit enforces a scope check (event_type/org/project/subject_id=riskId) raising idempotency_scope_conflict and a fingerprint check raising idempotency_payload_conflict; it returns the stored subject_id (never p_risk_id unchecked). A dedup hit returns before any mutation; a stale request raises without mutation. Used by risk_reopened; risk_closed is not emitted from the unvalidated closeout path (RI-05).';
COMMENT ON FUNCTION public.append_risk_event_atomic IS
  'P2-T2: atomic append of a risk event that does not mutate the risk row (risk_assessed, risk_materialized, owner/response-plan). Verifies the REAL risk row (exists, in-scope, not deleted, project in org) before appending. service_role only. Dedup hit (via _append_event_atomic with p_subject_stable=true) enforces the scope + fingerprint checks.';