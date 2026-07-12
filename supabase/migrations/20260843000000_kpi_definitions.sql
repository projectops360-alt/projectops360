-- ============================================================================
-- ProjectOps360° — KPI Engine · persisted custom KPI definitions (CAP-046 F3.2)
-- ============================================================================
-- Org-scoped custom KPI definitions saved from human-approved NL translations
-- (PD-019). The expression is ALWAYS re-validated server-side against the
-- KPI allow-list before insert AND before every evaluation — the DB stores
-- text, the sandbox decides. Built-in catalog KPIs stay in code
-- (src/lib/kpi/catalog.ts); this table holds only user-defined ones.
--
-- Notes:
--  * slug is unique per organization among non-deleted rows (soft delete).
--  * project_id NULL = org-wide KPI; set = scoped to one project.
--  * target + target_direction enable on/off-target display (alerts later).
--  * nl_source preserves the original natural-language request (auditable
--    NL-to-KPI provenance).
--  * RLS: org members read/write within their org (server actions add the
--    role guard: viewers never create/delete); service role full access.
-- ============================================================================

create table if not exists public.kpi_definitions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete cascade,
  slug             text not null,
  name_en          text not null,
  name_es          text not null,
  description_en   text,
  description_es   text,
  expression       text not null,
  unit             text,
  precision        integer not null default 1 check (precision between 0 and 4),
  target           numeric,
  target_direction text check (target_direction in ('at_or_above', 'at_or_below')),
  nl_source        text,
  version          integer not null default 1,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- One live slug per organization (soft-deleted rows free the slug).
create unique index if not exists kpi_definitions_org_slug_uidx
  on public.kpi_definitions (organization_id, lower(slug))
  where deleted_at is null;

create index if not exists kpi_definitions_org_idx
  on public.kpi_definitions (organization_id)
  where deleted_at is null;

create index if not exists kpi_definitions_project_idx
  on public.kpi_definitions (project_id)
  where deleted_at is null;

create trigger kpi_definitions_set_updated_at
  before update on public.kpi_definitions
  for each row execute function public.update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.kpi_definitions enable row level security;

create policy "Members read kpi_definitions"
  on public.kpi_definitions for select
  using (public.is_org_member(organization_id));

create policy "Members insert kpi_definitions"
  on public.kpi_definitions for insert
  with check (public.is_org_member(organization_id));

create policy "Members update kpi_definitions"
  on public.kpi_definitions for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members delete kpi_definitions"
  on public.kpi_definitions for delete
  using (public.is_org_member(organization_id));

create policy "Service role kpi_definitions"
  on public.kpi_definitions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
