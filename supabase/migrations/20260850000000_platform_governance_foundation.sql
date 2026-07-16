-- Phase 8 · P8-T3A/B — platform security decisions and append-only governance audit.

create table public.platform_governance_audit (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  sequence_number bigint not null,
  event_type text not null check (event_type in (
    'access_allowed','access_denied','human_override_recorded','knowledge_transition_reviewed','policy_evaluated'
  )),
  actor_id text not null,
  actor_type text not null check (actor_type in ('human','ai','system')),
  actor_role text not null check (actor_role in ('owner','admin','member','viewer','service')),
  purpose text not null check (length(btrim(purpose)) >= 3),
  policy_version text not null,
  decision text not null check (decision in ('allowed','denied','recorded')),
  reason_codes text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  metadata jsonb not null default '{}',
  previous_hash text,
  record_hash text not null check (record_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (organization_id, sequence_number),
  check (not (metadata ?| array['access_token','authorization','body','content','password','payload','raw_payload','secret','transcript']))
);

create index platform_governance_audit_scope_idx
  on public.platform_governance_audit(organization_id, project_id, occurred_at desc);

create or replace function public.reject_platform_governance_audit_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'platform_governance_audit_is_append_only';
end
$$;

create trigger platform_governance_audit_no_update
  before update on public.platform_governance_audit
  for each row execute function public.reject_platform_governance_audit_mutation();
create trigger platform_governance_audit_no_delete
  before delete on public.platform_governance_audit
  for each row execute function public.reject_platform_governance_audit_mutation();

alter table public.platform_governance_audit enable row level security;

create policy "Organization members read governance audit"
  on public.platform_governance_audit for select
  using (public.is_org_member(organization_id));

revoke insert, update, delete on public.platform_governance_audit from anon, authenticated;
grant select on public.platform_governance_audit to authenticated;
grant insert on public.platform_governance_audit to service_role;

comment on table public.platform_governance_audit is
  'Append-only, tenant-scoped platform access and governance decision chain; never stores raw payloads.';
