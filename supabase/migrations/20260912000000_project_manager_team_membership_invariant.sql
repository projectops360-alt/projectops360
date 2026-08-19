-- Ensure every projects.project_manager_id is represented in project_team_members.
-- Team & Roles remains the canonical project roster.

CREATE OR REPLACE FUNCTION public._ensure_project_manager_team_membership(
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_display_name text;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
    INTO v_project
    FROM public.projects
   WHERE id = p_project_id
     AND deleted_at IS NULL;

  IF NOT FOUND OR v_project.project_manager_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_project.id::text || ':' || v_project.project_manager_id::text || ':project_manager',
    0
  ));

  SELECT NULLIF(btrim(display_name), '')
    INTO v_display_name
    FROM public.profiles
   WHERE id = v_project.project_manager_id;

  -- If the canonical PM role already exists, normalize its permission/name.
  UPDATE public.project_team_members ptm
     SET permission_level = 'project_manager',
         display_name = COALESCE(ptm.display_name, v_display_name),
         updated_at = now()
   WHERE ptm.organization_id = v_project.organization_id
     AND ptm.project_id = v_project.id
     AND ptm.user_id = v_project.project_manager_id
     AND ptm.status <> 'removed'
     AND lower(btrim(COALESCE(ptm.project_role, ''))) = 'project manager';

  IF FOUND THEN
    RETURN;
  END IF;

  -- Preserve any other legitimate role the same person may hold. Add a distinct
  -- Project Manager role instead of overwriting Product Owner, QA, etc.
  INSERT INTO public.project_team_members (
    organization_id,
    project_id,
    user_id,
    member_type,
    display_name,
    project_role,
    permission_level,
    status
  ) VALUES (
    v_project.organization_id,
    v_project.id,
    v_project.project_manager_id,
    'internal_user',
    v_display_name,
    'Project Manager',
    'project_manager',
    'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_project_manager_team_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ensure_project_manager_team_membership(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._ensure_project_manager_team_membership(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._ensure_project_manager_team_membership(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._sync_project_manager_to_project_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND NEW.project_manager_id IS NOT NULL THEN
    PERFORM public._ensure_project_manager_team_membership(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_project_manager_to_project_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_project_manager_to_project_team() FROM anon;
REVOKE ALL ON FUNCTION public._sync_project_manager_to_project_team() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_project_manager_to_project_team ON public.projects;
CREATE TRIGGER trg_sync_project_manager_to_project_team
AFTER INSERT OR UPDATE OF project_manager_id, organization_id, deleted_at
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public._sync_project_manager_to_project_team();

-- Repair current projects whose explicit PM is missing from Team & Roles.
DO $$
DECLARE
  v_project_id uuid;
BEGIN
  FOR v_project_id IN
    SELECT p.id
      FROM public.projects p
     WHERE p.deleted_at IS NULL
       AND p.project_manager_id IS NOT NULL
  LOOP
    PERFORM public._ensure_project_manager_team_membership(v_project_id);
  END LOOP;
END;
$$;