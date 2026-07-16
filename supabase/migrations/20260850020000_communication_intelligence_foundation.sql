-- Phase 8 · P8-T2A/B — normalized communication provenance and human-reviewed knowledge candidates.

alter table public.communication_items
  add column if not exists source_external_id text,
  add column if not exists content_fingerprint text,
  add column if not exists ingestion_provenance jsonb not null default '{}',
  add column if not exists consent_recorded boolean not null default false,
  add column if not exists occurred_at timestamptz,
  add column if not exists recorded_at timestamptz not null default now();

create unique index communication_items_external_dedupe_idx
  on public.communication_items(organization_id, project_id, source_type, source_external_id)
  where source_external_id is not null and deleted_at is null;

create table public.communication_knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  communication_id uuid not null references public.communication_items(id) on delete cascade,
  candidate_type text not null check (candidate_type in ('decision','action','risk','lesson','commitment','question')),
  statement text not null,
  source_excerpt text not null,
  confidence numeric not null check (confidence between 0 and 1),
  evidence_refs text[] not null,
  status text not null default 'needs_review' check (status in ('needs_review','accepted','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_rationale text,
  created_at timestamptz not null default now(),
  check (cardinality(evidence_refs) > 0),
  check (status = 'needs_review' or (reviewed_by is not null and reviewed_at is not null and length(btrim(review_rationale)) >= 3))
);

alter table public.communication_knowledge_candidates enable row level security;
create policy "Organization members read communication knowledge candidates"
  on public.communication_knowledge_candidates for select
  using (public.is_org_member(organization_id));

revoke insert, update, delete on public.communication_knowledge_candidates from anon, authenticated;
grant select on public.communication_knowledge_candidates to authenticated;
grant insert, update on public.communication_knowledge_candidates to service_role;

comment on table public.communication_knowledge_candidates is
  'Traceable communication-derived candidates; never creates canonical knowledge or project records without human review.';
