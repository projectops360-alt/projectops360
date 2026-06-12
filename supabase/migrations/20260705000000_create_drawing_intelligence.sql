-- ═══════════════════════════════════════════════════════════════════════════════
-- Drawing Intelligence — Foundation Data Model (Prompt 1 of 5)
-- Creates the persistent structures for the AI Drawing Intelligence Engine:
-- files, pages, extractions, insights, versions, processing jobs and evidence.
-- No extraction pipeline yet — this is the storage + traceability foundation.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. drawing_files ─────────────────────────────────────────────────────────
-- Uploaded or connected drawing/model files. Source-agnostic: manual upload,
-- Autodesk APS, Procore, Google Drive, local files (no vendor lock-in).

CREATE TABLE public.drawing_files (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name             text NOT NULL,
  original_file_name    text,
  file_type             text,                    -- e.g. 'pdf', 'dwg', 'rvt', 'ifc'
  file_extension        text,
  mime_type             text,
  file_size             bigint,
  storage_path          text,                    -- Supabase Storage path (NULL for external sources)
  source_system         text NOT NULL DEFAULT 'manual_upload',  -- manual_upload | autodesk_aps | procore | google_drive | local
  source_external_id    text,                    -- ID in the source system
  source_version_id     text,                    -- version ID in the source system
  drawing_number        text,                    -- e.g. 'A-101'
  drawing_title         text,
  discipline            text,                    -- e.g. 'Architectural', 'Structural', 'MEP'
  revision              text,                    -- e.g. 'R3'
  revision_date         date,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','superseded','archived')),
  processing_status     text NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending','processing','completed','failed','needs_review','cancelled')),
  uploaded_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata              jsonb NOT NULL DEFAULT '{}',
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_files IS
  'Drawing Intelligence: uploaded or connected drawing/model files. Source-agnostic (manual, Autodesk APS, Procore, Google Drive, local).';

CREATE INDEX idx_dwf_org ON public.drawing_files (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwf_project ON public.drawing_files (project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwf_number ON public.drawing_files (project_id, drawing_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwf_processing ON public.drawing_files (project_id, processing_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwf_discipline ON public.drawing_files (project_id, discipline) WHERE deleted_at IS NULL;

-- ── 2. drawing_pages ─────────────────────────────────────────────────────────
-- Page-level information for PDF drawings or multi-sheet files.

CREATE TABLE public.drawing_pages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drawing_file_id       uuid NOT NULL REFERENCES public.drawing_files(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_number           integer NOT NULL,
  sheet_number          text,                    -- e.g. 'A-101'
  sheet_name             text,
  title_block_json      jsonb NOT NULL DEFAULT '{}',
  revision_block_json   jsonb NOT NULL DEFAULT '{}',
  detected_scale        text,
  detected_orientation  text,
  width                 numeric(10,2),
  height                numeric(10,2),
  image_preview_path    text,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_pages IS
  'Drawing Intelligence: per-page/sheet metadata for multi-page drawing files.';

CREATE INDEX idx_dwp_file ON public.drawing_pages (drawing_file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwp_project ON public.drawing_pages (project_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_dwp_unique ON public.drawing_pages (drawing_file_id, page_number) WHERE deleted_at IS NULL;

-- ── 3. drawing_extractions ───────────────────────────────────────────────────
-- Structured data extracted from drawings (filled by future extraction engines).

CREATE TABLE public.drawing_extractions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drawing_file_id         uuid NOT NULL REFERENCES public.drawing_files(id) ON DELETE CASCADE,
  drawing_page_id         uuid REFERENCES public.drawing_pages(id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  extraction_type         text NOT NULL,         -- title_block | general_notes | rooms | mep_elements | quantity_takeoff | rfi_candidates | … (open set)
  extracted_text          text,
  extracted_json          jsonb NOT NULL DEFAULT '{}',
  confidence_score        numeric(5,4),          -- 0..1
  source_coordinates_json jsonb NOT NULL DEFAULT '{}',
  evidence_json           jsonb NOT NULL DEFAULT '{}',
  model_used              text,                  -- e.g. 'claude-fable-5'
  extraction_status       text NOT NULL DEFAULT 'pending'
                          CHECK (extraction_status IN ('pending','processing','completed','failed','needs_review','cancelled')),
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_extractions IS
  'Drawing Intelligence: structured extraction results per drawing/page. extraction_type is an open set (title_block, general_notes, rooms, mep_elements, quantity_takeoff, rfi_candidates, risk_candidates, …).';

CREATE INDEX idx_dwe_file ON public.drawing_extractions (drawing_file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwe_project_type ON public.drawing_extractions (project_id, extraction_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwe_json ON public.drawing_extractions USING GIN (extracted_json) WHERE deleted_at IS NULL;

-- ── 4. drawing_insights ──────────────────────────────────────────────────────
-- AI-generated interpretations: risks, RFI candidates, submittal requirements,
-- schedule/cost impacts, contradictions, scope gaps, decisions required.

CREATE TABLE public.drawing_insights (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_file_id         uuid REFERENCES public.drawing_files(id) ON DELETE CASCADE,
  drawing_page_id         uuid REFERENCES public.drawing_pages(id) ON DELETE SET NULL,
  insight_type            text NOT NULL
                          CHECK (insight_type IN ('risk','rfi_candidate','submittal_requirement','schedule_impact','cost_impact','missing_information','contradiction','scope_gap','coordination_issue','version_change','decision_required')),
  title                   text NOT NULL,
  description             text,
  severity                text NOT NULL DEFAULT 'medium'
                          CHECK (severity IN ('low','medium','high','critical')),
  confidence_score        numeric(5,4),
  evidence_json           jsonb NOT NULL DEFAULT '{}',
  recommended_action      text,
  linked_task_id          uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  linked_risk_id          uuid,                  -- future risks table
  linked_rfi_id           uuid,                  -- future RFIs table
  linked_submittal_id     uuid,                  -- future submittals table
  linked_schedule_item_id uuid,                  -- future schedule items table
  status                  text NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','in_review','actioned','dismissed','resolved')),
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_insights IS
  'Drawing Intelligence: AI-generated interpretations of drawings with severity, confidence, evidence and links to tasks/risks/RFIs/submittals.';

CREATE INDEX idx_dwi_project_type ON public.drawing_insights (project_id, insight_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwi_file ON public.drawing_insights (drawing_file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwi_status ON public.drawing_insights (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwi_severity ON public.drawing_insights (project_id, severity) WHERE deleted_at IS NULL;

-- ── 5. drawing_versions ──────────────────────────────────────────────────────
-- Version history and comparison metadata between revisions of a drawing.

CREATE TABLE public.drawing_versions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_file_id           uuid NOT NULL REFERENCES public.drawing_files(id) ON DELETE CASCADE,
  previous_drawing_file_id  uuid REFERENCES public.drawing_files(id) ON DELETE SET NULL,
  drawing_number            text,
  previous_revision         text,
  current_revision          text,
  changed_pages_json        jsonb NOT NULL DEFAULT '[]',
  detected_deltas_json      jsonb NOT NULL DEFAULT '[]',
  summary                   text,
  deleted_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_versions IS
  'Drawing Intelligence: revision-to-revision comparison metadata (changed pages, detected deltas, summary).';

CREATE INDEX idx_dwv_project ON public.drawing_versions (project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwv_file ON public.drawing_versions (drawing_file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwv_number ON public.drawing_versions (project_id, drawing_number) WHERE deleted_at IS NULL;

-- ── 6. drawing_processing_jobs ───────────────────────────────────────────────
-- Background processing tracking for ingestion/extraction pipelines.

CREATE TABLE public.drawing_processing_jobs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_file_id           uuid REFERENCES public.drawing_files(id) ON DELETE CASCADE,
  job_type                  text NOT NULL,       -- e.g. 'ingest', 'page_split', 'title_block_extraction', 'insight_generation', 'version_compare'
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','completed','failed','needs_review','cancelled')),
  started_at                timestamptz,
  completed_at              timestamptz,
  error_message             text,
  retry_count               integer NOT NULL DEFAULT 0,
  processing_metadata_json  jsonb NOT NULL DEFAULT '{}',
  deleted_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_processing_jobs IS
  'Drawing Intelligence: background job tracking for ingestion and extraction pipelines.';

CREATE INDEX idx_dwj_project_status ON public.drawing_processing_jobs (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwj_file ON public.drawing_processing_jobs (drawing_file_id) WHERE deleted_at IS NULL;

-- ── 7. drawing_evidence ──────────────────────────────────────────────────────
-- Traceability: links any related entity (task, risk, RFI, insight, …) back to
-- the exact place in a drawing that supports it.

CREATE TABLE public.drawing_evidence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_file_id       uuid NOT NULL REFERENCES public.drawing_files(id) ON DELETE CASCADE,
  drawing_page_id       uuid REFERENCES public.drawing_pages(id) ON DELETE SET NULL,
  related_entity_type   text NOT NULL,           -- e.g. 'drawing_insight', 'roadmap_task', 'risk', 'rfi', 'submittal'
  related_entity_id     uuid NOT NULL,
  evidence_type         text NOT NULL DEFAULT 'text',  -- text | region | symbol | table | image_crop
  page_number           integer,
  coordinates_json      jsonb NOT NULL DEFAULT '{}',
  text_excerpt          text,
  image_crop_path       text,
  confidence_score      numeric(5,4),
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drawing_evidence IS
  'Drawing Intelligence: evidence references that trace any entity back to exact drawing locations (page, coordinates, excerpt, crop).';

CREATE INDEX idx_dwev_project ON public.drawing_evidence (project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwev_file ON public.drawing_evidence (drawing_file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dwev_entity ON public.drawing_evidence (related_entity_type, related_entity_id) WHERE deleted_at IS NULL;

-- ── 8. updated_at triggers ───────────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_extractions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drawing_evidence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 9. Row-Level Security ────────────────────────────────────────────────────
-- Same model as the rest of the app: org members can CRUD rows in their org,
-- service role has full access.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'drawing_files','drawing_pages','drawing_extractions','drawing_insights',
    'drawing_versions','drawing_processing_jobs','drawing_evidence'
  ]
  LOOP
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
