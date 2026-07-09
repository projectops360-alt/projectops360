-- ============================================================================
-- ProjectOps360° — Orphan organization cleanup (MANUAL, review before running)
-- ============================================================================
-- Context (verified against prod on 2026-07-08): 25 of 36 organizations had
-- 0 members AND 0 projects — leftovers from test signups whose auth user was
-- later deleted. The organization_members FK cascades on user deletion, but
-- nothing removed the personal org itself. Migration 20260841 adds the
-- on_auth_user_deleted trigger that prevents NEW orphans; this script cleans
-- up the ones that already exist.
--
-- HOW TO RUN (two steps, on purpose):
--   1. Run STEP 1 alone and review the report — every org listed will be
--      deleted in step 2. Nothing is modified.
--   2. If (and only if) the report matches expectations, run STEP 2 inside
--      the transaction block. It re-applies the exact same predicate, so orgs
--      that gained members/projects between the two steps are NOT touched.
--
-- Deleting an organization cascades to every org-scoped table (subscriptions,
-- teams, contacts, audit logs, …) — all FKs to organizations are ON DELETE
-- CASCADE except profiles.organization_id / default_organization_id, which
-- are ON DELETE SET NULL (an orphan org has no members, so at most a stale
-- profile pointer gets nulled; the self-healing ensure_user_org() re-homes
-- any such user on next login).
-- ============================================================================

-- ── STEP 1 — REPORT ONLY (no changes) ───────────────────────────────────────
select
  o.id,
  o.slug,
  o.name_i18n ->> 'en'                            as name_en,
  o.created_at,
  (select count(*) from public.subscriptions s
    where s.organization_id = o.id)               as subscriptions_to_cascade
from public.organizations o
where not exists (select 1 from public.organization_members om
                   where om.organization_id = o.id)
  and not exists (select 1 from public.projects p
                   where p.organization_id = o.id)
order by o.created_at;

-- ── STEP 2 — DELETE (run only after reviewing the report above) ─────────────
-- begin;
--
-- delete from public.organizations o
-- where not exists (select 1 from public.organization_members om
--                    where om.organization_id = o.id)
--   and not exists (select 1 from public.projects p
--                    where p.organization_id = o.id);
--
-- -- Expect the row count to match STEP 1's report. If it does:
-- commit;
-- -- Otherwise:
-- -- rollback;
