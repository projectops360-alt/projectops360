-- ============================================================================
-- ProjectOps360° — Admin platform foundation (company names + admin RPCs)
-- ============================================================================
-- Fixes two confirmed production issues and lays the DB foundation for
-- platform-admin (system admin) management from the Admin Console:
--
--  1. Every new signup created an organization hardcoded as
--     {"en":"My Organization","es":"Mi Organización"} (34 of 36 prod orgs).
--     → handle_new_user() and ensure_user_org() now honor an optional
--       raw_user_meta_data->>'company_name' captured at signup.
--
--  2. The Admin Console "View users" drill-down always showed no users:
--     organization_members.user_id references auth.users (NOT profiles), so
--     the PostgREST embed profiles!organization_members_user_id_fkey failed;
--     and auth.users emails are not reachable via .from() even with the
--     service role.
--     → admin_list_company_users() joins organization_members + profiles +
--       auth.users server-side, gated by is_platform_admin().
--
--  3. admin_rename_organization() lets a platform admin rename any company
--     (regular owners rename their own org through RLS: "PMO can update own
--     organizations" already permits it — that path needs no new grant).
--
--  4. audit_logs.action CHECK gains platform-admin actions so privilege
--     changes and admin renames are persisted (org-scoped, as the table
--     requires organization_id NOT NULL).
--
--  5. Orphan-org prevention: deleting an auth user now also removes their
--     personal org ("org_<user_id>") when it has no other members and no
--     projects — the source of the 25 orphaned orgs found in prod (the
--     organization_members CASCADE removed the membership but never the org).
--
-- Security stance (deliberate): business-table RLS is NOT widened. Platform
-- admins read cross-org data ONLY through SECURITY DEFINER RPCs (or the
-- service role on the server) whose gate is admin_authorized_users.
-- ============================================================================

-- ── 1) is_platform_admin() — DB-level gate over admin_authorized_users ──────
-- True iff the calling user's email has an active row in
-- admin_authorized_users. The two hardcoded platform owners in
-- src/lib/admin-console/access.server.ts are an app-level fallback; DB-level
-- access for them requires an active row (seeded by the Admin Console UI).
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_authorized_users a
    join auth.users u on u.id = auth.uid()
    where lower(trim(a.email)) = lower(trim(u.email))
      and a.is_active = true
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- ── 2) Signup functions honor company_name metadata ─────────────────────────
-- If the signup form provided a non-empty company_name, use it verbatim for
-- BOTH locales (a company name is a proper noun — never auto-translated).
-- Otherwise keep the existing bilingual default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  org_id uuid;
  display_name text;
  company text;
  org_name jsonb;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1)
  );

  company := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  org_name := case
    when company is not null then jsonb_build_object('en', company, 'es', company)
    else jsonb_build_object('en', 'My Organization', 'es', 'Mi Organización')
  end;

  insert into public.organizations (slug, name_i18n)
  values ('org_' || new.id, org_name)
  returning id into org_id;

  insert into public.profiles (id, organization_id, default_organization_id, display_name, locale, timezone)
  values (new.id, org_id, org_id, display_name, 'en', 'America/New_York');

  insert into public.organization_members (organization_id, user_id, role, org_role)
  values (org_id, new.id, 'owner', 'COMPANY_OWNER');

  return new;
end;
$function$;

create or replace function public.ensure_user_org()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_display_name text;
  v_company text;
  v_org_name jsonb;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Check if user already has an org membership
  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = v_user_id
  limit 1;

  if v_org_id is not null then
    select jsonb_build_object(
      'organizationId', o.id,
      'organizationSlug', o.slug,
      'organizationName', o.name_i18n,
      'role', om.role
    ) into v_result
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = v_user_id
    limit 1;

    return v_result;
  end if;

  -- No org found — create one, honoring signup company_name metadata.
  select
    coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
    nullif(trim(u.raw_user_meta_data ->> 'company_name'), '')
  into v_display_name, v_company
  from auth.users u
  where u.id = v_user_id;

  v_org_name := case
    when v_company is not null then jsonb_build_object('en', v_company, 'es', v_company)
    else jsonb_build_object('en', 'My Organization', 'es', 'Mi Organización')
  end;

  insert into public.organizations (slug, name_i18n)
  values ('org_' || v_user_id, v_org_name)
  returning id into v_org_id;

  insert into public.profiles (id, organization_id, display_name, locale, timezone)
  values (v_user_id, v_org_id, v_display_name, 'en', 'America/New_York')
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    display_name = coalesce(profiles.display_name, excluded.display_name);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return jsonb_build_object(
    'organizationId', v_org_id,
    'organizationSlug', 'org_' || v_user_id,
    'organizationName', v_org_name,
    'role', 'owner'
  );
end;
$function$;

-- ── 3) admin_list_company_users(p_org_id) — Admin Console drill-down ────────
create or replace function public.admin_list_company_users(p_org_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  org_role text,
  status text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    om.user_id,
    p.display_name,
    u.email::text,
    om.role,
    om.org_role,
    om.status,
    coalesce(om.joined_at, om.created_at)
  from public.organization_members om
  left join public.profiles p on p.id = om.user_id
  left join auth.users u on u.id = om.user_id
  where om.organization_id = p_org_id
  order by coalesce(om.joined_at, om.created_at) asc;
end;
$$;

revoke all on function public.admin_list_company_users(uuid) from public;
grant execute on function public.admin_list_company_users(uuid) to authenticated, service_role;

-- ── 4) admin_rename_organization(p_org_id, p_name) — platform-admin write ───
-- Writes name_i18n for BOTH locales (proper noun, never auto-translated).
create or replace function public.admin_rename_organization(p_org_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_old jsonb;
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  v_name := nullif(trim(p_name), '');
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_name';
  end if;

  select name_i18n into v_old
  from public.organizations
  where id = p_org_id and deleted_at is null;

  if v_old is null then
    raise exception 'organization_not_found';
  end if;

  update public.organizations
  set name_i18n = jsonb_build_object('en', v_name, 'es', v_name)
  where id = p_org_id;

  return jsonb_build_object('organizationId', p_org_id, 'oldName', v_old, 'newName', v_name);
end;
$$;

revoke all on function public.admin_rename_organization(uuid, text) from public;
grant execute on function public.admin_rename_organization(uuid, text) to authenticated, service_role;

-- ── 5) audit_logs: allow platform-admin actions ──────────────────────────────
alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action = any (array[
    'create'::text, 'update'::text, 'delete'::text,
    'task_status_changed'::text, 'prompt_copied'::text, 'prompt_sent_to_ai'::text,
    'task_blocked'::text, 'task_completed'::text, 'task_unblocked'::text,
    'export'::text,
    'admin_granted'::text, 'admin_revoked'::text, 'organization_renamed'::text
  ]));

-- ── 6) Orphan-org prevention on user deletion ────────────────────────────────
-- Deleting an auth user cascades organization_members but historically left
-- the personal org ("org_<user_id>") behind — the source of prod's 25 orphan
-- organizations. Remove it when it has no remaining members and no projects.
create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.organizations o
  where o.slug = 'org_' || old.id
    and not exists (select 1 from public.organization_members om where om.organization_id = o.id)
    and not exists (select 1 from public.projects pr where pr.organization_id = o.id);
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_user_deleted();
