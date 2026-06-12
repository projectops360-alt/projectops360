-- ═══════════════════════════════════════════════════════════════════════════════
-- Drawing Intelligence — AI Interpretation Layer (Prompt 4 of 5)
-- 1. drawing_insights: add 'inspection_requirement' insight type and the
--    review-workflow statuses (accepted / converted / linked).
-- 2. Living Graph: extend node/edge/source CHECKs with drawing types.
--    Also adds the labor values that exist in the TS types but were never
--    added to the DB CHECKs (latent silent-failure fix).
-- 3. ai_runs: add 'drawing_interpretation' prompt type.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. drawing_insights ──────────────────────────────────────────────────────

ALTER TABLE public.drawing_insights
  DROP CONSTRAINT IF EXISTS drawing_insights_insight_type_check;

ALTER TABLE public.drawing_insights
  ADD CONSTRAINT drawing_insights_insight_type_check
  CHECK (insight_type IN (
    'risk', 'rfi_candidate', 'submittal_requirement', 'inspection_requirement',
    'schedule_impact', 'cost_impact', 'missing_information', 'contradiction',
    'scope_gap', 'coordination_issue', 'version_change', 'decision_required'
  ));

ALTER TABLE public.drawing_insights
  DROP CONSTRAINT IF EXISTS drawing_insights_status_check;

ALTER TABLE public.drawing_insights
  ADD CONSTRAINT drawing_insights_status_check
  CHECK (status IN (
    'open', 'in_review', 'accepted', 'dismissed', 'converted', 'linked',
    'actioned', 'resolved'
  ));

COMMENT ON COLUMN public.drawing_insights.status IS
  'open=suggested, in_review=needs review, accepted, dismissed, converted (became another record), linked (attached to task/milestone), actioned/resolved (legacy)';

-- ── 2. Living Graph CHECK extensions ─────────────────────────────────────────

ALTER TABLE public.process_nodes
  DROP CONSTRAINT IF EXISTS process_nodes_node_type_check;

ALTER TABLE public.process_nodes
  ADD CONSTRAINT process_nodes_node_type_check
  CHECK (node_type IN (
    'task_transition', 'decision_cascade', 'communication_flow',
    'document_link', 'milestone_gate', 'blocker_event',
    'labor_risk',          -- existed in TS, missing in DB
    'drawing_event',       -- drawing ingested/processed
    'drawing_insight'      -- AI-generated drawing insight
  ));

ALTER TABLE public.process_nodes
  DROP CONSTRAINT IF EXISTS process_nodes_source_entity_type_check;

ALTER TABLE public.process_nodes
  ADD CONSTRAINT process_nodes_source_entity_type_check
  CHECK (source_entity_type IN (
    'roadmap_tasks', 'decisions', 'communication_items',
    'meetings', 'documents', 'milestones',
    'construction_activities',  -- existed in TS, missing in DB
    'drawing_files',
    'drawing_insights'
  ));

ALTER TABLE public.process_edges
  DROP CONSTRAINT IF EXISTS process_edges_edge_type_check;

ALTER TABLE public.process_edges
  ADD CONSTRAINT process_edges_edge_type_check
  CHECK (edge_type IN (
    'caused', 'enabled', 'blocked', 'delayed', 'accelerated', 'informed',
    'labor_constrained',   -- existed in TS, missing in DB
    'generated_insight',   -- drawing → insight
    'affects'              -- insight → task / milestone
  ));

-- ── 3. ai_runs prompt type ───────────────────────────────────────────────────

ALTER TABLE public.ai_runs
  DROP CONSTRAINT IF EXISTS ai_runs_prompt_type_check;

ALTER TABLE public.ai_runs
  ADD CONSTRAINT ai_runs_prompt_type_check
  CHECK (prompt_type IN (
    'summary', 'decision_analysis', 'stakeholder_mapping',
    'risk_assessment', 'action_extraction',
    'communication_history_summary',
    'drawing_interpretation',
    'custom'
  ));
