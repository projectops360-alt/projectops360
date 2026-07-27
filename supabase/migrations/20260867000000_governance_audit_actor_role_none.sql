-- ============================================================================
-- REG-034 — A refusal by an actor with no role could not be recorded
-- ============================================================================
-- `eki_resolve_finding`, `eki_assign_owner` and the new `eki_request_evaluation`
-- all write an `access_denied` record with `coalesce(actor_role, 'none')` before
-- returning the denial. `platform_governance_audit.actor_role` admitted
-- owner / admin / member / viewer / service and nothing else, so the insert
-- violated its check constraint, the exception propagated, and BOTH the audit
-- record and the caller's answer were lost.
--
-- Macrophase 2 did not catch this because its acceptance test used a member
-- without authority. The role was 'member', the constraint was satisfied, and
-- the branch that produces 'none' — an actor with no standing in the tenant at
-- all — was never executed. It is the most important denial there is, and it was
-- the one the audit could not express.
--
-- This WIDENS the vocabulary and narrows nothing. `none` is denied every
-- operation in src/lib/platform-governance/security.ts, reads included, so
-- admitting the value grants no access.
-- ============================================================================

alter table public.platform_governance_audit
  drop constraint if exists platform_governance_audit_actor_role_check;

alter table public.platform_governance_audit
  add constraint platform_governance_audit_actor_role_check
  check (actor_role in ('owner', 'admin', 'member', 'viewer', 'service', 'none'));
