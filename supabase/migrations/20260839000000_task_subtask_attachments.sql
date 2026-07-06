-- ============================================================================
-- ProjectOps360° — Task & Subtask File Attachments
-- Migration: 20260839000000_task_subtask_attachments.sql
--
-- Adds project_task_attachments: metadata for documents attached to a task OR
-- a subtask (exactly one parent). Binary files live in the PRIVATE storage
-- bucket 'project-attachments'; this table only ever stores metadata + the
-- storage path — never the file contents. ADDITIVE ONLY: nothing existing
-- changes; tasks/subtasks work unchanged when they have no attachments.
--
-- Guarded by TASK-SUBTASK-FILE-ATTACHMENTS. workspace scoping = organization_id
-- (tenant key) + project_id (project scope). Uploads run browser-side under the
-- user's session (storage RLS = can_access_project); the service role is never
-- exposed to the browser.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES public.task_subtasks(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_ext text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_bucket text NOT NULL DEFAULT 'project-attachments',
  storage_path text NOT NULL,
  checksum text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deleted', 'orphaned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Exactly one parent: a task OR a subtask, never both, never neither.
  CONSTRAINT project_task_attachments_one_parent CHECK (
    (task_id IS NOT NULL AND subtask_id IS NULL)
    OR
    (task_id IS NULL AND subtask_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_org_project
  ON public.project_task_attachments (organization_id, project_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_task_attachments_task
  ON public.project_task_attachments (task_id) WHERE task_id IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_task_attachments_subtask
  ON public.project_task_attachments (subtask_id) WHERE subtask_id IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploader
  ON public.project_task_attachments (uploaded_by) WHERE uploaded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_attachments_status
  ON public.project_task_attachments (status);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created
  ON public.project_task_attachments (created_at);

-- updated_at maintenance (same convention as task_subtasks / rythm tables)
CREATE OR REPLACE FUNCTION public.project_task_attachments_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_attachments_updated_at ON public.project_task_attachments;
CREATE TRIGGER trg_project_task_attachments_updated_at
  BEFORE UPDATE ON public.project_task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.project_task_attachments_touch_updated_at();

-- ── RLS: org members read; writes go through server actions (service role) ──
ALTER TABLE public.project_task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read task attachments" ON public.project_task_attachments;
CREATE POLICY "Members read task attachments"
  ON public.project_task_attachments FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on task attachments" ON public.project_task_attachments;
CREATE POLICY "Service role full access on task attachments"
  ON public.project_task_attachments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.project_task_attachments IS
  'Task & Subtask file attachments: metadata only (no binary). Exactly one parent (task_id XOR subtask_id). Files live in the private project-attachments bucket. storage_path follows projects/{projectId}/task|subtask/{parentId}/{attachmentId}-{safeName}.';

-- ============================================================================
-- Private storage bucket — project-attachments
-- Path convention: projects/{projectId}/task|subtask/{parentId}/{attachmentId}-{safeName}
-- so (storage.foldername(name))[1] = 'projects' and [2] = projectId, matching
-- the tested can_access_project() helper (introduced by the Rythm migration).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members upload project attachments" ON storage.objects;
DROP POLICY IF EXISTS "Members read project attachments"   ON storage.objects;
DROP POLICY IF EXISTS "Members delete project attachments" ON storage.objects;

CREATE POLICY "Members upload project attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'projects'
  AND public.can_access_project(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Members read project attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'projects'
  AND public.can_access_project(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Members delete project attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] = 'projects'
  AND public.can_access_project(((storage.foldername(name))[2])::uuid)
);
