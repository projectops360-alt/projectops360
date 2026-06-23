-- ============================================================================
-- ProjectOps360° — Work Refinement Center (Phase 3b): PMO governance approval
-- Migration: 20260804000000_refinement_governance.sql
--
-- Adds a lightweight governance-approval gate to the work item, used by PMO /
-- governance-style refinement templates before an item can move to planning.
-- Additive only.
-- ============================================================================

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS governance_status text NOT NULL DEFAULT 'not_required';
ALTER TABLE public.project_backlog_items
  DROP CONSTRAINT IF EXISTS project_backlog_items_governance_status_check;
ALTER TABLE public.project_backlog_items
  ADD CONSTRAINT project_backlog_items_governance_status_check
  CHECK (governance_status IN ('not_required','pending','approved','rejected'));

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS governance_approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS governance_approved_at timestamptz;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS governance_notes text;

COMMENT ON COLUMN public.project_backlog_items.governance_status IS
  'PMO governance approval gate: not_required (default) | pending | approved | rejected. Enforced before moving PMO/governance items to planning.';
