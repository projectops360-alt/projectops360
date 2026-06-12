-- ============================================================================
-- ProjectOps360° — MVP-0 Baseline Schema
-- Migration: 20260607000000_mvp0_baseline.sql
--
-- 12 tables: organizations, profiles, organization_members, projects,
--            stakeholders, communication_items, meetings, decisions,
--            documents, traceability_links, ai_runs, action_items
--
-- Conventions:
--   • UUID primary keys with gen_random_uuid()
--   • organization_id FK on every business table (multi-tenant)
--   • i18n fields as JSONB: {"en": "...", "es": "..."}
--   • created_at / updated_at with auto-update trigger
--   • Soft delete via deleted_at (NULL = active)
--   • CHECK constraints for enums (text, not Postgres enum types)
--   • Partial indexes WHERE deleted_at IS NULL
--   • No RLS policies yet — will be added in a separate migration
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 1: Extensions & Utility Functions
-- ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at IS
  'Auto-update trigger: sets updated_at = now() on every row update.';

-- ──────────────────────────────────────────────
-- SECTION 2: organizations (Root Tenant)
-- ──────────────────────────────────────────────

CREATE TABLE public.organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text UNIQUE NOT NULL,
  name_i18n           jsonb NOT NULL DEFAULT '{}',
  description_i18n   jsonb DEFAULT '{}',
  avatar_url          text,
  plan                text NOT NULL DEFAULT 'free'
                      CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_organizations_slug
  ON public.organizations (slug)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.organizations IS
  'Root tenant entity. Every business record belongs to an organization.';
COMMENT ON COLUMN public.organizations.name_i18n IS
  'i18n name: {"en": "Acme Corp", "es": "Acme Corp"}';
COMMENT ON COLUMN public.organizations.plan IS
  'Subscription plan: free | pro | enterprise';

-- ──────────────────────────────────────────────
-- SECTION 3: profiles (User Extension — 1:1 with auth.users)
-- ──────────────────────────────────────────────

