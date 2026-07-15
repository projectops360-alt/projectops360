-- Phase 5: governed organizational learning and human-approved decision intelligence.
-- Additive only: public.decisions remains the canonical decision source of truth.

create table public.organizational_learnings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  learning_key text not null,
  stage text not null check (stage in ('finding','pattern','repeated_evidence','validated_learning','practice','retired')),
  confidence text not null check (confidence in ('high','medium','low','insufficient')),
  assessment_version text not null default '1.0.0',
  assessment jsonb not null,
  source_project_ids uuid[] not null default '{}',
  source_knowledge_object_ids uuid[] not null default '{}',
  evidence_refs text[] not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, learning_key),
  check (cardinality(evidence_refs) > 0),
  check (stage not in ('validated_learning','practice') or confidence in ('high','medium'))
);

create table public.organizational_learning_transitions (
  id uuid primary key default gen_random_uuid(),
  learning_id uuid not null references public.organizational_learnings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_stage text,
  to_stage text not null check (to_stage in ('finding','pattern','repeated_evidence','validated_learning','practice','retired')),
  actor_id uuid not null references auth.users(id),
  actor_type text not null default 'human' check (actor_type = 'human'),
  rationale text not null check (length(btrim(rationale)) > 0),
  assessment_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index organizational_learnings_scope_idx
  on public.organizational_learnings(organization_id, stage, updated_at desc);
create index organizational_learning_transitions_trace_idx
  on public.organizational_learning_transitions(learning_id, created_at);

alter table public.decisions
  add column if not exists intelligence_proposal jsonb,
  add column if not exists proposal_fingerprint text,
  add column if not exists human_approval_required boolean not null default false,
  add column if not exists auto_executable boolean not null default false,
  add column if not exists source_recommendation_id text,
  add column if not exists source_learning_refs text[] not null default '{}',
  add column if not exists evidence_refs text[] not null default '{}',
  add column if not exists selected_alternative_id text;

alter table public.decisions
  add constraint decisions_intelligence_never_auto_execute
  check (not (human_approval_required and auto_executable)),
  add constraint decisions_intelligence_source_required
  check (intelligence_proposal is null or (
    human_approval_required
    and not auto_executable
    and source_recommendation_id is not null
    and proposal_fingerprint is not null
    and cardinality(evidence_refs) > 0
  ));

create table public.decision_intelligence_reviews (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  proposal_id text not null,
  proposal_fingerprint text not null,
  from_status text not null check (from_status = 'proposed'),
  to_status text not null check (to_status in ('accepted','rejected','deferred')),
  actor_id uuid not null references auth.users(id),
  actor_type text not null default 'human' check (actor_type = 'human'),
  rationale text not null check (length(btrim(rationale)) > 0),
  selected_alternative_id text,
  source_recommendation_id text not null,
  source_learning_refs text[] not null default '{}',
  evidence_refs text[] not null,
  proposal_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (decision_id),
  check (cardinality(evidence_refs) > 0),
  check (to_status <> 'accepted' or selected_alternative_id is not null)
);

create index decision_intelligence_reviews_scope_idx
  on public.decision_intelligence_reviews(organization_id, project_id, created_at desc);

create or replace function public.reject_governance_trace_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'governance_trace_is_append_only';
end
$$;

create trigger organizational_learning_transitions_no_update
  before update on public.organizational_learning_transitions
  for each row execute function public.reject_governance_trace_mutation();
create trigger organizational_learning_transitions_no_delete
  before delete on public.organizational_learning_transitions
  for each row execute function public.reject_governance_trace_mutation();
create trigger decision_intelligence_reviews_no_update
  before update on public.decision_intelligence_reviews
  for each row execute function public.reject_governance_trace_mutation();
create trigger decision_intelligence_reviews_no_delete
  before delete on public.decision_intelligence_reviews
  for each row execute function public.reject_governance_trace_mutation();

alter table public.organizational_learnings enable row level security;
alter table public.organizational_learning_transitions enable row level security;
alter table public.decision_intelligence_reviews enable row level security;

create policy "Organization members read organizational learnings"
  on public.organizational_learnings for select
  using (public.is_org_member(organization_id));
create policy "Organization members read learning transitions"
  on public.organizational_learning_transitions for select
  using (public.is_org_member(organization_id));
create policy "Organization members read decision reviews"
  on public.decision_intelligence_reviews for select
  using (public.is_org_member(organization_id));

create or replace function public.transition_organizational_learning(
  p_learning_id uuid,
  p_target_stage text,
  p_actor_id uuid,
  p_rationale text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare learning_row public.organizational_learnings%rowtype; actor_role text;
begin
  if auth.role() <> 'service_role' then raise exception 'learning_service_role_required'; end if;
  select * into learning_row from public.organizational_learnings where id = p_learning_id for update;
  if not found then raise exception 'learning_not_found'; end if;
  actor_role := public.project_knowledge_actor_role(learning_row.organization_id, p_actor_id);
  if actor_role not in ('owner','admin') then raise exception 'learning_human_approval_required'; end if;
  if nullif(btrim(p_rationale),'') is null then raise exception 'learning_rationale_required'; end if;
  if not (
    (learning_row.stage = 'repeated_evidence' and p_target_stage = 'validated_learning')
    or (learning_row.stage = 'validated_learning' and p_target_stage = 'practice')
    or (learning_row.stage <> 'retired' and p_target_stage = 'retired')
  ) then raise exception 'learning_invalid_transition'; end if;
  if p_target_stage in ('validated_learning','practice') and (
    learning_row.confidence not in ('high','medium')
    or cardinality(learning_row.source_project_ids) < 2
    or cardinality(learning_row.evidence_refs) = 0
  ) then raise exception 'learning_insufficient_reliable_history'; end if;
  insert into public.organizational_learning_transitions(
    learning_id, organization_id, from_stage, to_stage, actor_id, rationale, assessment_snapshot
  ) values (
    learning_row.id, learning_row.organization_id, learning_row.stage, p_target_stage,
    p_actor_id, p_rationale, learning_row.assessment
  );
  update public.organizational_learnings set stage = p_target_stage, updated_at = now() where id = learning_row.id;
  return jsonb_build_object('learning_id', learning_row.id, 'stage', p_target_stage, 'approved_by', p_actor_id);
end
$$;

create or replace function public.review_decision_intelligence(
  p_decision_id uuid,
  p_target_status text,
  p_actor_id uuid,
  p_rationale text,
  p_selected_alternative_id text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare decision_row public.decisions%rowtype; actor_role text; proposal_id text;
begin
  if auth.role() <> 'service_role' then raise exception 'decision_service_role_required'; end if;
  select * into decision_row from public.decisions where id = p_decision_id and deleted_at is null for update;
  if not found then raise exception 'decision_not_found'; end if;
  actor_role := public.project_knowledge_actor_role(decision_row.organization_id, p_actor_id);
  if actor_role not in ('owner','admin') then raise exception 'decision_human_approval_required'; end if;
  if decision_row.status <> 'proposed' or p_target_status not in ('accepted','rejected','deferred') then
    raise exception 'decision_invalid_transition';
  end if;
  if decision_row.intelligence_proposal is null or not decision_row.human_approval_required
    or decision_row.auto_executable or cardinality(decision_row.evidence_refs) = 0 then
    raise exception 'decision_invalid_intelligence_proposal';
  end if;
  if nullif(btrim(p_rationale),'') is null then raise exception 'decision_rationale_required'; end if;
  if p_target_status = 'accepted' and nullif(btrim(p_selected_alternative_id),'') is null then
    raise exception 'decision_selected_alternative_required';
  end if;
  if p_selected_alternative_id is not null and not exists (
    select 1 from jsonb_array_elements(decision_row.intelligence_proposal->'alternatives') alternative
    where alternative->>'id' = p_selected_alternative_id
  ) then raise exception 'decision_selected_alternative_invalid'; end if;
  proposal_id := decision_row.intelligence_proposal->>'id';
  insert into public.decision_intelligence_reviews(
    decision_id, organization_id, project_id, proposal_id, proposal_fingerprint,
    from_status, to_status, actor_id, rationale, selected_alternative_id,
    source_recommendation_id, source_learning_refs, evidence_refs, proposal_snapshot
  ) values (
    decision_row.id, decision_row.organization_id, decision_row.project_id, proposal_id,
    decision_row.proposal_fingerprint, decision_row.status, p_target_status, p_actor_id,
    p_rationale, p_selected_alternative_id, decision_row.source_recommendation_id,
    decision_row.source_learning_refs, decision_row.evidence_refs, decision_row.intelligence_proposal
  );
  update public.decisions set
    status = p_target_status,
    decided_by = p_actor_id,
    decision_date = now(),
    selected_alternative_id = p_selected_alternative_id,
    rationale_i18n = jsonb_set(coalesce(rationale_i18n, '{}'::jsonb), '{decision_intelligence_review}', to_jsonb(p_rationale)),
    updated_at = now()
  where id = decision_row.id;
  return jsonb_build_object('decision_id', decision_row.id, 'status', p_target_status, 'approved_by', p_actor_id, 'executable', false);
end
$$;

revoke all on function public.transition_organizational_learning(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.review_decision_intelligence(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.transition_organizational_learning(uuid,text,uuid,text) to service_role;
grant execute on function public.review_decision_intelligence(uuid,text,uuid,text,text) to service_role;

revoke insert, update, delete on public.organizational_learning_transitions from authenticated, anon;
revoke insert, update, delete on public.decision_intelligence_reviews from authenticated, anon;

comment on table public.organizational_learnings is 'Organization-scoped learnings promoted only from reliable historical outcomes.';
comment on table public.decision_intelligence_reviews is 'Immutable human-review trace attached to canonical decisions; never an execution log.';
