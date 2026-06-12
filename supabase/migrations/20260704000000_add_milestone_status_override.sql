-- ============================================================================
-- ProjectOps360° — Add milestone status override fields
-- ============================================================================
-- Allows manual pinning of milestone status, independent of task completion.
-- When status_override_enabled = true, the computed status engine returns
-- status_override_value instead of deriving from task state.
-- ============================================================================

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS status_override_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_override_value text;

-- CHECK: when override is on, the value must be a valid MilestoneStatus;
--        when override is off, the value must be NULL.
ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_status_override_check CHECK (
    (status_override_enabled = true  AND status_override_value IN ('planned','in_progress','completed','blocked','deferred'))
    OR
    (status_override_enabled = false AND status_override_value IS NULL)
  );

-- Partial index for quickly finding overridden milestones per project
CREATE INDEX IF NOT EXISTS idx_milestones_status_override
  ON public.milestones (project_id)
  WHERE status_override_enabled = true AND deleted_at IS NULL;

COMMENT ON COLUMN public.milestones.status_override_enabled IS 'When true, milestone status is manually pinned and not auto-recalculated from task completion.';
COMMENT ON COLUMN public.milestones.status_override_value IS 'The manually-set status value, used only when status_override_enabled is true.';