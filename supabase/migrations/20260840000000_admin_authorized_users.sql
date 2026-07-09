-- ============================================================================
-- ProjectOps360° — Admin Console authorized users (platform admin allowlist)
-- ============================================================================
-- Net-new table backing the platform-admin gate (src/lib/admin-console/access).
-- Today the Admin Console (/<locale>/admin) is gated by a strict server-side
-- email check: the row allowlist below, falling back to the built-in
-- pmo@xxx-demo.io address. This table is the future source of truth so that
-- authorized users can be configured from the Admin Console itself (next
-- iteration). It is NOT applied to production automatically — review & apply
-- manually. Until it exists, the access helper tolerates its absence and
-- uses the env/temporary fallback (see access.server.ts).
--
-- Notes:
--  * Emails are stored normalized (trim + lowercase); a UNIQUE index enforces
--    one authorization per email.
--  * is_active = false soft-revokes access (revoked_at captures when).
--  * granted_by references profiles(id) (= auth.users.id) of the admin who
--    granted access, for traceability.
--  * RLS: only the service role may read/write — this is a platform-level
--    table, not visible to regular org members. The Admin Console queries it
--    server-side via createAdminClient() (service role) AFTER the gate passes.
-- ============================================================================

create table if not exists public.admin_authorized_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        text,
  is_active   boolean not null default true,
  granted_by   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

-- Normalize + uniqueness on the stored email.
create unique index if not exists admin_authorized_users_email_uidx
  on public.admin_authorized_users (lower(trim(email)));

-- Active authorizations lookup (used by the access gate).
create index if not exists admin_authorized_users_active_idx
  on public.admin_authorized_users (is_active)
  where is_active = true;

-- updated_at auto-maintenance.
create trigger admin_authorized_users_set_updated_at
  before update on public.admin_authorized_users
  for each row execute function public.update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Platform-level table: no regular user (any role) may read it through the
-- anon/authenticated client. The Admin Console reads it server-side with the
-- service role, which bypasses RLS.
alter table public.admin_authorized_users enable row level security;

-- Deny all access to anon/authenticated roles. Service role is exempt.
create policy "admin_authorized_users_service_role_only"
  on public.admin_authorized_users
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================================
-- TODO (next iteration): seed the initial authorized admin from the Admin
-- Console UI once the CRUD lands. For now the access helper falls back to
-- pmo@xxx-demo.io when the table is empty or absent. Do NOT seed here.
-- ============================================================================