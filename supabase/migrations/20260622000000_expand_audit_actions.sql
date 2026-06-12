-- ──────────────────────────────────────────────
-- Migration: Expand audit_logs action types for roadmap execution
-- Task: 4.8 — Add task status audit trail
-- ──────────────────────────────────────────────

-- Drop the old 3-value constraint
ALTER TABLE public.audit_logs
  DROP CONSTRAINT audit_logs_action_check;

-- Add expanded constraint with roadmap execution actions
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'create',
    'update',
    'delete',
    'task_status_changed',
    'prompt_copied',
    'prompt_sent_to_ai',
    'task_blocked',
    'task_completed',
    'task_unblocked'
  ));

-- Add index for roadmap task audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_roadmap_task
  ON public.audit_logs (entity_type, entity_id, created_at DESC)
  WHERE entity_type = 'roadmap_tasks';

COMMENT ON COLUMN public.audit_logs.action IS
  'Action performed: create | update | delete | task_status_changed | prompt_copied | prompt_sent_to_ai | task_blocked | task_completed | task_unblocked';

-- Rollback note: to revert, run:
-- ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_action_check;
-- ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN ('create', 'update', 'delete'));