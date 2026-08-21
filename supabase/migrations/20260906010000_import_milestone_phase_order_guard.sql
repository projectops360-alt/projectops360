-- Prevent imported milestone graphs from appending synthetic phase milestones
-- after explicit deliverables. This preserves REG-026 source ordering for normal
-- imports and only intervenes when the importer actually created phase milestones
-- from task.phase values.

create or replace function public.reindex_imported_milestones_phase_aware(p_job_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_import_mode text;
  v_has_task_phases boolean;
  v_has_synthetic_phase_milestones boolean;
begin
  select j.project_id, j.import_mode
    into v_project_id, v_import_mode
  from public.project_import_jobs j
  where j.id = p_job_id
    and j.deleted_at is null;

  if v_project_id is null or v_import_mode <> 'create_new' then
    return;
  end if;

  select exists (
    select 1
    from public.project_import_entities e
    where e.import_job_id = p_job_id
      and e.entity_type = 'task'
      and e.will_import = true
      and coalesce(e.validation_status, '') <> 'invalid'
      and nullif(btrim(e.normalized_json ->> 'phase'), '') is not null
  ) into v_has_task_phases;

  if not v_has_task_phases then
    return;
  end if;

  -- Only activate the guard when a milestone was synthesized from task.phase
  -- and was not itself an explicit milestone entity. Ordinary milestone-only
  -- imports keep their canonical source_order untouched (REG-026).
  with explicit_milestones as (
    select lower(btrim(e.normalized_json ->> 'name')) as title_key
    from public.project_import_entities e
    where e.import_job_id = p_job_id
      and e.entity_type = 'milestone'
      and e.will_import = true
      and coalesce(e.validation_status, '') <> 'invalid'
  ), task_phases as (
    select distinct lower(btrim(e.normalized_json ->> 'phase')) as phase_key
    from public.project_import_entities e
    where e.import_job_id = p_job_id
      and e.entity_type = 'task'
      and e.will_import = true
      and coalesce(e.validation_status, '') <> 'invalid'
      and nullif(btrim(e.normalized_json ->> 'phase'), '') is not null
  )
  select exists (
    select 1
    from public.milestones m
    join task_phases p
      on lower(btrim(m.title)) = p.phase_key
    left join explicit_milestones em
      on em.title_key = lower(btrim(m.title))
    where m.project_id = v_project_id
      and m.deleted_at is null
      and em.title_key is null
  ) into v_has_synthetic_phase_milestones;

  if not v_has_synthetic_phase_milestones then
    return;
  end if;

  create temporary table if not exists pg_temp.import_milestone_reindex (
    milestone_id uuid primary key,
    new_order integer not null
  ) on commit drop;
  truncate table pg_temp.import_milestone_reindex;

  insert into pg_temp.import_milestone_reindex (milestone_id, new_order)
  with task_phase_order as (
    select
      lower(btrim(e.normalized_json ->> 'phase')) as phase_key,
      min(e.source_order) as first_source_order
    from public.project_import_entities e
    where e.import_job_id = p_job_id
      and e.entity_type = 'task'
      and e.will_import = true
      and coalesce(e.validation_status, '') <> 'invalid'
      and nullif(btrim(e.normalized_json ->> 'phase'), '') is not null
    group by lower(btrim(e.normalized_json ->> 'phase'))
  ), explicit_milestones as (
    select
      lower(btrim(e.normalized_json ->> 'name')) as title_key,
      nullif(lower(btrim(e.normalized_json ->> 'phase')), '') as phase_key,
      e.source_order as explicit_source_order
    from public.project_import_entities e
    where e.import_job_id = p_job_id
      and e.entity_type = 'milestone'
      and e.will_import = true
      and coalesce(e.validation_status, '') <> 'invalid'
  ), task_refs as (
    select
      lower(btrim(coalesce(
        nullif(e.normalized_json ->> 'milestone', ''),
        nullif(e.normalized_json ->> 'phase', '')
      ))) as ref_key,
      nullif(lower(btrim(e.normalized_json ->> 'phase')), '') as phase_key,
      min(e.source_order) as first_source_order
    from public.project_import_entities e
    where e.import_job_id = p_job_id
      and e.entity_type = 'task'
      and e.will_import = true
      and coalesce(e.validation_status, '') <> 'invalid'
      and coalesce(
        nullif(btrim(e.normalized_json ->> 'milestone'), ''),
        nullif(btrim(e.normalized_json ->> 'phase'), '')
      ) is not null
    group by 1, 2
  ), scored as (
    select
      m.id as milestone_id,
      case
        -- Synthetic phase node comes first in its phase.
        when phase_self.phase_key is not null and explicit_self.title_key is null then
          phase_self.first_source_order::bigint * 1000000
        -- Explicit deliverables/gates are grouped immediately after their phase.
        when explicit_self.title_key is not null and explicit_phase.phase_key is not null then
          explicit_phase.first_source_order::bigint * 1000000
          + 100000
          + coalesce(explicit_self.explicit_source_order, 0)
        -- A task-referenced milestone that is not an explicit entity stays near
        -- the phase where it first appears.
        when task_ref.ref_key is not null and task_ref_phase.phase_key is not null then
          task_ref_phase.first_source_order::bigint * 1000000
          + 50000
          + coalesce(task_ref.first_source_order, 0)
        -- Explicit milestones without a phase retain their canonical source order
        -- after all phase-grouped milestones.
        when explicit_self.title_key is not null then
          900000000000::bigint + coalesce(explicit_self.explicit_source_order, 0)
        -- Any pre-existing/unclassified milestone remains last and stable.
        else
          950000000000::bigint + coalesce(m.order_index, 0)
      end as sort_key
    from public.milestones m
    left join task_phase_order phase_self
      on phase_self.phase_key = lower(btrim(m.title))
    left join explicit_milestones explicit_self
      on explicit_self.title_key = lower(btrim(m.title))
    left join task_phase_order explicit_phase
      on explicit_phase.phase_key = explicit_self.phase_key
    left join task_refs task_ref
      on task_ref.ref_key = lower(btrim(m.title))
    left join task_phase_order task_ref_phase
      on task_ref_phase.phase_key = task_ref.phase_key
    where m.project_id = v_project_id
      and m.deleted_at is null
  ), ranked as (
    select
      milestone_id,
      row_number() over (order by sort_key, milestone_id) - 1 as new_order
    from scored
  )
  select milestone_id, new_order::integer
  from ranked;

  -- Move away from the final ordinal range first so a uniqueness guard on
  -- (project_id, order_index) cannot collide during the repair.
  update public.milestones m
     set order_index = m.order_index + 1000000
   where m.project_id = v_project_id
     and m.deleted_at is null;

  update public.milestones m
     set order_index = r.new_order
    from pg_temp.import_milestone_reindex r
   where m.id = r.milestone_id;
end;
$$;

create or replace function public.trg_project_import_phase_aware_milestone_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'imported'
     and old.status is distinct from new.status then
    perform public.reindex_imported_milestones_phase_aware(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_import_phase_aware_milestone_order
  on public.project_import_jobs;

create trigger trg_project_import_phase_aware_milestone_order
after update of status on public.project_import_jobs
for each row
execute function public.trg_project_import_phase_aware_milestone_order();

revoke all on function public.reindex_imported_milestones_phase_aware(uuid) from public, anon, authenticated;
revoke all on function public.trg_project_import_phase_aware_milestone_order() from public, anon, authenticated;

comment on function public.reindex_imported_milestones_phase_aware(uuid) is
  'Reindexes milestones after create-new imports only when task.phase caused synthetic phase milestones. Phase nodes precede explicit deliverables in the same phase; ordinary REG-026 source ordering is untouched.';
