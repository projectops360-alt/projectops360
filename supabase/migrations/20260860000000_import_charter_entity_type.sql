-- ============================================================================
-- Project Import Intelligence — allow 'charter' as an import entity type
-- ============================================================================
-- The import wizard now extracts the Project Charter sheet (key/value
-- "Field"/"Definition") into a single reviewable entity that fills the empty
-- fields of the project's Charter Center on execute. This only widens the
-- CHECK constraint on project_import_entities.entity_type; no data changes.
-- ============================================================================

ALTER TABLE public.project_import_entities
  DROP CONSTRAINT IF EXISTS project_import_entities_entity_type_check;

ALTER TABLE public.project_import_entities
  ADD CONSTRAINT project_import_entities_entity_type_check
  CHECK (entity_type IN (
    'project','phase','milestone','work_package','task',
    'dependency','resource','person','team','role','skill',
    'material','equipment','budget_item','cost_item',
    'risk','issue','rfi','submittal','procurement_item',
    'schedule_item','document_reference','drawing_reference','decision',
    'charter'
  ));
