-- ============================================================================
-- ProjectOps360° — Link tasks to the Project Team & Roles Center
-- Migration: 20260724000000_task_team_member_link.sql
--
-- Closes the "Tasks ↔ Team" connectivity gap: a roadmap task can now be owned
-- by a project_team_members entry (the people defined in Team & Roles), in
-- addition to the legacy workspace-user / resource assignment. Additive only.
-- ============================================================================

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS project_team_member_id uuid
    REFERENCES public.project_team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_team_member
  ON public.roadmap_tasks (project_team_member_id)
  WHERE project_team_member_id IS NOT NULL;
