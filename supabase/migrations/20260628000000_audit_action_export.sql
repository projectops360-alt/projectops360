-- ──────────────────────────────────────────────
-- Migration: Add 'export' audit action (CAP — Project Export & Blueprint)
-- Records Full Archive / Starter Blueprint export events (no document contents).
-- ──────────────────────────────────────────────

ALTER TABLE public.audit_logs
  DROP CONSTRAINT audit_logs_action_check;

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
    'task_unblocked',
    'export'
  ));

COMMENT ON COLUMN public.audit_logs.action IS
  'Action performed: create | update | delete | task_status_changed | prompt_copied | prompt_sent_to_ai | task_blocked | task_completed | task_unblocked | export';

-- Rollback note: to revert, run:
-- ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_action_check;
-- ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
--   'create','update','delete','task_status_changed','prompt_copied','prompt_sent_to_ai','task_blocked','task_completed','task_unblocked'));
