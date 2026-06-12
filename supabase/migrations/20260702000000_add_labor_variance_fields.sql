-- ============================================================================
-- ProjectOps360° — Add labor variance tracking fields to construction_activities
-- ============================================================================
-- Adds: actual_hours, planned_production_rate, actual_production_rate,
--       crew_size, rework_count as dedicated columns.
-- Adds: delay_reason_i18n as a key within the existing metadata JSONB column
--        (set via jsonb_set in seed data, not a dedicated column).
-- Adds: Partial index on actual_hours for variance dashboard queries.
-- Adds: Column comments documenting each field.
-- ============================================================================

-- 1. Add dedicated numeric columns
ALTER TABLE public.construction_activities
  ADD COLUMN IF NOT EXISTS actual_hours numeric(8,2)
    CHECK (actual_hours IS NULL OR actual_hours >= 0);

ALTER TABLE public.construction_activities
  ADD COLUMN IF NOT EXISTS planned_production_rate numeric(6,2)
    CHECK (planned_production_rate IS NULL OR planned_production_rate > 0);

ALTER TABLE public.construction_activities
  ADD COLUMN IF NOT EXISTS actual_production_rate numeric(6,2)
    CHECK (actual_production_rate IS NULL OR actual_production_rate >= 0);

ALTER TABLE public.construction_activities
  ADD COLUMN IF NOT EXISTS crew_size integer
    CHECK (crew_size IS NULL OR crew_size >= 0);

ALTER TABLE public.construction_activities
  ADD COLUMN IF NOT EXISTS rework_count integer NOT NULL DEFAULT 0
    CHECK (rework_count >= 0);

-- 2. Partial index for variance queries (find activities with actual hours tracked)
CREATE INDEX IF NOT EXISTS idx_construction_activities_actual_hours
  ON public.construction_activities (organization_id, actual_hours)
  WHERE deleted_at IS NULL AND actual_hours IS NOT NULL;

-- 3. Column comments
COMMENT ON COLUMN public.construction_activities.actual_hours IS
  'Actual labor hours spent on the activity. NULL means not yet tracked. Used for estimated vs. actual variance computation.';

COMMENT ON COLUMN public.construction_activities.planned_production_rate IS
  'Planned production rate in units per hour (e.g., cable trays/hour, conduit runs/hour). Used for productivity variance computation.';

COMMENT ON COLUMN public.construction_activities.actual_production_rate IS
  'Actual production rate achieved in units per hour. NULL means not yet measured. Ratio of actual/planned indicates productivity performance.';

COMMENT ON COLUMN public.construction_activities.crew_size IS
  'Actual crew size deployed (headcount). Different from required_crew_count which is the minimum planned. Used for labor efficiency analysis.';

COMMENT ON COLUMN public.construction_activities.rework_count IS
  'Number of rework cycles the activity has undergone. 0 means no rework. Incremented each time the activity requires re-execution due to quality or scope issues.';

COMMENT ON COLUMN public.construction_activities.metadata IS
  'Structured JSONB with additional activity context: risk_flags, notes_i18n, delay_reason_i18n, predecessor_summary, etc. delay_reason_i18n follows the I18nField pattern: {"en": "...", "es": "..."}';