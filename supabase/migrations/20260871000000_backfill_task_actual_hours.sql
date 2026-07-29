-- ============================================================================
-- ProjectOps360° — Time Tracking Engine · task actual_hours rollup backfill
-- ============================================================================
-- The engine shipped writing task_subtasks.actual_hours but never rolling the
-- total up to roadmap_tasks.actual_hours. Every task-level reader (task detail,
-- the execution map's parent node, the PMO Living Graph, the project dashboard's
-- effort card) therefore read a column nothing ever wrote and showed 0h while
-- hours sat in the log. The application side now refreshes both caches on every
-- mutation (refreshTaskActualHours); this migration repairs the rows that were
-- written before it did.
--
-- Same rule as before: roadmap_tasks.actual_hours is a DERIVED CACHE. The
-- entries are the source of truth and the cache is always rebuildable from them
-- — this statement IS that rebuild, and it is safe to run again at any time.
--
-- Deliberately NOT a trigger. The refresh is the engine's job, in the same
-- server action that already does the RBAC check, the audit entry and the event
-- emission; a trigger would put the same write in two places and quietly
-- recompute on imports and backfills that intend to set values themselves.
-- ============================================================================

-- Tasks that HAVE logged time: set the cache to the sum of the live entries.
-- One sum over task_id covers both levels at once, because every entry — task
-- level or subtask level — carries task_id. No addition of two subtotals, which
-- is where double counting would come from.
UPDATE public.roadmap_tasks AS t
SET actual_hours = e.total
FROM (
  SELECT task_id, ROUND(SUM(duration_hours)::numeric, 2) AS total
  FROM public.subtask_time_entries
  WHERE deleted_at IS NULL
  GROUP BY task_id
) AS e
WHERE e.task_id = t.id
  AND t.deleted_at IS NULL
  -- Skip rows already correct, so a re-run touches nothing and updated_at and
  -- any realtime subscribers stay quiet.
  AND (t.actual_hours IS DISTINCT FROM e.total);

-- Tasks whose only entries were soft-deleted would otherwise keep a stale cache
-- forever. Their true total is zero; NULL (never logged) is left alone so the
-- report can still tell "no time tracked" apart from "tracked, then removed".
UPDATE public.roadmap_tasks AS t
SET actual_hours = 0
WHERE t.deleted_at IS NULL
  AND t.actual_hours IS NOT NULL
  AND t.actual_hours <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.subtask_time_entries e
    WHERE e.task_id = t.id AND e.deleted_at IS NULL
  )
  -- Only tasks the engine has actually touched; a hand-typed pre-engine value on
  -- a task with no log is history the report still shows on purpose.
  AND EXISTS (
    SELECT 1 FROM public.subtask_time_entries e WHERE e.task_id = t.id
  );

COMMENT ON COLUMN public.roadmap_tasks.actual_hours IS
  'DERIVED CACHE of SUM(subtask_time_entries.duration_hours) for this task — its own entries and all of its subtasks'', each counted once. Written only by the Time Tracking Engine (guard TIME-TRACKING-TASK-ROLLUP); rebuildable from the entries, never the other way round.';