CREATE TABLE public.profiles (
  id                  uuid PRIMARY KEY
                      REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name       text,
  avatar_url         text,
  locale             text NOT NULL DEFAULT 'en'
                     CHECK (locale IN ('en', 'es')),
  timezone           text NOT NULL DEFAULT 'America/New_York',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_organization
  ON public.profiles (organization_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.profiles IS
  'Extends Supabase auth.users with app-specific profile data. 1:1 relationship.';
COMMENT ON COLUMN public.profiles.locale IS
  'Preferred UI locale: en | es';

-- ──────────────────────────────────────────────
-- SECTION 4: organization_members (Membership & Roles)
-- ──────────────────────────────────────────────

CREATE TABLE public.organization_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL
                      REFERENCES auth.users(id) ON DELETE CASCADE,
  role                text NOT NULL DEFAULT 'member'
                      CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_at          timestamptz,
  joined_at           timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org
  ON public.organization_members (organization_id);
CREATE INDEX idx_org_members_user
  ON public.organization_members (user_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.organization_members IS
  'Maps users to organizations with role-based access.';
COMMENT ON COLUMN public.organization_members.role IS
  'Role within this organization: owner | admin | member | viewer';

-- ──────────────────────────────────────────────
-- SECTION 5: projects (Core Project Entity)
-- ──────────────────────────────────────────────

CREATE TABLE public.projects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug                text NOT NULL,
  title_i18n          jsonb NOT NULL DEFAULT '{}',
  description_i18n   jsonb DEFAULT '{}',
  status              text NOT NULL DEFAULT 'planning'
                      CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date          date,
  target_end_date     date,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_projects_org
  ON public.projects (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status
  ON public.projects (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.projects IS
  'Central project entity. All major resources belong to a project.';
COMMENT ON COLUMN public.projects.title_i18n IS
  'i18n project title: {"en": "New Website", "es": "Nuevo Sitio Web"}';

-- ──────────────────────────────────────────────
-- SECTION 6: stakeholders
-- ──────────────────────────────────────────────

CREATE TABLE public.stakeholders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  name                text NOT NULL,
  role_i18n           jsonb DEFAULT '{}',
  email               text,
  influence           text CHECK (influence IN ('high', 'medium', 'low')),
  interest            text CHECK (interest IN ('high', 'medium', 'low')),
  notes_i18n          jsonb DEFAULT '{}',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_stakeholders_org
  ON public.stakeholders (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_stakeholders_project
  ON public.stakeholders (project_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.stakeholders IS
  'People or entities involved in or affected by a project.';
COMMENT ON COLUMN public.stakeholders.influence IS
  'Stakeholder influence level: high | medium | low';
COMMENT ON COLUMN public.stakeholders.interest IS
  'Stakeholder interest level: high | medium | low';

-- ──────────────────────────────────────────────
-- SECTION 7: meetings
-- ──────────────────────────────────────────────

CREATE TABLE public.meetings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  title_i18n          jsonb NOT NULL DEFAULT '{}',
  agenda_i18n         jsonb DEFAULT '{}',
  notes_i18n          jsonb DEFAULT '{}',
  meeting_date        timestamptz,
  duration_minutes    integer,
  location            text,
  status              text NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_meetings_org
  ON public.meetings (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_project
  ON public.meetings (project_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.meetings IS
  'Meeting records with agenda, notes, and status tracking.';
COMMENT ON COLUMN public.meetings.duration_minutes IS
  'Meeting duration in minutes (NULL = not yet determined)';

-- ──────────────────────────────────────────────
-- SECTION 8: decisions (Core for Decision Traceability)
-- ──────────────────────────────────────────────

CREATE TABLE public.decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  title_i18n          jsonb NOT NULL DEFAULT '{}',
  description_i18n   jsonb DEFAULT '{}',
  rationale_i18n      jsonb DEFAULT '{}',
  status              text NOT NULL DEFAULT 'proposed'
                      CHECK (status IN ('proposed', 'accepted', 'rejected', 'deferred', 'revoked')),
  decision_date       timestamptz,
  decided_by          uuid REFERENCES auth.users(id),
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_decisions_org
  ON public.decisions (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_decisions_project
  ON public.decisions (project_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_decisions_status
  ON public.decisions (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.decisions IS
  'Core decision traceability entity. Records what was decided, why, and by whom.';
COMMENT ON COLUMN public.decisions.rationale_i18n IS
  'i18n rationale for the decision: why this path was chosen.';

-- ──────────────────────────────────────────────
-- SECTION 9: communication_items
-- ──────────────────────────────────────────────

CREATE TABLE public.communication_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_id         uuid
                      REFERENCES public.meetings(id) ON DELETE SET NULL,
  title_i18n          jsonb NOT NULL DEFAULT '{}',
  content_i18n        jsonb DEFAULT '{}',
  channel             text
                      CHECK (channel IN ('email', 'slack', 'teams', 'in_person', 'document', 'other')),
  item_date           timestamptz,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_comm_items_org
  ON public.communication_items (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_comm_items_project
  ON public.communication_items (project_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.communication_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.communication_items IS
  'Communication records (emails, Slack messages, in-person conversations, etc.).';
COMMENT ON COLUMN public.communication_items.channel IS
  'Communication channel: email | slack | teams | in_person | document | other';

-- ──────────────────────────────────────────────
-- SECTION 10: documents
-- ──────────────────────────────────────────────

CREATE TABLE public.documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  title_i18n          jsonb NOT NULL DEFAULT '{}',
  description_i18n   jsonb DEFAULT '{}',
  file_url            text,
  file_type           text,
  version             integer NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_documents_org
  ON public.documents (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_project
  ON public.documents (project_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.documents IS
  'Document metadata and references. Files stored in Supabase Storage.';
COMMENT ON COLUMN public.documents.version IS
  'Document version number, incremented on each revision.';

-- ──────────────────────────────────────────────
-- SECTION 11: traceability_links (Polymorphic Entity Links)
-- ──────────────────────────────────────────────

CREATE TABLE public.traceability_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type         text NOT NULL
                      CHECK (source_type IN (
                        'decision', 'meeting', 'communication',
                        'document', 'action_item', 'stakeholder', 'project'
                      )),
  source_id           uuid NOT NULL,
  target_type         text NOT NULL
                      CHECK (target_type IN (
                        'decision', 'meeting', 'communication',
                        'document', 'action_item', 'stakeholder', 'project'
                      )),
  target_id           uuid NOT NULL,
  link_type           text NOT NULL DEFAULT 'related_to'
                      CHECK (link_type IN (
                        'related_to', 'caused_by', 'depends_on',
                        'supersedes', 'derived_from', 'contradicts'
                      )),
  context_i18n        jsonb DEFAULT '{}',
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_trace_links_org
  ON public.traceability_links (organization_id);
CREATE INDEX idx_trace_links_source
  ON public.traceability_links (source_type, source_id);
CREATE INDEX idx_trace_links_target
  ON public.traceability_links (target_type, target_id);

COMMENT ON TABLE public.traceability_links IS
  'Polymorphic links between entities for decision traceability and project memory.';
COMMENT ON COLUMN public.traceability_links.source_type IS
  'Entity type of the link source: decision | meeting | communication | document | action_item | stakeholder | project';
COMMENT ON COLUMN public.traceability_links.link_type IS
  'Relationship type: related_to | caused_by | depends_on | supersedes | derived_from | contradicts';
COMMENT ON COLUMN public.traceability_links.context_i18n IS
  'i18n context explaining why this link exists.';

-- ──────────────────────────────────────────────
-- SECTION 12: ai_runs (AI Audit Trail)
-- ──────────────────────────────────────────────

CREATE TABLE public.ai_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id),
  model               text NOT NULL,
  prompt_type         text NOT NULL
                      CHECK (prompt_type IN (
                        'summary', 'decision_analysis', 'stakeholder_mapping',
                        'risk_assessment', 'action_extraction', 'custom'
                      )),
  input_snapshot      jsonb NOT NULL DEFAULT '{}',
  output_snapshot     jsonb DEFAULT '{}',
  tokens_in          integer,
  tokens_out         integer,
  cost_usd           numeric(10, 6),
  latency_ms         integer,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  error_message       text,
  source_type         text
                      CHECK (source_type IN (
                        'decision', 'meeting', 'communication',
                        'document', 'action_item', 'project'
                      )),
  source_id           uuid,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_runs_org
  ON public.ai_runs (organization_id);
CREATE INDEX idx_ai_runs_user
  ON public.ai_runs (user_id);
CREATE INDEX idx_ai_runs_status
  ON public.ai_runs (organization_id, status);
CREATE INDEX idx_ai_runs_source
  ON public.ai_runs (source_type, source_id);

COMMENT ON TABLE public.ai_runs IS
  'Immutable audit trail for every AI invocation. Records input, output, cost, and latency.';
COMMENT ON COLUMN public.ai_runs.prompt_type IS
  'Category of AI prompt: summary | decision_analysis | stakeholder_mapping | risk_assessment | action_extraction | custom';
COMMENT ON COLUMN public.ai_runs.cost_usd IS
  'Estimated cost in USD with up to 6 decimal places.';
COMMENT ON COLUMN public.ai_runs.source_type IS
  'Optional: the entity type that triggered this AI run.';

-- ──────────────────────────────────────────────
-- SECTION 13: action_items
-- ──────────────────────────────────────────────

CREATE TABLE public.action_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_id         uuid
                      REFERENCES public.meetings(id) ON DELETE SET NULL,
  decision_id        uuid
                      REFERENCES public.decisions(id) ON DELETE SET NULL,
  ai_run_id          uuid
                      REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  title_i18n          jsonb NOT NULL DEFAULT '{}',
  description_i18n   jsonb DEFAULT '{}',
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority            text NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  due_date            date,
  assigned_to         uuid REFERENCES auth.users(id),
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_action_items_org
  ON public.action_items (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_action_items_project
  ON public.action_items (project_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_action_items_assigned
  ON public.action_items (assigned_to)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.action_items IS
  'Actionable items derived from meetings, decisions, or AI suggestions.';
COMMENT ON COLUMN public.action_items.ai_run_id IS
  'Optional: links to the AI run that suggested this action item.';
COMMENT ON COLUMN public.action_items.priority IS
  'Priority level: low | medium | high | critical';