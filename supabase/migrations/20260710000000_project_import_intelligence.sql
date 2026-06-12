-- ═══════════════════════════════════════════════════════════════════════════════
-- Project Import Intelligence — AI Project Import Engine
--
-- Additive only. Users upload an existing project file (XLSX, CSV, JSON,
-- DOCX, PDF, TXT/MD), the system analyzes it, extracts entities into the
-- canonical import schema, validates them, and — after explicit user
-- approval — imports them into the universal execution model.
--
-- Tables:
--   1. project_import_jobs               (lifecycle + status)
--   2. project_import_raw_data           (extracted text/tables, 1:1 with job)
--   3. project_import_mappings           (source field → canonical field)
--   4. project_import_entities           (extracted entities w/ confidence)
--   5. project_import_validation_results (warnings/errors/recommendations)
--   6. project_import_audit_events       (import audit trail)
--   7. project_import_created_records    (rollback tracking: every row created
--      by an import, so a batch can be cleaned up by import_job_id)
--
-- Plus: 'project-imports' storage bucket and Living Graph CHECK extensions
-- (import_event node, project_import_jobs source, contains/imported_from edges).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. project_import_jobs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_jobs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  import_mode            text NOT NULL DEFAULT 'create_new'
                         CHECK (import_mode IN ('create_new','merge_existing')),
  source_file_name       text NOT NULL,
  source_file_type       text,                 -- xlsx | csv | json | docx | pdf | txt | md
  source_mime_type       text,
  source_file_size       bigint,
  storage_path           text,
  detected_project_type  text,
  selected_project_type  text,
  status                 text NOT NULL DEFAULT 'uploaded'
                         CHECK (status IN (
                           'uploaded','analyzing','mapped','needs_review',
                           'ready_to_import','importing','imported','failed','cancelled'
                         )),
  confidence_score       numeric(5,4),
  summary_json           jsonb NOT NULL DEFAULT '{}',
  error_message          text,
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at           timestamptz,
  deleted_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pij_org ON public.project_import_jobs (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pij_status ON public.project_import_jobs (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pij_project ON public.project_import_jobs (project_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.project_import_jobs IS
  'Project Import Intelligence: one row per uploaded project file and its analyze→review→import lifecycle.';

-- ── 2. project_import_raw_data ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_raw_data (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id            uuid NOT NULL REFERENCES public.project_import_jobs(id) ON DELETE CASCADE,
  raw_text                 text,
  raw_json                 jsonb,
  extracted_tables_json    jsonb NOT NULL DEFAULT '[]',
  extracted_sheets_json    jsonb NOT NULL DEFAULT '[]',
  extracted_metadata_json  jsonb NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (import_job_id)
);

CREATE INDEX IF NOT EXISTS idx_pird_job ON public.project_import_raw_data (import_job_id);

-- ── 3. project_import_mappings ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_mappings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id       uuid NOT NULL REFERENCES public.project_import_jobs(id) ON DELETE CASCADE,
  source_entity_type  text NOT NULL,           -- e.g. 'sheet:Tasks', 'table:2', 'json:tasks'
  source_field_name   text NOT NULL,           -- original column/key name
  target_entity_type  text NOT NULL,           -- canonical entity type
  target_field_name   text NOT NULL,           -- canonical field
  mapping_confidence  numeric(5,4),
  mapping_status      text NOT NULL DEFAULT 'auto'
                      CHECK (mapping_status IN ('auto','confirmed','overridden','rejected')),
  user_confirmed      boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pim_job ON public.project_import_mappings (import_job_id);

-- ── 4. project_import_entities ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_entities (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id             uuid NOT NULL REFERENCES public.project_import_jobs(id) ON DELETE CASCADE,
  entity_type               text NOT NULL
                            CHECK (entity_type IN (
                              'project','phase','milestone','work_package','task',
                              'dependency','resource','person','team','role','skill',
                              'material','equipment','budget_item','cost_item',
                              'risk','issue','rfi','submittal','procurement_item',
                              'schedule_item','document_reference','drawing_reference','decision'
                            )),
  source_key                text,              -- stable key within the import (e.g. task row id)
  extracted_json            jsonb NOT NULL DEFAULT '{}',
  normalized_json           jsonb NOT NULL DEFAULT '{}',
  confidence_score          numeric(5,4),
  source_reference          text,              -- e.g. 'Sheet "Tasks" row 12'
  validation_status         text NOT NULL DEFAULT 'valid'
                            CHECK (validation_status IN (
                              'valid','needs_review','invalid','duplicate','missing_required_data'
                            )),
  validation_warnings_json  jsonb NOT NULL DEFAULT '[]',
  will_import               boolean NOT NULL DEFAULT true,
  user_modified             boolean NOT NULL DEFAULT false,
  imported_entity_id        uuid,              -- id of the created row after import
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pie_job ON public.project_import_entities (import_job_id);
CREATE INDEX IF NOT EXISTS idx_pie_job_type ON public.project_import_entities (import_job_id, entity_type);

-- ── 5. project_import_validation_results ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_validation_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id         uuid NOT NULL REFERENCES public.project_import_jobs(id) ON DELETE CASCADE,
  severity              text NOT NULL DEFAULT 'warning'
                        CHECK (severity IN ('info','warning','error','blocker')),
  validation_type       text NOT NULL,          -- missing_owner | missing_duration | circular_dependency | duplicate | recommendation | …
  message               text NOT NULL,
  affected_entity_type  text,
  affected_entity_id    uuid REFERENCES public.project_import_entities(id) ON DELETE SET NULL,
  recommended_action    text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pivr_job ON public.project_import_validation_results (import_job_id);
CREATE INDEX IF NOT EXISTS idx_pivr_severity ON public.project_import_validation_results (import_job_id, severity);

-- ── 6. project_import_audit_events ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id   uuid NOT NULL REFERENCES public.project_import_jobs(id) ON DELETE CASCADE,
  event_type      text NOT NULL,                -- uploaded | analysis_started | analysis_completed | entity_toggled | import_started | import_completed | rolled_back | failed
  message         text,
  metadata_json   jsonb NOT NULL DEFAULT '{}',
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_piae_job ON public.project_import_audit_events (import_job_id, created_at);

-- ── 7. project_import_created_records (rollback tracking) ─────────────────────

CREATE TABLE IF NOT EXISTS public.project_import_created_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id   uuid NOT NULL REFERENCES public.project_import_jobs(id) ON DELETE CASCADE,
  entity_table    text NOT NULL,                -- e.g. 'roadmap_tasks', 'milestones', 'material_requirements'
  entity_id       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_picr_job ON public.project_import_created_records (import_job_id);

COMMENT ON TABLE public.project_import_created_records IS
  'Every record created by an import, so a whole batch is traceable and removable by import_job_id (safe-rollback strategy when DB transactions are not available through the API layer).';

-- ── 8. Storage bucket ─────────────────────────────────────────────────────────
-- Path convention: project-imports/{organization_id}/{job_id}/{filename}

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-imports', 'project-imports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org members can upload project imports" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read project imports" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete project imports" ON storage.objects;

CREATE POLICY "Org members can upload project imports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-imports'
  AND (storage.foldername(name))[1] = 'project-imports'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Org members can read project imports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-imports'
  AND (storage.foldername(name))[1] = 'project-imports'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Org members can delete project imports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-imports'
  AND (storage.foldername(name))[1] = 'project-imports'
  AND public.is_org_member(((storage.foldername(name))[2])::uuid)
);

-- ── 9. Living Graph CHECK extensions ──────────────────────────────────────────

ALTER TABLE public.process_nodes
  DROP CONSTRAINT IF EXISTS process_nodes_node_type_check;

ALTER TABLE public.process_nodes
  ADD CONSTRAINT process_nodes_node_type_check
  CHECK (node_type IN (
    'task_transition', 'decision_cascade', 'communication_flow',
    'document_link', 'milestone_gate', 'blocker_event',
    'labor_risk', 'drawing_event', 'drawing_insight',
    'resource_event', 'material_event', 'procurement_event',
    'budget_event', 'risk_event', 'rfi_event', 'submittal_event',
    'inspection_event', 'permit_event', 'critical_path_event',
    'import_event'
  ));

ALTER TABLE public.process_nodes
  DROP CONSTRAINT IF EXISTS process_nodes_source_entity_type_check;

ALTER TABLE public.process_nodes
  ADD CONSTRAINT process_nodes_source_entity_type_check
  CHECK (source_entity_type IN (
    'roadmap_tasks', 'decisions', 'communication_items',
    'meetings', 'documents', 'milestones',
    'construction_activities', 'drawing_files', 'drawing_insights',
    'resources', 'material_requirements', 'procurement_items',
    'budget_items', 'risks', 'rfis', 'submittals',
    'inspections', 'permits', 'critical_path_snapshots',
    'project_import_jobs'
  ));

ALTER TABLE public.process_edges
  DROP CONSTRAINT IF EXISTS process_edges_edge_type_check;

ALTER TABLE public.process_edges
  ADD CONSTRAINT process_edges_edge_type_check
  CHECK (edge_type IN (
    'caused', 'enabled', 'blocked', 'delayed', 'accelerated', 'informed',
    'labor_constrained', 'generated_insight', 'affects',
    'requires_material', 'requires_resource', 'requires_approval',
    'assigned_to', 'impacts_cost', 'impacts_procurement',
    'creates_risk', 'mitigates_risk', 'supplied_by',
    'contains', 'imported_from'
  ));

-- ── 10. Triggers + RLS ────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'project_import_jobs','project_import_raw_data','project_import_mappings',
    'project_import_entities','project_import_validation_results',
    'project_import_audit_events','project_import_created_records'
  ]
  LOOP
    -- updated_at trigger only where the column exists
    IF tbl IN ('project_import_jobs','project_import_mappings','project_import_entities') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
        tbl);
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Members can read %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can insert %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can update %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can delete %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Service role has full access on %s" ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "Members can read %s" ON public.%I FOR SELECT USING (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Members can insert %s" ON public.%I FOR INSERT WITH CHECK (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Members can update %s" ON public.%I FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Members can delete %s" ON public.%I FOR DELETE USING (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Service role has full access on %s" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      tbl, tbl);
  END LOOP;
END;
$$;
