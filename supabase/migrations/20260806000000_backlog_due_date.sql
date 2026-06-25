-- ============================================================================
-- Migration: 20260806000000_backlog_due_date.sql
-- ============================================================================
-- Adds a delivery/due date to work items (project_backlog_items) so a captured
-- or refined deadline is stored structurally — surfaced in Refinement and
-- carried to the task's end_date on promotion to the Workboard.
-- House conventions: ADD COLUMN IF NOT EXISTS (additive, idempotent).
-- ============================================================================

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.project_backlog_items.due_date IS
  'Target delivery / due date for the work item. Seeds the roadmap task end_date when the item is promoted to planning.';
