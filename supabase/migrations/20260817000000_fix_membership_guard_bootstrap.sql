-- ============================================================================
-- ProjectOps360° — Fix: membership-tamper guard blocked all new-user creation
-- Migration: 20260817000000_fix_membership_guard_bootstrap.sql
--
-- BUG: prevent_membership_role_tamper() (Phase 0 security hardening) only
-- exempted auth.role() = 'service_role'. But when GoTrue creates a user
-- (sign-up OR admin.createUser), the handle_new_user trigger runs under the
-- auth-admin context (NOT 'service_role') and inserts the user's own personal
-- org membership as COMPANY_OWNER/owner. The guard rejected that with
-- "Privileged membership roles cannot be self-assigned via direct API",
-- so the whole user creation failed with "Database error creating new user".
-- This broke ALL new-user onboarding in production.
--
-- FIX: enforce the guard ONLY for end-users acting through the data API
-- (auth.role() = 'authenticated') — which IS the actual privilege-escalation
-- vector. System/admin contexts (handle_new_user via auth-admin, service_role
-- admin operations, postgres) are allowed to bootstrap memberships. This keeps
-- the protection fully intact for the real threat while unblocking onboarding.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_membership_role_tamper()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only end-users acting through the PostgREST data API carry the
  -- 'authenticated' role. System/admin/definer contexts (service_role,
  -- supabase_auth_admin via handle_new_user, postgres) must be able to
  -- bootstrap and manage memberships.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (NEW.org_role IS NOT NULL AND NEW.org_role NOT IN ('TEAM_MEMBER','STAKEHOLDER','CLIENT','VIEWER'))
       OR (NEW.role IN ('owner','admin')) THEN
      RAISE EXCEPTION 'Privileged membership roles cannot be self-assigned via direct API';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.org_role IS DISTINCT FROM OLD.org_role OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Membership role changes are not permitted via direct API';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
