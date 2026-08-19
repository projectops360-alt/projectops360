-- Project person membership invariant
--
-- Problem: task quick-add historically created a person only in `resources`, while
-- Team & Roles reads `project_team_members` as the canonical project roster.
-- That allowed a task assignee to exist in the project but disappear from both
-- Team & Roles views.
--
-- Invariant introduced here:
--   1. A project-scoped person resource created by task quick-add is represented
--      by at least one active project_team_members row.
--   2. A person resource assigned to an active roadmap task is represented by at
--      least one active project_team_members row, regardless of how it was made.
--   3. Existing matching team membership is reused; we never create a duplicate
--      merely to establish the invariant.
--
-- The triggers make this a database invariant rather than a UI convention, so a
-- later refactor cannot silently reintroduce the split-brain roster.

ALTER TABLE public.project_team_members
  ADD COLUMN IF NOT EXISTS resource_id uuid NULL
  REFERENCES public.resources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_team_members_resource_id
  ON public.project_team_members (organization_id, project_id, resource_id)
  WHERE resource_id IS NOT NULL;

COMMENT ON COLUMN public.project_team_members.resource_id IS
  'Optional canonical link to a project-scoped person resource. Team & Roles remains the canonical roster.';

CREATE OR REPLACE FUNCTION public._ensure_person_resource_project_membership(
  p_resource_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resource public.resources%ROWTYPE;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN;
  END IF;

  -- Serialize concurrent task/resource writes for the same person resource.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_resource_id::text, 0));

  SELECT *
    INTO v_resource
    FROM public.resources
   WHERE id = p_resource_id
     AND resource_type = 'person'
     AND deleted_at IS NULL
     AND status = 'active';

  IF NOT FOUND OR v_resource.project_id IS NULL THEN
    RETURN;
  END IF;

  -- Already represented by the explicit resource identity: invariant satisfied.
  IF EXISTS (
    SELECT 1
      FROM public.project_team_members ptm
     WHERE ptm.organization_id = v_resource.organization_id
       AND ptm.project_id = v_resource.project_id
       AND ptm.resource_id = v_resource.id
       AND ptm.status <> 'removed'
  ) THEN
    RETURN;
  END IF;

  -- If the resource is linked to a login, attach that explicit identity to every
  -- active role row held by that same user. A person may legitimately hold more
  -- than one role, so resource_id is intentionally NOT unique across role rows.
  IF v_resource.linked_user_id IS NOT NULL THEN
    UPDATE public.project_team_members ptm
       SET resource_id = v_resource.id,
           display_name = COALESCE(ptm.display_name, v_resource.name),
           updated_at = now()
     WHERE ptm.organization_id = v_resource.organization_id
       AND ptm.project_id = v_resource.project_id
       AND ptm.user_id = v_resource.linked_user_id
       AND ptm.resource_id IS NULL
       AND ptm.status <> 'removed';

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Historical rows often have only display_name. The quick-add flow itself
  -- de-duplicates person resources by project + name, so an existing active exact
  -- name match already represents that person. Do not manufacture a duplicate.
  IF EXISTS (
    SELECT 1
      FROM public.project_team_members ptm
     WHERE ptm.organization_id = v_resource.organization_id
       AND ptm.project_id = v_resource.project_id
       AND ptm.status <> 'removed'
       AND lower(btrim(COALESCE(ptm.display_name, ''))) = lower(btrim(v_resource.name))
  ) THEN
    RETURN;
  END IF;

  -- No account/contact is required to be a real project participant. Keep the
  -- existing non-billable import semantics until/if the person receives a login.
  INSERT INTO public.project_team_members (
    organization_id,
    project_id,
    resource_id,
    user_id,
    member_type,
    display_name,
    permission_level,
    status
  ) VALUES (
    v_resource.organization_id,
    v_resource.project_id,
    v_resource.id,
    v_resource.linked_user_id,
    CASE WHEN v_resource.linked_user_id IS NULL THEN 'group_imported' ELSE 'internal_user' END,
    v_resource.name,
    'read_only',
    'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_person_resource_project_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ensure_person_resource_project_membership(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._ensure_person_resource_project_membership(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._ensure_person_resource_project_membership(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._sync_quick_add_person_resource_to_project_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.resource_type = 'person'
     AND NEW.deleted_at IS NULL
     AND NEW.status = 'active'
     AND COALESCE(NEW.metadata->>'origin', '') = 'task_form_quick_add'
  THEN
    PERFORM public._ensure_person_resource_project_membership(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_quick_add_person_resource_to_project_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_quick_add_person_resource_to_project_team() FROM anon;
REVOKE ALL ON FUNCTION public._sync_quick_add_person_resource_to_project_team() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_quick_add_person_resource_to_project_team ON public.resources;
CREATE TRIGGER trg_sync_quick_add_person_resource_to_project_team
AFTER INSERT OR UPDATE OF name, resource_type, status, deleted_at, project_id, organization_id, metadata, linked_user_id
ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public._sync_quick_add_person_resource_to_project_team();

CREATE OR REPLACE FUNCTION public._sync_task_person_resource_to_project_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_resource_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    PERFORM public._ensure_person_resource_project_membership(NEW.assigned_resource_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_task_person_resource_to_project_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_task_person_resource_to_project_team() FROM anon;
REVOKE ALL ON FUNCTION public._sync_task_person_resource_to_project_team() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_task_person_resource_to_project_team ON public.roadmap_tasks;
CREATE TRIGGER trg_sync_task_person_resource_to_project_team
AFTER INSERT OR UPDATE OF assigned_resource_id, deleted_at
ON public.roadmap_tasks
FOR EACH ROW
EXECUTE FUNCTION public._sync_task_person_resource_to_project_team();

-- Repair existing drift. Scope is deliberately evidence-based: quick-add people
-- and person resources that are actually assigned to a live task. Generic rate
-- cards or unassigned resource placeholders are not promoted into the roster.
DO $$
DECLARE
  v_resource_id uuid;
BEGIN
  FOR v_resource_id IN
    SELECT DISTINCT r.id
      FROM public.resources r
     WHERE r.resource_type = 'person'
       AND r.deleted_at IS NULL
       AND r.status = 'active'
       AND (
         COALESCE(r.metadata->>'origin', '') = 'task_form_quick_add'
         OR EXISTS (
           SELECT 1
             FROM public.roadmap_tasks t
            WHERE t.organization_id = r.organization_id
              AND t.project_id = r.project_id
              AND t.assigned_resource_id = r.id
              AND t.deleted_at IS NULL
         )
       )
  LOOP
    PERFORM public._ensure_person_resource_project_membership(v_resource_id);
  END LOOP;
END;
$$;
