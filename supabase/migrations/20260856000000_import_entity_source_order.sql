-- Preserve the canonical source order across bulk import persistence (REG-024).
-- PostgreSQL row-return order is undefined unless an explicit ordinal is stored
-- and requested. Existing NULL rows are legacy imports whose original order is
-- unknown; all new analyzer writes provide a unique zero-based source_order.

ALTER TABLE public.project_import_entities
  ADD COLUMN IF NOT EXISTS source_order integer;

COMMENT ON COLUMN public.project_import_entities.source_order IS
  'Stable zero-based ordinal from canonical extraction; controls deterministic import execution order.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_import_entities_job_source_order
  ON public.project_import_entities (import_job_id, source_order)
  WHERE source_order IS NOT NULL;
