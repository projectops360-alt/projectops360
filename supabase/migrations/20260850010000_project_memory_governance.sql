-- Phase 8 · P8-T1B — retention and retrieval boundaries for existing Project Memory.

alter table public.project_memory_items
  add column if not exists memory_boundary text not null default 'project_record'
    check (memory_boundary in ('interaction','working','project_record','organizational_learning')),
  add column if not exists sensitivity text not null default 'internal'
    check (sensitivity in ('public','internal','confidential','restricted')),
  add column if not exists retention_expires_at timestamptz,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists consent_recorded boolean not null default true,
  add column if not exists human_validated boolean not null default false,
  add column if not exists governance_metadata jsonb not null default '{}';

alter table public.project_memory_items
  add constraint project_memory_organizational_boundary_safe
  check (memory_boundary <> 'organizational_learning' or (
    project_id is null and human_validated and sensitivity <> 'restricted'
  ));

create index project_memory_retention_scope_idx
  on public.project_memory_items(organization_id, project_id, memory_boundary, retention_expires_at);

comment on column public.project_memory_items.memory_boundary is
  'Interaction, working, durable project record, or deidentified validated organizational learning.';
comment on column public.project_memory_items.retention_expires_at is
  'Explicit retention expiry; legal_hold prevents disposal until separately released.';
