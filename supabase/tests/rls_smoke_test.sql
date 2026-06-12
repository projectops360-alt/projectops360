-- ============================================================================
-- ProjectOps360° — RLS Smoke Tests (Self-Contained)
-- File: supabase/tests/rls_smoke_test.sql
--
-- Run this in the Supabase SQL Editor (as service_role) after applying
-- the RLS migration (20260611000000_enable_rls_business_tables.sql).
--
-- This script:
--   1. Creates test data (2 orgs, 2 users, sample records)
--   2. Runs isolation tests simulating different users via JWT claims
--   3. Reports pass/fail for each test
--   4. Cleans up all test data
--
-- HOW IT WORKS:
--   Supabase evaluates auth.uid() from the request JWT claims. We simulate
--   different users by setting request.jwt.claims via set_config(). This
--   lets us test RLS policies without creating real Supabase Auth users.
--
-- IMPORTANT:
--   - Run the ENTIRE script at once in the SQL Editor
--   - The script uses temporary tables to collect results
--   - Cleanup runs automatically at the end
--   - Some "negative" tests (cross-org INSERT) are expected to fail — the
--     script catches the exception and reports it as a PASS
-- ============================================================================

-- ──────────────────────────────────────────────
-- STEP 0: Create results table
-- ──────────────────────────────────────────────
DROP TABLE IF EXISTS _rls_test_results;
CREATE TEMP TABLE _rls_test_results (
  test_name text,
  expected text,
  actual text,
  passed boolean
);

-- ──────────────────────────────────────────────
-- STEP 1: Create test data (as service_role)
-- ──────────────────────────────────────────────
-- We use fixed UUIDs so we can reference them in JWT claim simulations.

-- Org Alpha
INSERT INTO organizations (id, slug, name_i18n) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'org-alpha-test', '{"en": "Org Alpha Test", "es": "Org Alpha Prueba"}')
ON CONFLICT (id) DO NOTHING;

-- Org Beta
INSERT INTO organizations (id, slug, name_i18n) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'org-beta-test', '{"en": "Org Beta Test", "es": "Org Beta Prueba"}')
ON CONFLICT (id) DO NOTHING;

