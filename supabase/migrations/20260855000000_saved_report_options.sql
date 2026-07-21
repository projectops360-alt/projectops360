-- Reports: persist additive report-builder options without changing existing
-- report definitions. Existing rows remain valid and default to no options.

ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS report_options_json jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.saved_reports.report_options_json IS
  'Optional report behavior such as {"includeSubtasks":true}; defaults preserve existing reports.';
