-- ============================================================================
-- ProjectOps360° — Which platform an implementation is on
-- Migration: 20260908000000_delivery_platform.sql
--
-- The wizard asked what KIND of project this is ("ERP / System Implementation")
-- and never which platform. That was enough until a vendor-specific methodology
-- appeared: SAP Activate belongs to SAP, and recommending it from `project_type
-- = 'erp'` alone would tell an Oracle or Dynamics customer to follow SAP's
-- methodology — confidently, and wrongly.
--
-- One column closes that gap, and it is what lets the recommendation engine
-- stay silent when it does not know: NULL means "not asked / not applicable",
-- never "assume SAP".
--
-- It also leaves room for the vendor methodologies that would otherwise need
-- the same guess later (Oracle OUM, Microsoft Sure Step).
--
-- ADDITIVE ONLY: nullable, no default, no existing row changes meaning.
-- Guarded by DELIVERY-PLATFORM.
-- ============================================================================

ALTER TABLE public.project_delivery_frameworks
  ADD COLUMN IF NOT EXISTS platform text
    CHECK (platform IS NULL OR platform IN (
      'sap', 'oracle', 'dynamics', 'salesforce', 'workday', 'other'
    ));

COMMENT ON COLUMN public.project_delivery_frameworks.platform IS
  'The product an implementation runs on, when that is what decides the methodology. NULL means not asked or not applicable — never assume a vendor from it.';
