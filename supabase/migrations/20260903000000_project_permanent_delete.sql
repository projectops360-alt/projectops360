-- ============================================================================
-- Permanent project deletion (PD — destructive, audited)
-- ============================================================================
-- Archiving a project soft-deletes it. That is the right default, but it left
-- no way to actually destroy one: test data, a mis-imported plan or a project
-- that must be erased on request stayed in the tenant forever, and — because
-- `projects_organization_id_slug_key` counts soft-deleted rows — kept its slug
-- reserved, so the same plan could never be re-imported under its own name.
--
-- CONFLICT RESOLVED HERE (recorded decision, CAP-045 §immutability):
-- `project_event_log` is append-only and enforced by a trigger. Destroying a
-- project necessarily destroys its events. Rather than weaken the contract
-- globally, this migration opens exactly ONE audited door:
--
--   * the purge writes an act into compliance_archive.project_purges FIRST,
--     recording who destroyed what, when, how many rows, and a SHA-256 over
--     the event set that is about to cease to exist;
--   * only then does it set `app.purge_project` to that project's id, which
--     is the sole condition under which the immutability trigger allows a
--     DELETE — and only for rows belonging to that project.
--
-- Append-only therefore still holds for every other caller and every other
-- operation. What changes is that erasure becomes possible, provable and
-- attributable instead of impossible.
-- ============================================================================

-- ── 1. The act of destruction ───────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS compliance_archive;

CREATE TABLE IF NOT EXISTS compliance_archive.project_purges (
  purge_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL,
  project_id        uuid NOT NULL,
  project_slug      text NOT NULL,
  project_title     jsonb,
  executed_by       uuid,
  executed_by_email text,
  executed_at       timestamptz NOT NULL DEFAULT now(),
  -- Row counts per table at the moment of destruction.
  row_counts        jsonb NOT NULL,
  -- Proof of what was destroyed: a SHA-256 sealing the event hash chain.
  event_count       integer NOT NULL,
  event_log_sha256  text NOT NULL
);

COMMENT ON TABLE compliance_archive.project_purges IS
  'One row per permanently deleted project. Written BEFORE anything is destroyed; the only record that the project ever existed.';

ALTER TABLE compliance_archive.project_purges ENABLE ROW LEVEL SECURITY;
-- No policies: readable only by the service role / SQL console. The act must
-- not be reachable, let alone editable, from the application surface.

-- The act itself is append-only, or it proves nothing.
CREATE OR REPLACE FUNCTION compliance_archive.project_purges_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'compliance_archive.project_purges is append-only: % is not allowed', TG_OP;
END; $$;

DROP TRIGGER IF EXISTS trg_project_purges_no_update ON compliance_archive.project_purges;
CREATE TRIGGER trg_project_purges_no_update
  BEFORE UPDATE OR DELETE ON compliance_archive.project_purges
  FOR EACH ROW EXECUTE FUNCTION compliance_archive.project_purges_immutable();

-- ── 2. The one door in the immutability trigger ─────────────────────────────

CREATE OR REPLACE FUNCTION public.project_event_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- The single exception to append-only: an audited project purge. It sets
  -- app.purge_project (transaction-local) to the project being destroyed
  -- after writing its act to compliance_archive.project_purges. The guard is
  -- per-row, so a purge of project A can never delete an event of project B.
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('app.purge_project', true), '') = OLD.project_id::text
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'project_event_log is append-only: % is not allowed (use a compensating event)', TG_OP;
END; $$;

-- ── 3. The purge ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_project_permanently(
  p_project_id      uuid,
  p_organization_id uuid,
  p_actor_id        uuid,
  p_actor_email     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, compliance_archive, pg_temp
AS $$
DECLARE
  v_slug        text;
  v_title       jsonb;
  v_counts      jsonb;
  v_event_count integer;
  v_event_hash  text;
  v_purge_id    uuid;
BEGIN
  -- Tenant scope is part of the lookup, not a later check: a project id from
  -- another organization simply does not resolve.
  SELECT slug, title_i18n INTO v_slug, v_title
  FROM public.projects
  WHERE id = p_project_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found_in_organization';
  END IF;

  SELECT jsonb_build_object(
    'tasks',        (SELECT count(*) FROM public.roadmap_tasks   WHERE project_id = p_project_id),
    'milestones',   (SELECT count(*) FROM public.milestones      WHERE project_id = p_project_id),
    'dependencies', (SELECT count(*) FROM public.task_dependencies WHERE project_id = p_project_id),
    'resources',    (SELECT count(*) FROM public.resources       WHERE project_id = p_project_id),
    'risks',        (SELECT count(*) FROM public.risks           WHERE project_id = p_project_id),
    'budget_items', (SELECT count(*) FROM public.budget_items    WHERE project_id = p_project_id),
    'process_nodes',(SELECT count(*) FROM public.process_nodes   WHERE project_id = p_project_id),
    'events',       (SELECT count(*) FROM public.project_event_log WHERE project_id = p_project_id)
  ) INTO v_counts;

  -- Hash the event set BEFORE destroying it.
  -- The log is already a hash chain, so the act seals the chain itself: a
  -- SHA-256 over each row's event_hash in sequence order. That is enough to
  -- prove later exactly which events were destroyed, without keeping any of
  -- their payloads.
  SELECT count(*),
         coalesce(
           encode(sha256(convert_to(
             string_agg(coalesce(e.event_hash, e.event_id::text), ',' ORDER BY e.global_seq),
             'UTF8')), 'hex'),
           '')
    INTO v_event_count, v_event_hash
  FROM public.project_event_log e
  WHERE e.project_id = p_project_id;

  INSERT INTO compliance_archive.project_purges (
    organization_id, project_id, project_slug, project_title,
    executed_by, executed_by_email, row_counts, event_count, event_log_sha256
  ) VALUES (
    p_organization_id, p_project_id, v_slug, v_title,
    p_actor_id, p_actor_email, v_counts, v_event_count, v_event_hash
  )
  RETURNING purge_id INTO v_purge_id;

  -- Transaction-local: it dies with this statement's transaction whether the
  -- purge commits or rolls back.
  PERFORM set_config('app.purge_project', p_project_id::text, true);

  -- 121 tables cascade from here; audit_logs and friends are ON DELETE SET
  -- NULL and survive by design.
  DELETE FROM public.projects
  WHERE id = p_project_id AND organization_id = p_organization_id;

  PERFORM set_config('app.purge_project', '', true);

  RETURN jsonb_build_object(
    'purge_id', v_purge_id,
    'project_slug', v_slug,
    'row_counts', v_counts,
    'event_count', v_event_count
  );
END; $$;

COMMENT ON FUNCTION public.delete_project_permanently IS
  'Destroys a project and everything cascading from it, after recording an act in compliance_archive.project_purges. The only sanctioned way to delete project_event_log rows.';

-- Never PUBLIC (REG-036: a grant to PUBLIC on a SECURITY DEFINER function is a
-- cross-tenant leak). The application calls this with the service role only,
-- after checking the caller is an owner/admin of the organization.
REVOKE ALL ON FUNCTION public.delete_project_permanently(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_project_permanently(uuid, uuid, uuid, text) TO service_role;
