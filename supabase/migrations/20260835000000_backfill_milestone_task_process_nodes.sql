-- ============================================================================
-- Backfill Living Graph projection nodes for milestones/tasks created without one
-- Bug: LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION
-- ============================================================================
-- The classic Living Graph / Project Execution Map derives its milestone and
-- task nodes exclusively from process_nodes (source_entity_type in
-- ('milestones','roadmap_tasks'), node_type in ('milestone_gate',
-- 'task_transition')). createMilestoneAction / createTaskAction historically did
-- NOT emit those nodes on creation (a task node only appeared once its status
-- changed), so entities created and left untouched were invisible in the graph
-- even though they exist in Roadmap/Tasks.
--
-- The code fix (roadmap/actions.ts) now emits the node on creation via the
-- approved emit-event path. This migration backfills the entities that predate
-- the fix so they appear immediately. It is IDEMPOTENT (only inserts where no
-- live node already exists) and matches the shape emitProcessNode produces.
-- It never updates/deletes existing process_nodes rows; it never touches
-- canonical truth (milestones/roadmap_tasks) or project_event_log.
-- ============================================================================

-- Milestones → milestone_gate nodes (skip soft-deleted milestones).
insert into public.process_nodes
  (organization_id, project_id, node_type, source_entity_type, source_entity_id, title, metadata, occurred_at)
select
  m.organization_id,
  m.project_id,
  'milestone_gate',
  'milestones',
  m.id,
  coalesce(nullif(m.title, ''), 'Milestone'),
  jsonb_build_object('status', m.status, 'progress', m.progress_percent, 'backfilled', true),
  coalesce(m.created_at, now())
from public.milestones m
where m.deleted_at is null
  and not exists (
    select 1 from public.process_nodes pn
    where pn.project_id = m.project_id
      and pn.source_entity_type = 'milestones'
      and pn.source_entity_id = m.id
      and pn.node_type = 'milestone_gate'
      and pn.deleted_at is null
  );

-- Roadmap tasks → task_transition nodes (skip soft-deleted tasks).
insert into public.process_nodes
  (organization_id, project_id, node_type, source_entity_type, source_entity_id, title, metadata, occurred_at)
select
  t.organization_id,
  t.project_id,
  'task_transition',
  'roadmap_tasks',
  t.id,
  coalesce(nullif(t.title, ''), 'Task'),
  jsonb_build_object('status', t.status, 'backfilled', true),
  coalesce(t.created_at, now())
from public.roadmap_tasks t
where t.deleted_at is null
  and not exists (
    select 1 from public.process_nodes pn
    where pn.project_id = t.project_id
      and pn.source_entity_type = 'roadmap_tasks'
      and pn.source_entity_id = t.id
      and pn.node_type = 'task_transition'
      and pn.deleted_at is null
  );
