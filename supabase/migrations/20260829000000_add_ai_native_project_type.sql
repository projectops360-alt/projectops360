-- ═══════════════════════════════════════════════════════════════════════════════
-- Future platform preparation — new project type: AI-Native Project Execution™
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds 'ai_native_execution' to the projects.project_type CHECK constraint so the
-- type can be SELECTED and STORED. This is identify-only: no AI-specific workflows,
-- no provider integrations, no schema beyond the allowed value. Fully backward
-- compatible — existing types and rows are untouched (default stays 'general').
-- Canonical owner of project types: src/types/execution.ts (ProjectType).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_project_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_project_type_check
  CHECK (project_type IN (
    'software_development', 'data_center_construction',
    'residential_construction', 'commercial_construction',
    'infrastructure', 'industrial', 'general',
    'ai_native_execution'
  ));
