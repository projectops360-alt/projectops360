-- ============================================================================
-- ProjectOps360° — Communication Log Enhancements (Task 1.2)
-- Migration: 20260612000000_communication_log_enhancements.sql
--
-- Changes:
--   1. Rename channel → source_type with extended enum values
--   2. Add summary_i18n (JSONB i18n field)
--   3. Add sender (text)
--   4. Add recipients (text)
--   5. Add requires_follow_up (boolean, default false)
--   6. Add status (text, CHECK: draft|logged, default 'logged')
--   7. Add related_stakeholder_ids (jsonb, default '[]')
--   8. Add indexes for filtering
-- ============================================================================

-- 1. Rename channel → source_type and widen the CHECK constraint
ALTER TABLE public.communication_items
  RENAME COLUMN channel TO source_type;

ALTER TABLE public.communication_items
  DROP CONSTRAINT communication_items_channel_check;

ALTER TABLE public.communication_items
  ADD CONSTRAINT communication_items_source_type_check
  CHECK (source_type IN (
    'email', 'meeting', 'phone', 'teams', 'slack',
    'in_person', 'document', 'manual_note', 'other'
  ));

-- 2. Add summary_i18n
ALTER TABLE public.communication_items
  ADD COLUMN summary_i18n jsonb NOT NULL DEFAULT '{}';

-- 3. Add sender
ALTER TABLE public.communication_items
  ADD COLUMN sender text;

-- 4. Add recipients
ALTER TABLE public.communication_items
  ADD COLUMN recipients text;

-- 5. Add requires_follow_up
ALTER TABLE public.communication_items
  ADD COLUMN requires_follow_up boolean NOT NULL DEFAULT false;

-- 6. Add status
ALTER TABLE public.communication_items
  ADD COLUMN status text NOT NULL DEFAULT 'logged'
  CHECK (status IN ('draft', 'logged'));

-- 7. Add related_stakeholder_ids
ALTER TABLE public.communication_items
  ADD COLUMN related_stakeholder_ids jsonb NOT NULL DEFAULT '[]';

-- 8. Add indexes for filtering
CREATE INDEX idx_comm_items_source_type
  ON public.communication_items (organization_id, source_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_comm_items_status
  ON public.communication_items (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_comm_items_requires_follow_up
  ON public.communication_items (organization_id, requires_follow_up)
  WHERE deleted_at IS NULL AND requires_follow_up = true;

-- Comments
COMMENT ON COLUMN public.communication_items.source_type IS
  'Communication source type: email | meeting | phone | teams | slack | in_person | document | manual_note | other';
COMMENT ON COLUMN public.communication_items.summary_i18n IS
  'i18n summary of the communication: {"en": "...", "es": "..."}';
COMMENT ON COLUMN public.communication_items.sender IS
  'Who sent the communication (free text)';
COMMENT ON COLUMN public.communication_items.recipients IS
  'Who received the communication (free text)';
COMMENT ON COLUMN public.communication_items.requires_follow_up IS
  'Flag indicating this communication needs follow-up action';
COMMENT ON COLUMN public.communication_items.status IS
  'Workflow status: draft | logged';
COMMENT ON COLUMN public.communication_items.related_stakeholder_ids IS
  'Array of stakeholder UUIDs related to this communication';