-- ============================================================================
-- SAP Activate as a delivery method
-- ============================================================================
-- `project_delivery_frameworks.delivery_method` carries a closed CHECK list, so
-- a new method cannot be stored until the constraint knows about it — the app
-- would offer SAP Activate in the wizard and the save would be rejected.
--
-- SAP Activate is not "predictive with SAP words". It is phase-gated like a
-- predictive plan, but each phase runs iteratively (fit-to-standard workshops,
-- build sprints, test cycles) and cannot close until its quality gate passes.
-- Neither `predictive` nor `hybrid` carries those gates, which is why a plan
-- imported from a real SAP programme had nowhere to say what governs it.
--
-- Additive only: every existing value stays valid, so no project is migrated
-- and nothing already stored becomes invalid.
-- ============================================================================

ALTER TABLE public.project_delivery_frameworks
  DROP CONSTRAINT IF EXISTS project_delivery_frameworks_delivery_method_check;

ALTER TABLE public.project_delivery_frameworks
  ADD CONSTRAINT project_delivery_frameworks_delivery_method_check
  CHECK (delivery_method = ANY (ARRAY[
    'predictive'::text,
    'agile'::text,
    'scrum'::text,
    'kanban'::text,
    'hybrid'::text,
    'xp'::text,
    'sap_activate'::text
  ]));

COMMENT ON COLUMN public.project_delivery_frameworks.delivery_method IS
  'How the project is executed. sap_activate is phase-gated: each phase closes with a formal quality gate (Q0…Q5) and runs iteratively inside.';
