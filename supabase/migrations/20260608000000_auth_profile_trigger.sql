-- ============================================================================
-- ProjectOps360° — Auth Profile Auto-Creation Trigger
-- Migration: 20260608000000_auth_profile_trigger.sql
--
-- When a new user signs up via Supabase Auth, this trigger automatically:
-- 1. Creates a default organization for the user
-- 2. Creates a profile row linking to auth.users(id)
-- 3. Creates an organization_members row with role = 'owner'
--
-- Also enables basic RLS on profiles and organization_members.
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 1: Handle New User Function
-- ──────────────────────────────────────────────

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
  -- Derive display name from user metadata or email
  display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1)
  );

  -- 1. Create a default organization for the user
  INSERT INTO public.organizations (slug, name_i18n)
  VALUES (
    'org_' || new.id,
    jsonb_build_object(
      'en', 'My Organization',
      'es', 'Mi Organización'
    )
  )
  RETURNING id INTO org_id;

  -- 2. Create the user's profile
  INSERT INTO public.profiles (id, organization_id, display_name, locale, timezone)
  VALUES (new.id, org_id, display_name, 'en', 'America/New_York');

  -- 3. Add the user as owner of their organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, new.id, 'owner');

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates organization, profile, and membership when a new user signs up. Runs as SECURITY DEFINER to bypass RLS during trigger execution.';

-- ──────────────────────────────────────────────
-- SECTION 2: Auth User Trigger
-- ──────────────────────────────────────────────

-- Drop if exists to allow re-running the migration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────
-- SECTION 3: Row Level Security — profiles
-- ──────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except changing id or organization_id)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND id = auth.uid());

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access on profiles"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 4: Row Level Security — organization_members
-- ──────────────────────────────────────────────

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Users can read memberships in their own organizations
CREATE POLICY "Users can read own organization memberships"
  ON public.organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role has full access on organization_members"
  ON public.organization_members
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 5: Row Level Security — organizations
-- ──────────────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Users can read organizations they belong to
CREATE POLICY "Users can read own organizations"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role has full access on organizations"
  ON public.organizations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');