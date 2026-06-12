-- ============================================================================
-- ProjectOps360° — Fix RLS Infinite Recursion
-- Migration: 20260609000000_fix_rls_recursion.sql
--
-- The previous RLS policies on organization_members and organizations caused
-- infinite recursion because they referenced organization_members within
-- their own USING clause. This migration replaces those policies with
-- non-recursive alternatives.
--
-- Root cause:
--   organization_members SELECT policy used a subquery on organization_members
--   organizations SELECT policy used a subquery on organization_members
--   → When Postgres evaluates the policy, it needs to read organization_members
--     to determine if the user can read organization_members → infinite loop
--
-- Fix:
--   - organization_members: simple auth.uid() = user_id (a user can see
--     their own membership rows directly)
--   - organizations: uses organization_members with the now-simple policy
--   - Add helper policies for cross-references
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 1: Fix organization_members RLS
-- ──────────────────────────────────────────────

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can read own organization memberships"
  ON public.organization_members;

-- A user can read their own membership rows directly (no subquery needed)
CREATE POLICY "Users can read own memberships"
  ON public.organization_members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own membership row (needed if trigger fails
-- and we need a fallback, though trigger runs as SECURITY DEFINER)
CREATE POLICY "Users can insert own membership"
  ON public.organization_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- SECTION 2: Fix organizations RLS
-- ──────────────────────────────────────────────
-- Now that organization_members has a non-recursive policy, the organizations
-- policy can safely reference it without causing recursion.

-- Drop the old recursive policy
DROP POLICY IF EXISTS "Users can read own organizations"
  ON public.organizations;

-- Users can read organizations where they are a member
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

-- ──────────────────────────────────────────────
-- SECTION 3: Fix profiles RLS (add INSERT for trigger edge case)
-- ──────────────────────────────────────────────

-- Allow users to insert their own profile (for edge cases where
-- the trigger hasn't run yet)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);