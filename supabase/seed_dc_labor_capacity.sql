-- ═══════════════════════════════════════════════════════════════════════════════
-- DCL-006 Seed: Compute labor capacity for DC Labor Risk project
-- ═══════════════════════════════════════════════════════════════════════════════

-- Compute capacity snapshots
SELECT compute_labor_capacity('dc100000-0000-4000-8000-000000000000');

-- Update DCL-006 task status
UPDATE roadmap_tasks
SET status          = 'implemented',
    progress       = 100,
    execution_notes = 'DCL-006 implemented: Created labor_weekly_capacity table with weekly required-vs-available headcount and hours by trade, week, and zone. Added compute_labor_capacity() function that computes gaps from construction_activities demand and labor_resources availability. Shortage risk classification: none/low/medium/high/critical. Critical path impact flag. Full RLS policies.',
    updated_at     = now()
WHERE project_id   = 'dc100000-0000-4000-8000-000000000000'
  AND external_key = 'DCL-006'
  AND deleted_at IS NULL;