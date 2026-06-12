-- ============================================================================
-- ProjectOps360° — Fix Orphaned Users (No Org/Profile/Membership)
-- Migration: 20260610000000_fix_orphaned_users.sql
--
-- This is a one-time data migration that creates org/profile/membership
-- for any users who were created before the handle_new_user trigger existed
-- or during testing when the trigger had RLS recursion issues.
--
-- After this migration, the trigger should handle all new signups correctly.
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 1: Create missing orgs, profiles, and memberships
-- ──────────────────────────────────────────────
-- Uses a CTE that finds all auth.users without an organization_members row,
-- then creates the missing data for each one.

INSERT INTO public.organizations (slug, name_i18n)
SELECT
  'org_' || u.id,
  jsonb_build_object(
    'en', 'My Organization',
    'es', 'Mi Organización'
  )
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om WHERE om.user_id = u.id
);

-- Create profiles for orphaned users (using the org we just created)
INSERT INTO public.profiles (id, organization_id, display_name, locale, timezone)
SELECT
  u.id,
  o.id,
  coalesce(
    u.raw_user_meta_data ->> 'display_name',
    split_part(u.email, '@', 1)
  ),
  'en',
  'America/New_York'
FROM auth.users u
JOIN public.organizations o ON o.slug = 'org_' || u.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Create memberships for orphaned users
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT
  o.id,
  u.id,
  'owner'
FROM auth.users u
JOIN public.organizations o ON o.slug = 'org_' || u.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om WHERE om.user_id = u.id
);

-- ──────────────────────────────────────────────
-- SECTION 2: Add RPC for auto-healing (future resilience)
-- ──────────────────────────────────────────────
-- This function can be called from the app to ensure the current user
-- has org data. It's idempotent and safe to call on every login.

CREATE OR REPLACE FUNCTION public.ensure_user_org()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_display_name text;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has an org membership
  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id
  LIMIT 1;

  -- If already has an org, return it
  IF v_org_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'organizationId', o.id,
      'organizationSlug', o.slug,
      'organizationName', o.name_i18n,
      'role', om.role
    ) INTO v_result
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = v_user_id
    LIMIT 1;

    RETURN v_result;
  END IF;

  -- No org found — create one
  v_display_name := coalesce(
    (SELECT u.raw_user_meta_data ->> 'display_name' FROM auth.users u WHERE u.id = v_user_id),
    split_part((SELECT u.email FROM auth.users u WHERE u.id = v_user_id), '@', 1)
  );

  -- Create organization
  INSERT INTO public.organizations (slug, name_i18n)
  VALUES (
    'org_' || v_user_id,
    jsonb_build_object('en', 'My Organization', 'es', 'Mi Organización')
  )
  RETURNING id INTO v_org_id;

  -- Create/update profile
  INSERT INTO public.profiles (id, organization_id, display_name, locale, timezone)
  VALUES (v_user_id, v_org_id, v_display_name, 'en', 'America/New_York')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    display_name = coalesce(profiles.display_name, EXCLUDED.display_name);

  -- Create membership
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  RETURN jsonb_build_object(
    'organizationId', v_org_id,
    'organizationSlug', 'org_' || v_user_id,
    'organizationName', jsonb_build_object('en', 'My Organization', 'es', 'Mi Organización'),
    'role', 'owner'
  );
END;
$$;

COMMENT ON FUNCTION public.ensure_user_org IS
  'Idempotent function that ensures the current authenticated user has an organization, profile, and membership. Creates them if missing. Runs as SECURITY DEFINER to bypass RLS.';