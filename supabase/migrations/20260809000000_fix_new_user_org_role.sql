-- ============================================================================
-- ProjectOps360° — Fix: new signups must be COMPANY_OWNER (org_role)
-- Migration: 20260809000000_fix_new_user_org_role.sql
--
-- The RBAC migration added organization_members.org_role with DEFAULT
-- 'TEAM_MEMBER'. The handle_new_user() trigger inserts the founding membership
-- without org_role, so a brand-new signup would wrongly become TEAM_MEMBER.
-- This recreates the trigger function to set org_role = 'COMPANY_OWNER' for the
-- user's own organization (it already sets legacy role = 'owner').
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  display_name text;
BEGIN
  display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1)
  );

  INSERT INTO public.organizations (slug, name_i18n)
  VALUES (
    'org_' || new.id,
    jsonb_build_object('en', 'My Organization', 'es', 'Mi Organización')
  )
  RETURNING id INTO org_id;

  INSERT INTO public.profiles (id, organization_id, default_organization_id, display_name, locale, timezone)
  VALUES (new.id, org_id, org_id, display_name, 'en', 'America/New_York');

  -- Founding member is the company owner (both legacy role and enforced org_role).
  INSERT INTO public.organization_members (organization_id, user_id, role, org_role)
  VALUES (org_id, new.id, 'owner', 'COMPANY_OWNER');

  RETURN new;
END;
$$;