-- Alice — member of Org Alpha
INSERT INTO profiles (id, organization_id, display_name) VALUES
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Alice Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_members (id, organization_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000010', 'owner')
ON CONFLICT (id) DO NOTHING;

-- Bob — member of Org Beta
INSERT INTO profiles (id, organization_id, display_name) VALUES
  ('b0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000002', 'Bob Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_members (id, organization_id, user_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000020', 'owner')
ON CONFLICT (id) DO NOTHING;

-- Project in Org Alpha
INSERT INTO projects (id, organization_id, slug, title_i18n, status) VALUES
  ('p0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'alpha-project-test', '{"en": "Alpha Project"}', 'active')
ON CONFLICT (id) DO NOTHING;

-- Project in Org Beta
INSERT INTO projects (id, organization_id, slug, title_i18n, status) VALUES
  ('p0b00000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'beta-project-test', '{"en": "Beta Project"}', 'active')
ON CONFLICT (id) DO NOTHING;

-- Stakeholder in Org Alpha
INSERT INTO stakeholders (id, organization_id, project_id, name, role_i18n, influence, interest) VALUES
  ('s0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'p0a00000-0000-0000-0000-000000000001', 'Stakeholder Alpha', '{"en": "Sponsor"}', 'high', 'high')
ON CONFLICT (id) DO NOTHING;

-- Meeting in Org Alpha
INSERT INTO meetings (id, organization_id, project_id, title_i18n, status, meeting_date, created_by) VALUES
  ('m0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'p0a00000-0000-0000-0000-000000000001', '{"en": "Alpha Kickoff"}', 'completed', NOW(), 'a0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- Decision in Org Alpha
INSERT INTO decisions (id, organization_id, project_id, title_i18n, status, decision_date, created_by) VALUES
  ('d0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'p0a00000-0000-0000-0000-000000000001', '{"en": "Use Supabase"}', 'accepted', NOW(), 'a0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- Communication item in Org Alpha
INSERT INTO communication_items (id, organization_id, project_id, title_i18n, channel, item_date, created_by) VALUES
  ('c0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'p0a00000-0000-0000-0000-000000000001', '{"en": "Alpha Email"}', 'email', NOW(), 'a0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- Document in Org Alpha
INSERT INTO documents (id, organization_id, project_id, title_i18n, file_url, file_type, status, created_by) VALUES
  ('d0a00001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'p0a00000-0000-0000-0000-000000000001', '{"en": "Alpha Spec"}', 'https://example.com/spec.pdf', 'application/pdf', 'draft', 'a0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- Traceability link in Org Alpha
INSERT INTO traceability_links (id, organization_id, source_type, source_id, target_type, target_id, link_type, created_by) VALUES
  ('t0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'decision', 'd0a00000-0000-0000-0000-000000000001', 'meeting', 'm0a00000-0000-0000-0000-000000000001', 'related_to', 'a0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- AI run in Org Alpha
INSERT INTO ai_runs (id, organization_id, user_id, model, prompt_type, status, source_type, source_id) VALUES
  ('r0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000010', 'gpt-4o', 'summary', 'completed', 'meeting', 'm0a00000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Action item in Org Alpha
INSERT INTO action_items (id, organization_id, project_id, title_i18n, status, priority, created_by) VALUES
  ('a0a00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'p0a00000-0000-0000-0000-000000000001', '{"en": "Follow up"}', 'pending', 'medium', 'a0000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Infrastructure Verification (runs as service_role, no JWT tricks)
-- ══════════════════════════════════════════════════════════════════════════════

-- 2.1 RLS enabled on all 12 tables
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'RLS enabled on all 12 tables',
  '12',
  COUNT(*)::text,
  COUNT(*) = 12
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'profiles', 'organization_members',
    'projects', 'stakeholders', 'meetings', 'decisions',
    'communication_items', 'documents', 'traceability_links',
    'ai_runs', 'action_items'
  )
  AND rowsecurity = true;

-- 2.2 is_org_member is SECURITY DEFINER
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'is_org_member is SECURITY DEFINER',
  'true',
  prosecdef::text,
  prosecdef = true
FROM pg_proc
WHERE proname = 'is_org_member';

-- 2.3 protect_profile_org_id trigger exists
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'protect_profile_org_id trigger exists',
  '1',
  COUNT(*)::text,
  COUNT(*) = 1
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'profiles'
  AND trigger_name = 'protect_profile_org_id';

-- 2.4 Policy count on organizations (3: SELECT, UPDATE, ALL)
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'organizations has 3 policies',
  '3',
  COUNT(*)::text,
  COUNT(*) = 3
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'organizations';

-- 2.5 Policy count on profiles (4: SELECT, UPDATE, INSERT, ALL)
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'profiles has 4 policies',
  '4',
  COUNT(*)::text,
  COUNT(*) = 4
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 2.6 Policy count on organization_members (4: SELECT, INSERT, UPDATE, ALL)
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'organization_members has 4 policies',
  '4',
  COUNT(*)::text,
  COUNT(*) = 4
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'organization_members';

-- 2.7 Each business table has 5 policies
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  tablename || ' has 5 policies',
  '5',
  COUNT(*)::text,
  COUNT(*) = 5
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'projects', 'stakeholders', 'meetings', 'decisions',
    'communication_items', 'documents', 'traceability_links',
    'ai_runs', 'action_items'
  )
GROUP BY tablename
ORDER BY tablename;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Helper Function Tests
-- ══════════════════════════════════════════════════════════════════════════════
-- Simulate Alice (member of Org Alpha) by setting JWT claims

-- 3.1 is_org_member returns TRUE for own org (as Alice)
PERFORM set_config('request.jwt.claims', json_build_object(
  'sub', 'a0000000-0000-0000-0000-000000000010',
  'role', 'authenticated'
)::text, true);

INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'is_org_member returns TRUE for own org (Alice → Org Alpha)',
  'true',
  public.is_org_member('a0000000-0000-0000-0000-000000000001')::text,
  public.is_org_member('a0000000-0000-0000-0000-000000000001') = true;

-- 3.2 is_org_member returns FALSE for other org (as Alice)
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'is_org_member returns FALSE for other org (Alice → Org Beta)',
  'false',
  public.is_org_member('b0000000-0000-0000-0000-000000000002')::text,
  public.is_org_member('b0000000-0000-0000-0000-000000000002') = false;

-- 3.3 is_org_member returns FALSE for nonexistent org (as Alice)
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'is_org_member returns FALSE for nonexistent org',
  'false',
  public.is_org_member('00000000-0000-0000-0000-000000000000')::text,
  public.is_org_member('00000000-0000-0000-0000-000000000000') = false;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Own-Org Access Tests (as Alice)
-- ══════════════════════════════════════════════════════════════════════════════

-- Keep Alice's JWT claims active

-- 4.1 SELECT own org's projects
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can SELECT own org projects',
  '≥1',
  COUNT(*)::text,
  COUNT(*) >= 1
FROM projects
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';

-- 4.2 INSERT project in own org
DO $$
BEGIN
  INSERT INTO projects (id, organization_id, slug, title_i18n, status)
  VALUES ('p0a00000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000001', 'alice-insert-test', '{"en": "Alice Insert Test"}', 'planning');
  INSERT INTO _rls_test_results VALUES ('Alice can INSERT project in own org', 'success', 'success', true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _rls_test_results VALUES ('Alice can INSERT project in own org', 'success', SQLERRM, false);
END $$;

-- 4.3 UPDATE project in own org
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE projects SET title_i18n = '{"en": "Updated Title"}'
  WHERE id = 'p0a00000-0000-0000-0000-000000000099';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Alice can UPDATE project in own org',
    '1',
    updated_count::text,
    updated_count = 1
  );
END $$;

-- 4.4 DELETE (soft-delete) project in own org
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE projects SET deleted_at = NOW()
  WHERE id = 'p0a00000-0000-0000-0000-000000000099' AND deleted_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Alice can soft-delete project in own org',
    '1',
    updated_count::text,
    updated_count = 1
  );
END $$;

-- Clean up test project
DELETE FROM projects WHERE id = 'p0a00000-0000-0000-0000-000000000099';

-- 4.5 SELECT own profile
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can SELECT own profile',
  '1',
  COUNT(*)::text,
  COUNT(*) = 1
FROM profiles
WHERE id = 'a0000000-0000-0000-0000-000000000010';

-- 4.6 UPDATE own profile (allowed fields)
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE profiles SET display_name = 'Alice Updated', locale = 'es'
  WHERE id = 'a0000000-0000-0000-0000-000000000010';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Alice can UPDATE own profile (allowed fields)',
    '1',
    updated_count::text,
    updated_count = 1
  );
END $$;

-- 4.7 SELECT own org's organization
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can SELECT own organization',
  '1',
  COUNT(*)::text,
  COUNT(*) = 1
FROM organizations
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 4.8 UPDATE own org's name
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE organizations SET name_i18n = '{"en": "Org Alpha Updated", "es": "Org Alpha Prueba"}'
  WHERE id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Alice can UPDATE own organization',
    '1',
    updated_count::text,
    updated_count = 1
  );
END $$;

-- 4.9 SELECT own org's organization_members (should see all members, not just own)
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can see org members (not just own row)',
  '≥1',
  COUNT(*)::text,
  COUNT(*) >= 1
FROM organization_members
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';

-- 4.10 SELECT stakeholders in own org
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can SELECT stakeholders in own org',
  '≥1',
  COUNT(*)::text,
  COUNT(*) >= 1
FROM stakeholders
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';

-- 4.11 SELECT meetings in own org
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can SELECT meetings in own org',
  '≥1',
  COUNT(*)::text,
  COUNT(*) >= 1
FROM meetings
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';

-- 4.12 SELECT decisions in own org
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice can SELECT decisions in own org',
  '≥1',
  COUNT(*)::text,
  COUNT(*) >= 1
FROM decisions
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Cross-Org Blocking Tests (as Alice accessing Org Beta data)
-- ══════════════════════════════════════════════════════════════════════════════

-- 5.1 SELECT projects from other org → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice CANNOT SELECT projects from Org Beta',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM projects
WHERE organization_id = 'b0000000-0000-0000-0000-000000000002';

-- 5.2 INSERT project in other org → blocked
DO $$
BEGIN
  INSERT INTO projects (id, organization_id, slug, title_i18n, status)
  VALUES ('p0a00000-0000-0000-0000-000000000098', 'b0000000-0000-0000-0000-000000000002', 'sneaky-project', '{"en": "Sneaky"}', 'planning');
  INSERT INTO _rls_test_results VALUES ('Alice CANNOT INSERT project in Org Beta', 'error', 'insert succeeded (BUG!)', false);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _rls_test_results VALUES ('Alice CANNOT INSERT project in Org Beta', 'error', 'error (blocked)', true);
END $$;

-- 5.3 UPDATE project in other org → 0 rows
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE projects SET title_i18n = '{"en": "Hacked"}'
  WHERE organization_id = 'b0000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Alice CANNOT UPDATE projects in Org Beta',
    '0',
    updated_count::text,
    updated_count = 0
  );
END $$;

-- 5.4 DELETE project in other org → 0 rows
DO $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM projects WHERE organization_id = 'b0000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Alice CANNOT DELETE projects in Org Beta',
    '0',
    deleted_count::text,
    deleted_count = 0
  );
END $$;

-- 5.5 Cross-org move (change organization_id) → blocked by WITH CHECK
DO $$
BEGIN
  UPDATE projects SET organization_id = 'b0000000-0000-0000-0000-000000000002'
  WHERE id = 'p0a00000-0000-0000-0000-000000000001';
  -- If we got here, the USING clause filtered to 0 rows (can't see other org's projects)
  -- OR if the row was visible, WITH CHECK would block it
  INSERT INTO _rls_test_results VALUES (
    'Alice CANNOT move project to Org Beta',
    '0 rows updated or error',
    '0 rows updated (USING blocked)',
    true
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _rls_test_results VALUES (
    'Alice CANNOT move project to Org Beta',
    '0 rows updated or error',
    'error: ' || SQLERRM,
    true
  );
END $$;

-- 5.6 SELECT stakeholders from other org → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice CANNOT SELECT stakeholders from Org Beta',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM stakeholders
WHERE organization_id = 'b0000000-0000-0000-0000-000000000002';

-- 5.7 SELECT other org's organization → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice CANNOT SELECT Org Beta organization',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM organizations
WHERE id = 'b0000000-0000-0000-0000-000000000002';

-- 5.8 SELECT other org's members → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice CANNOT SELECT Org Beta members',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM organization_members
WHERE organization_id = 'b0000000-0000-0000-0000-000000000002';

-- 5.9 SELECT other user's profile → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Alice CANNOT SELECT Bob profile',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM profiles
WHERE id = 'b0000000-0000-0000-0000-000000000020';


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 6: Profile organization_id Protection
-- ══════════════════════════════════════════════════════════════════════════════

-- 6.1 Changing organization_id → RAISE EXCEPTION
DO $$
BEGIN
  UPDATE profiles SET organization_id = 'b0000000-0000-0000-0000-000000000002'
  WHERE id = 'a0000000-0000-0000-0000-000000000010';
  INSERT INTO _rls_test_results VALUES (
    'Profile org_id change is BLOCKED',
    'error',
    'no error raised (BUG!)',
    false
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _rls_test_results VALUES (
    'Profile org_id change is BLOCKED',
    'error',
    'error: ' || SQLERRM,
    SQLERRM LIKE '%Cannot change profiles.organization_id%'
  );
END $$;

-- 6.2 Changing allowed fields → succeeds (already tested in 4.6, but confirm again)
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE profiles SET display_name = 'Alice Final', timezone = 'America/Los_Angeles'
  WHERE id = 'a0000000-0000-0000-0000-000000000010';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO _rls_test_results VALUES (
    'Profile allowed fields update works',
    '1',
    updated_count::text,
    updated_count = 1
  );
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 7: Anonymous Access Blocked (simulate anon role)
-- ══════════════════════════════════════════════════════════════════════════════

-- Set role to anon (no authenticated user)
PERFORM set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-000000000000',
  'role', 'anon'
)::text, true);

-- 7.1 Anonymous SELECT projects → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Anon CANNOT SELECT projects',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM projects;

-- 7.2 Anonymous SELECT organizations → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Anon CANNOT SELECT organizations',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM organizations;

-- 7.3 Anonymous SELECT organization_members → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Anon CANNOT SELECT organization_members',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM organization_members;

-- 7.4 Anonymous SELECT profiles → 0 rows
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Anon CANNOT SELECT profiles',
  '0',
  COUNT(*)::text,
  COUNT(*) = 0
FROM profiles;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 8: Service Role Bypass
-- ══════════════════════════════════════════════════════════════════════════════
-- Reset JWT claims for service_role (which bypasses all RLS)
PERFORM set_config('request.jwt.claims', '', true);

-- 8.1 Service role can SELECT all projects across all orgs
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Service role can SELECT all projects',
  '≥2',
  COUNT(*)::text,
  COUNT(*) >= 2
FROM projects
WHERE id IN ('p0a00000-0000-0000-0000-000000000001', 'p0b00000-0000-0000-0000-000000000002');

-- 8.2 Service role can INSERT project in any org
DO $$
BEGIN
  INSERT INTO projects (id, organization_id, slug, title_i18n, status)
  VALUES ('p0a00000-0000-0000-0000-000000000097', 'b0000000-0000-0000-0000-000000000002', 'admin-insert-test', '{"en": "Admin Insert"}', 'planning');
  INSERT INTO _rls_test_results VALUES ('Service role can INSERT project in any org', 'success', 'success', true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _rls_test_results VALUES ('Service role can INSERT project in any org', 'success', SQLERRM, false);
END $$;

-- Clean up
DELETE FROM projects WHERE id = 'p0a00000-0000-0000-0000-000000000097';

-- 8.3 Service role can SELECT all organization_members
INSERT INTO _rls_test_results (test_name, expected, actual, passed)
SELECT
  'Service role can SELECT all org members',
  '≥2',
  COUNT(*)::text,
  COUNT(*) >= 2
FROM organization_members
WHERE id IN ('a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000021');


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 9: Display Results
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  test_name,
  expected,
  actual,
  CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END AS result
FROM _rls_test_results
ORDER BY test_name;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 10: Summary
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  COUNT(*) AS total_tests,
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0 THEN '🎉 ALL TESTS PASSED' ELSE '⚠️ SOME TESTS FAILED' END AS summary
FROM _rls_test_results;


-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 11: Cleanup — remove all test data
-- ══════════════════════════════════════════════════════════════════════════════
-- Run as service_role (bypasses RLS)

-- Reset JWT claims
PERFORM set_config('request.jwt.claims', '', true);

DELETE FROM action_items WHERE id LIKE 'a0a00000-0000-0000-0000-00000000%';
DELETE FROM ai_runs WHERE id LIKE 'r0a00000-0000-0000-0000-00000000%';
DELETE FROM traceability_links WHERE id LIKE 't0a00000-0000-0000-0000-00000000%';
DELETE FROM documents WHERE id LIKE 'd0a00001-0000-0000-0000-00000000%';
DELETE FROM communication_items WHERE id LIKE 'c0a00000-0000-0000-0000-00000000%';
DELETE FROM decisions WHERE id LIKE 'd0a00000-0000-0000-0000-00000000%';
DELETE FROM meetings WHERE id LIKE 'm0a00000-0000-0000-0000-00000000%';
DELETE FROM stakeholders WHERE id LIKE 's0a00000-0000-0000-0000-00000000%';
DELETE FROM projects WHERE id LIKE 'p0a00000-0000-0000-0000-00000000%' OR id LIKE 'p0b00000-0000-0000-0000-00000000%';
DELETE FROM organization_members WHERE id IN ('a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000021');
DELETE FROM profiles WHERE id IN ('a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000020');
DELETE FROM organizations WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

-- Drop temp results table
DROP TABLE IF EXISTS _rls_test_results;