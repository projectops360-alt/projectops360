-- ═══════════════════════════════════════════════════════════════════════════════
-- Reports — persist calculated fields on saved reports
-- Additive. Stores user/AI-defined formula columns alongside the report config.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS calculated_fields_json jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.saved_reports.calculated_fields_json IS
  'Calculated-field definitions [{key,label,expression,source}] evaluated by the formula engine at run time.';
