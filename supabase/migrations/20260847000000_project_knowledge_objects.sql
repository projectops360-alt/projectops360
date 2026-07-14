create extension if not exists pgcrypto;

create table public.project_knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  knowledge_type text not null check (knowledge_type in ('finding','pattern','best_practice','lesson_learned','recommendation','prediction','root_cause')),
  current_status text not null default 'proposed' check (current_status in ('proposed','validated','active')),
  current_version_no integer not null default 1 check (current_version_no > 0),
  active_version_no integer,
  idempotency_key text not null,
  creation_fingerprint text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, idempotency_key),
  unique (id, organization_id, project_id),
  unique (id, current_version_no),
  unique (id, active_version_no)
);

create table public.project_knowledge_object_versions (
  knowledge_object_id uuid not null,
  organization_id uuid not null,
  project_id uuid not null,
  version_no integer not null check (version_no > 0),
  title text not null check (length(btrim(title)) > 0),
  summary text not null check (length(btrim(summary)) > 0),
  body text not null check (length(btrim(body)) > 0),
  structured_content jsonb not null default '{}'::jsonb,
  confidence text not null check (confidence in ('high','medium','low','unknown')),
  confidence_reason text not null check (length(btrim(confidence_reason)) > 0),
  provenance jsonb not null,
  content_hash text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (knowledge_object_id, version_no),
  foreign key (knowledge_object_id, organization_id, project_id)
    references public.project_knowledge_objects(id, organization_id, project_id) on delete cascade,
  unique (knowledge_object_id, content_hash)
);

alter table public.project_knowledge_objects
  add constraint project_knowledge_current_version_fk
  foreign key (id, current_version_no)
  references public.project_knowledge_object_versions(knowledge_object_id, version_no)
  deferrable initially deferred,
  add constraint project_knowledge_active_version_fk
  foreign key (id, active_version_no)
  references public.project_knowledge_object_versions(knowledge_object_id, version_no)
  deferrable initially deferred;

