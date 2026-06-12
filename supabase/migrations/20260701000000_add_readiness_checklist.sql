-- ============================================================================
-- ProjectOps360° — Add readiness_checklist to construction_activities
-- ============================================================================
-- Adds a JSONB column to store workface readiness checklist items per activity.
-- Each activity can have up to 9 readiness criteria:
--   rfi_answered, submittal_approved, drawing_current, material_onsite,
--   area_released, permit_ready, predecessor_complete, qa_prerequisite, crew_assigned
--
-- Structure per item:
--   {
--     "item_key": "rfi_answered",
--     "label_i18n": {"en": "RFI Answered", "es": "RFI Respondida"},
--     "required": true,
--     "completed": false,
--     "completed_at": null,
--     "notes": ""
--   }
-- ============================================================================

ALTER TABLE public.construction_activities
  ADD COLUMN IF NOT EXISTS readiness_checklist jsonb NOT NULL DEFAULT '[]';

-- GIN index for JSONB queries on checklist items (e.g., finding incomplete required items)
CREATE INDEX IF NOT EXISTS idx_construction_activities_readiness_checklist
  ON public.construction_activities USING gin (readiness_checklist)
  WHERE deleted_at IS NULL;

-- Column comment documenting the structure
COMMENT ON COLUMN public.construction_activities.readiness_checklist IS
  'Workface readiness checklist items. JSONB array of objects with: item_key (rfi_answered|submittal_approved|drawing_current|material_onsite|area_released|permit_ready|predecessor_complete|qa_prerequisite|crew_assigned), label_i18n ({en,es}), required (boolean), completed (boolean), completed_at (ISO timestamp|null), notes (text).';