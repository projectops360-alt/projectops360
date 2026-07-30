-- ============================================================================
-- ProjectOps360° — Time Tracking Engine · crew entries
-- ============================================================================
-- One entry may record a CREW instead of one person: "20 people, 10 hours each,
-- that day" is 200 man-hours of effort. Field crews are how construction work is
-- actually reported, and forcing 20 separate rows for one shift is bookkeeping
-- the product should do, not the PM.
--
-- duration_hours KEEPS meaning the TOTAL man-hours. That is the whole point: every
-- sum above this table (task rollup, project rollup, the report, Actual Cost and
-- the future EVM numbers) goes on working untouched, with no crew-aware special
-- case anywhere. The crew is recorded alongside it, not instead of it.
--
-- The 24-hour rule is not relaxed, it is RESTATED where it is actually true:
--   before → duration_hours <= 24            ("a day cannot hold more than a day")
--   after  → duration_hours <= 24 * crew_size ("...per person")
-- A 200h crew entry passes; claiming one person worked 200 hours in a day still
-- does not. hours_per_person carries the per-person figure so the constraint is
-- checkable and the number a PM entered is never lost to a multiplication.
-- ============================================================================

ALTER TABLE public.subtask_time_entries
  ADD COLUMN IF NOT EXISTS crew_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hours_per_person numeric(6,2);

-- Existing rows are individual entries by definition: crew 1, and the hours the
-- person worked ARE the stored duration. Done before the constraints so no
-- historical row can violate them.
UPDATE public.subtask_time_entries
SET hours_per_person = duration_hours
WHERE hours_per_person IS NULL;

-- ── Constraints ─────────────────────────────────────────────────────────────
ALTER TABLE public.subtask_time_entries
  DROP CONSTRAINT IF EXISTS subtask_time_entries_crew_size_range;
ALTER TABLE public.subtask_time_entries
  ADD CONSTRAINT subtask_time_entries_crew_size_range
  -- Upper bound is a typo guard, not a policy on how big a crew may be.
  CHECK (crew_size >= 1 AND crew_size <= 999);

ALTER TABLE public.subtask_time_entries
  DROP CONSTRAINT IF EXISTS subtask_time_entries_hours_per_person_range;
ALTER TABLE public.subtask_time_entries
  ADD CONSTRAINT subtask_time_entries_hours_per_person_range
  -- THE invariant: nobody works more than a day in a day.
  CHECK (hours_per_person IS NULL OR (hours_per_person > 0 AND hours_per_person <= 24));

-- The total must be consistent with the crew that produced it, so a hand-written
-- INSERT cannot store 200 man-hours as "1 person, 200 hours".
ALTER TABLE public.subtask_time_entries
  DROP CONSTRAINT IF EXISTS subtask_time_entries_crew_total_matches;
ALTER TABLE public.subtask_time_entries
  ADD CONSTRAINT subtask_time_entries_crew_total_matches
  CHECK (
    hours_per_person IS NULL
    OR ROUND(hours_per_person * crew_size, 2) = ROUND(duration_hours, 2)
  );

-- Replace the flat 24h ceiling with the per-person one.
ALTER TABLE public.subtask_time_entries
  DROP CONSTRAINT IF EXISTS subtask_time_entries_duration_range;
ALTER TABLE public.subtask_time_entries
  ADD CONSTRAINT subtask_time_entries_duration_range
  CHECK (duration_hours > 0 AND duration_hours <= 24 * crew_size);

-- ── Documentation ───────────────────────────────────────────────────────────
COMMENT ON COLUMN public.subtask_time_entries.crew_size IS
  'How many people the entry covers. 1 = an individual entry (the default and the historical case).';
COMMENT ON COLUMN public.subtask_time_entries.hours_per_person IS
  'Hours ONE person worked that day, capped at 24. duration_hours = hours_per_person * crew_size, so the total stays the man-hours every rollup sums.';
COMMENT ON COLUMN public.subtask_time_entries.duration_hours IS
  'TOTAL man-hours for this entry (hours_per_person * crew_size). Every effort rollup sums this column and needs no crew-aware special case. Bounded by 24 * crew_size — the per-person day, restated.';
