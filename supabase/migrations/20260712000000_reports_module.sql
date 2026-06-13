-- ═══════════════════════════════════════════════════════════════════════════════
-- Reports & Intelligence (Project Intelligence Studio)
--
-- Additive. Stores user-built report configurations and scaffolds run/export/
-- schedule tracking. Report configs reference curated dataset ids + column
-- keys (semantic layer) — never raw table names.
--
--   1. saved_reports       (the report definition: dataset + columns + config)
--   2. report_runs         (execution log)
--   3. report_exports      (export history)
--   4. report_schedules    (scheduled delivery scaffold)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.saved_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  report_name         text NOT NULL,
  report_description  text,
  dataset_id          text NOT NULL,
  category            text,
  visualization_type  text NOT NULL DEFAULT 'table',
  columns_json        jsonb NOT NULL DEFAULT '[]',
  filters_json        jsonb NOT NULL DEFAULT '[]',
  grouping_json       jsonb,
  sorting_json        jsonb NOT NULL DEFAULT '[]',
  visibility          text NOT NULL DEFAULT 'private'
                      CHECK (visibility IN ('private','project','organization')),
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_run_at         timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_org ON public.saved_reports (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_reports_project ON public.saved_reports (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_reports_dataset ON public.saved_reports (organization_id, dataset_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.saved_reports IS
  'User-built report definitions over curated datasets. columns_json/filters_json reference semantic dataset/column keys, never raw tables.';

CREATE TABLE IF NOT EXISTS public.report_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  saved_report_id   uuid REFERENCES public.saved_reports(id) ON DELETE SET NULL,
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  dataset_id        text,
  run_status        text NOT NULL DEFAULT 'completed'
                    CHECK (run_status IN ('completed','failed')),
  row_count         integer,
  run_duration_ms   integer,
  executed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message     text,
  executed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_runs_org ON public.report_runs (organization_id, executed_at DESC);

CREATE TABLE IF NOT EXISTS public.report_exports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  saved_report_id   uuid REFERENCES public.saved_reports(id) ON DELETE SET NULL,
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  report_name       text,
  export_format     text NOT NULL DEFAULT 'csv'
                    CHECK (export_format IN ('csv','xlsx','pdf','json')),
  row_count         integer,
  status            text NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed','failed')),
  exported_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message     text,
  exported_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_org ON public.report_exports (organization_id, exported_at DESC);

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  saved_report_id   uuid NOT NULL REFERENCES public.saved_reports(id) ON DELETE CASCADE,
  schedule_name     text NOT NULL,
  frequency         text NOT NULL DEFAULT 'weekly'
                    CHECK (frequency IN ('daily','weekly','monthly','custom')),
  recipients_json   jsonb NOT NULL DEFAULT '[]',
  export_format     text NOT NULL DEFAULT 'csv',
  enabled           boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_sent_at      timestamptz,
  next_run_at       timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON public.report_schedules (organization_id) WHERE deleted_at IS NULL;

-- ── Triggers + RLS ────────────────────────────────────────────────────────────

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['saved_reports','report_runs','report_exports','report_schedules']
  LOOP
    IF tbl IN ('saved_reports','report_schedules') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', tbl);
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', tbl);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can read %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can insert %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can update %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can delete %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Service role has full access on %s" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Members can read %s" ON public.%I FOR SELECT USING (public.is_org_member(organization_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY "Members can insert %s" ON public.%I FOR INSERT WITH CHECK (public.is_org_member(organization_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY "Members can update %s" ON public.%I FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY "Members can delete %s" ON public.%I FOR DELETE USING (public.is_org_member(organization_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY "Service role has full access on %s" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', tbl, tbl);
  END LOOP;
END;
$$;