create table public.project_knowledge_object_evidence (
  id uuid primary key default gen_random_uuid(),
  knowledge_object_id uuid not null,
  organization_id uuid not null,
  project_id uuid not null,
  version_no integer not null,
  evidence_type text not null check (evidence_type in ('project_event','project_object','document','metric','engine_finding','external_reference')),
  evidence_ref text not null check (length(btrim(evidence_ref)) > 0),
  role text not null check (role in ('supports','contradicts','context')),
  confidence text not null check (confidence in ('high','medium','low','unknown')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (knowledge_object_id, version_no)
    references public.project_knowledge_object_versions(knowledge_object_id, version_no) on delete cascade,
  foreign key (knowledge_object_id, organization_id, project_id)
    references public.project_knowledge_objects(id, organization_id, project_id) on delete cascade,
  unique (knowledge_object_id, version_no, evidence_type, evidence_ref, role)
);

create table public.project_knowledge_object_transitions (
  id uuid primary key default gen_random_uuid(),
  knowledge_object_id uuid not null,
  organization_id uuid not null,
  project_id uuid not null,
  version_no integer not null,
  from_status text check (from_status in ('proposed','validated','active')),
  to_status text not null check (to_status in ('proposed','validated','active')),
  actor_id uuid not null references auth.users(id),
  rationale text not null check (length(btrim(rationale)) > 0),
  created_at timestamptz not null default now(),
  foreign key (knowledge_object_id, version_no)
    references public.project_knowledge_object_versions(knowledge_object_id, version_no) on delete cascade,
  foreign key (knowledge_object_id, organization_id, project_id)
    references public.project_knowledge_objects(id, organization_id, project_id) on delete cascade,
  unique (knowledge_object_id, version_no, to_status)
);

create index project_knowledge_objects_scope_idx on public.project_knowledge_objects(organization_id, project_id, current_status, updated_at desc);
create index project_knowledge_evidence_scope_idx on public.project_knowledge_object_evidence(organization_id, project_id, knowledge_object_id, version_no);
create index project_knowledge_transitions_scope_idx on public.project_knowledge_object_transitions(organization_id, project_id, knowledge_object_id, created_at);

create or replace function public.project_knowledge_actor_role(p_organization_id uuid, p_actor_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select om.role from public.organization_members om
  where om.organization_id = p_organization_id and om.user_id = p_actor_id
  limit 1
$$;

revoke all on function public.project_knowledge_actor_role(uuid, uuid) from public, anon, authenticated;

create or replace function public.project_knowledge_assert_input(p_input jsonb)
returns void language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if nullif(btrim(p_input->>'title'), '') is null
    or nullif(btrim(p_input->>'summary'), '') is null
    or nullif(btrim(p_input->>'body'), '') is null
    or nullif(btrim(p_input->>'confidence_reason'), '') is null
    or nullif(btrim(p_input->>'proposal_rationale'), '') is null then
    raise exception 'knowledge_input_required_fields_missing';
  end if;
  if coalesce(p_input->>'confidence', '') not in ('high','medium','low','unknown') then
    raise exception 'knowledge_input_invalid_confidence';
  end if;
  if jsonb_typeof(p_input->'provenance') <> 'object'
    or nullif(btrim(p_input->'provenance'->>'capture_method'), '') is null
    or nullif(btrim(p_input->'provenance'->>'source_kind'), '') is null
    or nullif(btrim(p_input->'provenance'->>'source_ref'), '') is null then
    raise exception 'knowledge_input_invalid_provenance';
  end if;
  if jsonb_typeof(p_input->'evidence') <> 'array' or jsonb_array_length(p_input->'evidence') = 0 then
    raise exception 'knowledge_input_evidence_required';
  end if;
end
$$;

create or replace function public.project_knowledge_insert_evidence(
  p_object_id uuid, p_organization_id uuid, p_project_id uuid, p_version_no integer, p_actor_id uuid, p_evidence jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(p_evidence) loop
    if coalesce(item->>'evidence_type','') not in ('project_event','project_object','document','metric','engine_finding','external_reference')
      or coalesce(item->>'role','') not in ('supports','contradicts','context')
      or coalesce(item->>'confidence','') not in ('high','medium','low','unknown')
      or nullif(btrim(item->>'evidence_ref'),'') is null then
      raise exception 'knowledge_input_invalid_evidence';
    end if;
    if item->>'evidence_type' = 'project_event' and not exists (
      select 1 from public.project_event_log e
      where e.id = (item->>'evidence_ref')::uuid and e.organization_id = p_organization_id and e.project_id = p_project_id
    ) then
      raise exception 'knowledge_project_event_out_of_scope';
    end if;
    insert into public.project_knowledge_object_evidence(
      knowledge_object_id, organization_id, project_id, version_no, evidence_type, evidence_ref, role, confidence, note, metadata, created_by
    ) values (
      p_object_id, p_organization_id, p_project_id, p_version_no, item->>'evidence_type', item->>'evidence_ref', item->>'role',
      item->>'confidence', item->>'note', coalesce(item->'metadata','{}'::jsonb), p_actor_id
    );
  end loop;
end
$$;

create or replace function public.create_project_knowledge_object(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  object_id uuid := gen_random_uuid(); org_id uuid := (p_input->>'organization_id')::uuid;
  input_project_id uuid := (p_input->>'project_id')::uuid; actor_id uuid := (p_input->>'actor_id')::uuid;
  fingerprint text := encode(digest((p_input - 'actor_id')::text, 'sha256'), 'hex'); existing public.project_knowledge_objects%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'knowledge_service_role_required'; end if;
  perform public.project_knowledge_assert_input(p_input);
  if coalesce(p_input->>'knowledge_type','') not in ('finding','pattern','best_practice','lesson_learned','recommendation','prediction','root_cause') then
    raise exception 'knowledge_input_invalid_type';
  end if;
  if nullif(btrim(p_input->>'idempotency_key'),'') is null then raise exception 'knowledge_idempotency_key_required'; end if;
  if not exists (select 1 from public.projects p where p.id = input_project_id and p.organization_id = org_id and p.deleted_at is null) then
    raise exception 'knowledge_project_out_of_scope';
  end if;
  if coalesce(public.project_knowledge_actor_role(org_id, actor_id),'') not in ('owner','admin','member') then
    raise exception 'knowledge_action_forbidden';
  end if;
  select * into existing from public.project_knowledge_objects
    where project_knowledge_objects.project_id = input_project_id
      and idempotency_key = p_input->>'idempotency_key';
  if found then
    if existing.creation_fingerprint <> fingerprint then raise exception 'knowledge_idempotency_conflict'; end if;
    return jsonb_build_object('knowledge_object_id', existing.id, 'version_no', existing.current_version_no, 'status', existing.current_status, 'deduped', true);
  end if;
  insert into public.project_knowledge_objects(id, organization_id, project_id, knowledge_type, idempotency_key, creation_fingerprint, created_by)
  values(object_id, org_id, input_project_id, p_input->>'knowledge_type', p_input->>'idempotency_key', fingerprint, actor_id);
  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, project_id, version_no, title, summary, body, structured_content, confidence, confidence_reason, provenance, content_hash, created_by
  ) values (
    object_id, org_id, input_project_id, 1, p_input->>'title', p_input->>'summary', p_input->>'body', coalesce(p_input->'structured_content','{}'::jsonb),
    p_input->>'confidence', p_input->>'confidence_reason', p_input->'provenance', fingerprint, actor_id
  );
  perform public.project_knowledge_insert_evidence(object_id, org_id, input_project_id, 1, actor_id, p_input->'evidence');
  insert into public.project_knowledge_object_transitions(knowledge_object_id, organization_id, project_id, version_no, from_status, to_status, actor_id, rationale)
  values(object_id, org_id, input_project_id, 1, null, 'proposed', actor_id, p_input->>'proposal_rationale');
  return jsonb_build_object('knowledge_object_id', object_id, 'version_no', 1, 'status', 'proposed', 'deduped', false);
end
$$;

create or replace function public.revise_project_knowledge_object(p_knowledge_object_id uuid, p_expected_version_no integer, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_id uuid := (p_input->>'actor_id')::uuid; object_row public.project_knowledge_objects%rowtype;
  next_version integer; matched_version integer; fingerprint text := encode(digest((p_input - 'actor_id')::text, 'sha256'), 'hex');
begin
  if auth.role() <> 'service_role' then raise exception 'knowledge_service_role_required'; end if;
  perform public.project_knowledge_assert_input(p_input);
  select * into object_row from public.project_knowledge_objects where id = p_knowledge_object_id for update;
  if not found then raise exception 'knowledge_object_not_found'; end if;
  if coalesce(public.project_knowledge_actor_role(object_row.organization_id, actor_id),'') not in ('owner','admin','member') then
    raise exception 'knowledge_action_forbidden';
  end if;
  select version_no into matched_version from public.project_knowledge_object_versions
    where knowledge_object_id = p_knowledge_object_id and content_hash = fingerprint;
  if matched_version = object_row.current_version_no and matched_version = p_expected_version_no + 1 then
    return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', matched_version, 'status', object_row.current_status, 'deduped', true);
  end if;
  if object_row.current_version_no <> p_expected_version_no then raise exception 'knowledge_version_conflict'; end if;
  next_version := object_row.current_version_no + 1;
  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, project_id, version_no, title, summary, body, structured_content, confidence, confidence_reason, provenance, content_hash, created_by
  ) values (
    object_row.id, object_row.organization_id, object_row.project_id, next_version, p_input->>'title', p_input->>'summary', p_input->>'body',
    coalesce(p_input->'structured_content','{}'::jsonb), p_input->>'confidence', p_input->>'confidence_reason', p_input->'provenance', fingerprint, actor_id
  );
  perform public.project_knowledge_insert_evidence(object_row.id, object_row.organization_id, object_row.project_id, next_version, actor_id, p_input->'evidence');
  insert into public.project_knowledge_object_transitions(knowledge_object_id, organization_id, project_id, version_no, from_status, to_status, actor_id, rationale)
  values(object_row.id, object_row.organization_id, object_row.project_id, next_version, null, 'proposed', actor_id, p_input->>'proposal_rationale');
  update public.project_knowledge_objects set current_version_no = next_version, current_status = 'proposed', updated_at = now() where id = object_row.id;
  return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', next_version, 'status', 'proposed', 'deduped', false);
end
$$;

create or replace function public.transition_project_knowledge_object(
  p_knowledge_object_id uuid, p_expected_version_no integer, p_target_status text, p_actor_id uuid, p_rationale text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare object_row public.project_knowledge_objects%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'knowledge_service_role_required'; end if;
  select * into object_row from public.project_knowledge_objects where id = p_knowledge_object_id for update;
  if not found then raise exception 'knowledge_object_not_found'; end if;
  if coalesce(public.project_knowledge_actor_role(object_row.organization_id, p_actor_id),'') not in ('owner','admin') then
    raise exception 'knowledge_action_forbidden';
  end if;
  if object_row.current_version_no <> p_expected_version_no then raise exception 'knowledge_version_conflict'; end if;
  if object_row.current_status = p_target_status and exists (
    select 1 from public.project_knowledge_object_transitions t where t.knowledge_object_id = object_row.id
      and t.version_no = object_row.current_version_no and t.to_status = p_target_status
  ) then
    return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', object_row.current_version_no, 'status', p_target_status, 'deduped', true);
  end if;
  if not ((object_row.current_status = 'proposed' and p_target_status = 'validated') or (object_row.current_status = 'validated' and p_target_status = 'active')) then
    raise exception 'knowledge_invalid_transition';
  end if;
  if not exists (
    select 1 from public.project_knowledge_object_versions v
    join public.project_knowledge_object_evidence e on e.knowledge_object_id = v.knowledge_object_id and e.version_no = v.version_no
    where v.knowledge_object_id = object_row.id and v.version_no = object_row.current_version_no
      and v.confidence <> 'unknown' and e.role = 'supports' and e.confidence <> 'unknown'
  ) then raise exception 'knowledge_insufficient_evidence'; end if;
  insert into public.project_knowledge_object_transitions(knowledge_object_id, organization_id, project_id, version_no, from_status, to_status, actor_id, rationale)
  values(object_row.id, object_row.organization_id, object_row.project_id, object_row.current_version_no, object_row.current_status, p_target_status, p_actor_id, p_rationale);
  update public.project_knowledge_objects set current_status = p_target_status,
    active_version_no = case when p_target_status = 'active' then current_version_no else active_version_no end, updated_at = now()
  where id = object_row.id;
  return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', object_row.current_version_no, 'status', p_target_status, 'deduped', false);
end
$$;

create or replace view public.project_knowledge_object_current with (security_invoker = true) as
select o.id, o.organization_id, o.project_id, o.knowledge_type, o.current_status, o.current_version_no, o.active_version_no,
  v.title, v.summary, v.body, v.structured_content, v.confidence, v.confidence_reason, v.provenance,
  (select count(*)::integer from public.project_knowledge_object_evidence e where e.knowledge_object_id = o.id and e.version_no = o.current_version_no) as evidence_count,
  o.created_by, o.created_at, o.updated_at
from public.project_knowledge_objects o
join public.project_knowledge_object_versions v on v.knowledge_object_id = o.id and v.version_no = o.current_version_no;

alter table public.project_knowledge_objects enable row level security;
alter table public.project_knowledge_object_versions enable row level security;
alter table public.project_knowledge_object_evidence enable row level security;
alter table public.project_knowledge_object_transitions enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['project_knowledge_objects','project_knowledge_object_versions','project_knowledge_object_evidence','project_knowledge_object_transitions'] loop
    execute format('create policy "Members read %1$s" on public.%1$I for select using (public.is_org_member(organization_id))', table_name);
    execute format('create policy "Service role %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', table_name);
    execute format('revoke insert, update, delete on public.%1$I from anon, authenticated', table_name);
  end loop;
end $$;

grant select on public.project_knowledge_objects, public.project_knowledge_object_versions, public.project_knowledge_object_evidence,
  public.project_knowledge_object_transitions, public.project_knowledge_object_current to authenticated;
revoke all on function public.project_knowledge_assert_input(jsonb) from public, anon, authenticated;
revoke all on function public.project_knowledge_insert_evidence(uuid,uuid,uuid,integer,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.create_project_knowledge_object(jsonb) from public, anon, authenticated;
revoke all on function public.revise_project_knowledge_object(uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.transition_project_knowledge_object(uuid,integer,text,uuid,text) from public, anon, authenticated;
grant execute on function public.create_project_knowledge_object(jsonb) to service_role;
grant execute on function public.revise_project_knowledge_object(uuid,integer,jsonb) to service_role;
grant execute on function public.transition_project_knowledge_object(uuid,integer,text,uuid,text) to service_role;
