-- ============================================================================
-- P2-T3 — Mining-ready event integrity: atomic generic process append
-- ============================================================================
-- Task, milestone and dependency capture already uses the single PEG gateway.
-- This wrapper moves sequence allocation, previous-hash lookup, event insert and
-- OCEL refs into the existing transactional helper so concurrent process writers
-- cannot fork the tamper-evident chain. It is additive and service-role only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._process_event_refs_ok(
  p_event jsonb,
  p_refs  jsonb
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(COALESCE(p_refs, '[]'::jsonb)) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_refs, '[]'::jsonb)) AS ref
      WHERE ref->>'object_type' = p_event->>'subject_type'
        AND ref->>'object_id' = p_event->>'subject_id'
        AND ref->>'role' = 'focal'
    )
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_refs, '[]'::jsonb)) AS ref
      WHERE ref->>'object_type' = 'project'
        AND ref->>'object_id' = p_event->>'project_id'
        AND ref->>'role' = 'context'
    )
    AND (
      p_event->>'event_category' <> 'dependency'
      OR (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(p_refs, '[]'::jsonb)) AS ref
          WHERE ref->>'object_type' = 'task'
            AND ref->>'role' = 'predecessor'
        )
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(p_refs, '[]'::jsonb)) AS ref
          WHERE ref->>'object_type' = 'dependency'
            AND ref->>'role' = 'relation'
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.append_process_event_atomic(
  p_event        jsonb,
  p_payload_text text,
  p_refs         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_project_ok boolean;
  v_subject_ok boolean;
  v_predecessor_ok boolean;
  v_predecessor_id uuid;
  v_relation_id uuid;
  v_allowed_types constant text[] := ARRAY[
    'TaskCreated', 'TaskAssigned', 'TaskUnassigned', 'TaskMoved',
    'TaskStartDateChanged', 'TaskDueDateChanged', 'TaskEstimateChanged',
    'TaskPriorityChanged', 'TaskStatusChanged', 'TaskPromptPrepared',
    'TaskAISubmitted', 'TaskStarted', 'TaskImplemented', 'TaskTested',
    'TaskCompleted', 'TaskDeferred', 'TaskReopened', 'TaskUnblocked',
    'TaskResumed', 'TaskBlocked', 'TaskDeleted',
    'TaskDependencyAdded', 'TaskDependencyRemoved',
    'MilestoneCreated', 'MilestoneUpdated', 'MilestoneStarted',
    'MilestoneAchieved', 'MilestoneBlocked', 'MilestoneDeferred',
    'MilestoneReopened', 'MilestoneDeleted'
  ];
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  IF p_event IS NULL
     OR p_event->>'organization_id' IS NULL
     OR p_event->>'project_id' IS NULL
     OR p_event->>'subject_id' IS NULL
     OR p_event->>'case_id' IS NULL
     OR p_event->>'event_type' IS NULL
     OR p_event->>'event_category' IS NULL
     OR p_event->>'subject_type' IS NULL THEN
    RAISE EXCEPTION 'invariant_missing_scope';
  END IF;

  IF COALESCE(p_event->>'actor_type', '') NOT IN ('human', 'system', 'ai', 'external')
     OR NULLIF(p_event->>'occurred_at', '') IS NULL
     OR NULLIF(p_event->>'source_module', '') IS NULL
     OR NULLIF(p_event->>'source_entity_type', '') IS NULL
     OR NULLIF(p_event->>'source_entity_id', '') IS NULL
     OR COALESCE(p_event->'provenance'->>'capture_method', '') NOT IN ('direct', 'mapped', 'derived', 'imported') THEN
    RAISE EXCEPTION 'invariant_traceability';
  END IF;

  IF p_payload_text IS NULL
     OR p_payload_text::jsonb IS DISTINCT FROM COALESCE(p_event->'payload', '{}'::jsonb) THEN
    RAISE EXCEPTION 'invariant_payload_mismatch';
  END IF;

  IF NOT COALESCE(p_event->>'event_type' = ANY (v_allowed_types), false) THEN
    RAISE EXCEPTION 'invariant_event_type';
  END IF;

  IF NOT COALESCE((
    (p_event->>'event_category' = 'task' AND p_event->>'subject_type' = 'task')
    OR (p_event->>'event_category' = 'milestone' AND p_event->>'subject_type' = 'milestone')
    OR (p_event->>'event_category' = 'dependency' AND p_event->>'subject_type' = 'task')
  ), false) THEN
    RAISE EXCEPTION 'invariant_process_semantics';
  END IF;

  -- Mining-ready case framing: one task case per task, one milestone case per
  -- milestone. Dependency changes belong to the successor task case.
  IF p_event->>'case_id' <> p_event->>'subject_id' THEN
    RAISE EXCEPTION 'invariant_case_scope';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = (p_event->>'project_id')::uuid
      AND p.organization_id = (p_event->>'organization_id')::uuid
      AND p.deleted_at IS NULL
  ) INTO v_project_ok;
  IF NOT v_project_ok THEN
    RAISE EXCEPTION 'invariant_project_not_in_scope';
  END IF;

  IF p_event->>'event_category' = 'milestone' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.milestones milestone
      WHERE milestone.id = (p_event->>'subject_id')::uuid
        AND milestone.organization_id = (p_event->>'organization_id')::uuid
        AND milestone.project_id = (p_event->>'project_id')::uuid
    ) INTO v_subject_ok;
    IF p_event->>'source_entity_type' <> 'milestones'
       OR p_event->>'source_entity_id' <> p_event->>'subject_id' THEN
      RAISE EXCEPTION 'invariant_source_entity';
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.roadmap_tasks task
      WHERE task.id = (p_event->>'subject_id')::uuid
        AND task.organization_id = (p_event->>'organization_id')::uuid
        AND task.project_id = (p_event->>'project_id')::uuid
    ) INTO v_subject_ok;
    IF p_event->>'event_category' = 'task'
       AND (p_event->>'source_entity_type' <> 'roadmap_tasks'
         OR p_event->>'source_entity_id' <> p_event->>'subject_id') THEN
      RAISE EXCEPTION 'invariant_source_entity';
    END IF;
  END IF;
  IF NOT v_subject_ok THEN
    RAISE EXCEPTION 'invariant_subject_not_in_scope';
  END IF;

  IF NOT public._process_event_refs_ok(p_event, p_refs) THEN
    RAISE EXCEPTION 'invariant_object_refs';
  END IF;

  IF p_event->>'event_category' = 'dependency' THEN
    SELECT (ref->>'object_id')::uuid
    INTO v_predecessor_id
    FROM jsonb_array_elements(p_refs) AS ref
    WHERE ref->>'object_type' = 'task' AND ref->>'role' = 'predecessor'
    LIMIT 1;
    SELECT (ref->>'object_id')::uuid
    INTO v_relation_id
    FROM jsonb_array_elements(p_refs) AS ref
    WHERE ref->>'object_type' = 'dependency' AND ref->>'role' = 'relation'
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM public.roadmap_tasks task
      WHERE task.id = v_predecessor_id
        AND task.organization_id = (p_event->>'organization_id')::uuid
        AND task.project_id = (p_event->>'project_id')::uuid
    ) INTO v_predecessor_ok;
    IF NOT v_predecessor_ok
       OR p_event->>'source_entity_type' <> 'task_dependencies'
       OR (p_event->>'source_entity_id')::uuid IS DISTINCT FROM v_relation_id
       OR (p_event->'payload'->>'dependency_id')::uuid IS DISTINCT FROM v_relation_id THEN
      RAISE EXCEPTION 'invariant_dependency_scope';
    END IF;

    -- Removed relationships no longer have a source row by definition. Added
    -- relationships must still match the canonical edge at append time.
    IF p_event->>'event_type' = 'TaskDependencyAdded' AND NOT EXISTS (
      SELECT 1
      FROM public.task_dependencies dependency
      WHERE dependency.id = v_relation_id
        AND dependency.organization_id = (p_event->>'organization_id')::uuid
        AND dependency.project_id = (p_event->>'project_id')::uuid
        AND dependency.predecessor_id = v_predecessor_id
        AND dependency.successor_id = (p_event->>'subject_id')::uuid
    ) THEN
      RAISE EXCEPTION 'invariant_dependency_not_in_scope';
    END IF;
  END IF;

  RETURN public._append_event_atomic(
    p_event,
    p_payload_text,
    p_refs,
    v_allowed_types,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public._process_event_refs_ok(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._process_event_refs_ok(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._process_event_refs_ok(jsonb, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public._process_event_refs_ok(jsonb, jsonb) FROM service_role;

REVOKE ALL ON FUNCTION public.append_process_event_atomic(jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_process_event_atomic(jsonb, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.append_process_event_atomic(jsonb, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.append_process_event_atomic(jsonb, text, jsonb) TO service_role;

COMMENT ON FUNCTION public._process_event_refs_ok IS
  'P2-T3 structural OCEL guard for mining-ready task/milestone/dependency events. Internal helper; no client grants.';
COMMENT ON FUNCTION public.append_process_event_atomic IS
  'P2-T3 service-role-only atomic append for mining-ready task, milestone and dependency facts. Enforces traceability, payload parity, project and focal-entity scope, case framing, event allowlist and focal/project/dependency object refs before delegating to _append_event_atomic.';
