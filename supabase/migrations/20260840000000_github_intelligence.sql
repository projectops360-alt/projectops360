-- ============================================================================
-- ProjectOps360° — GitHub Intelligence Layer (software projects only)
-- Migration: 20260840000000_github_intelligence.sql
--
-- Read-only execution-evidence layer for SOFTWARE projects. GitHub activity
-- (commits, branches, PRs, workflow runs, deployments, releases) is normalized
-- into github_* snapshot tables and NEVER mutates canonical execution data
-- (tasks / milestones / risks / decisions). Every project-scoped table carries
-- organization_id + project_id so tenancy is enforced at the row level.
--
-- ADDITIVE ONLY — nothing existing changes. The feature is dark until
-- GITHUB_INTELLIGENCE_ENABLED=true AND the project_type is 'software_development'.
-- Rollback = unset the flag (data stays inert) or DROP the github_* tables.
--
-- Tenant key convention (matches the rest of the platform): organization_id.
-- Writes go through server actions / webhook route using the service role;
-- org members get read access via RLS (is_org_member).
-- ============================================================================

-- Shared updated_at trigger for every github_* table -------------------------
CREATE OR REPLACE FUNCTION public.github_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 1. github_app_configs ───────────────────────────────────────────────────
-- Platform / org GitHub App configuration. Sensitive values are stored
-- encrypted (app-layer envelope) — NEVER expose them through client payloads.
-- When setup_source='env' this row only holds non-sensitive metadata.
CREATE TABLE IF NOT EXISTS public.github_app_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_id text NOT NULL,
  app_slug text,
  app_name text,
  client_id text,
  encrypted_client_secret text,
  encrypted_private_key text,
  encrypted_webhook_secret text,
  setup_source text NOT NULL DEFAULT 'env'
    CHECK (setup_source IN ('env','manifest','manual')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_app_configs_org
  ON public.github_app_configs (organization_id) WHERE is_active;

-- ── 2. github_connection_states ─────────────────────────────────────────────
-- Short-lived nonce records for manifest setup / installation / repo-selection
-- OAuth-style redirects. Consumed exactly once; expired rows are ignored.
CREATE TABLE IF NOT EXISTS public.github_connection_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  flow_type text NOT NULL
    CHECK (flow_type IN ('manifest_setup','app_installation','repo_selection')),
  return_path text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_conn_states_lookup
  ON public.github_connection_states (state) WHERE consumed_at IS NULL;

-- ── 3. github_installations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  github_app_config_id uuid REFERENCES public.github_app_configs(id) ON DELETE SET NULL,
  installation_id bigint NOT NULL,
  account_login text,
  account_type text,
  connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_installations_project
  ON public.github_installations (project_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_github_installations_install
  ON public.github_installations (installation_id) WHERE is_active;

-- ── 4. github_repositories ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  github_installation_id uuid REFERENCES public.github_installations(id) ON DELETE CASCADE,
  github_repository_id bigint NOT NULL,
  owner text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  private boolean NOT NULL DEFAULT true,
  html_url text,
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error_code text,
  last_webhook_delivery_at timestamptz,
  webhook_delivery_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, github_repository_id)
);
CREATE INDEX IF NOT EXISTS idx_github_repos_project
  ON public.github_repositories (project_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_github_repos_ghid
  ON public.github_repositories (github_repository_id) WHERE is_active;

-- ── 5. github_activity_events ───────────────────────────────────────────────
-- Normalized, read-only evidence. payload_summary is the safe display shape;
-- raw_payload is optional and off by default (privacy / retention).
CREATE TABLE IF NOT EXISTS public.github_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  github_event_type text NOT NULL,
  github_action text,
  github_delivery_id text,
  github_node_id text,
  github_numeric_id bigint,
  actor_login text,
  ref text,
  branch_name text,
  sha text,
  title text,
  url text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, github_delivery_id)
);
CREATE INDEX IF NOT EXISTS idx_github_events_project_time
  ON public.github_activity_events (project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_events_repo_type
  ON public.github_activity_events (repository_id, github_event_type);

-- ── 6. github_branch_snapshots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_branch_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  branch_name text NOT NULL,
  branch_type text NOT NULL DEFAULT 'other'
    CHECK (branch_type IN ('main','feature','hotfix','release','other')),
  head_sha text,
  base_branch text,
  last_commit_at timestamptz,
  commit_count_window integer NOT NULL DEFAULT 0,
  open_pr_number integer,
  merged_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','merged','stale','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, branch_name)
);
CREATE INDEX IF NOT EXISTS idx_github_branches_project
  ON public.github_branch_snapshots (project_id, repository_id);

-- ── 7. github_pull_request_snapshots ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_pull_request_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  pr_number integer NOT NULL,
  title text,
  state text NOT NULL DEFAULT 'open'
    CHECK (state IN ('open','closed','merged')),
  draft boolean NOT NULL DEFAULT false,
  author_login text,
  source_branch text,
  target_branch text,
  opened_at timestamptz,
  updated_at_gh timestamptz,
  merged_at timestamptz,
  review_state text,
  checks_state text,
  files_changed integer,
  additions integer,
  deletions integer,
  html_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, pr_number)
);
CREATE INDEX IF NOT EXISTS idx_github_prs_project_state
  ON public.github_pull_request_snapshots (project_id, state);

-- ── 8. github_workflow_run_snapshots ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_workflow_run_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  workflow_run_id bigint NOT NULL,
  workflow_name text,
  branch_name text,
  head_sha text,
  status text,
  conclusion text,
  run_started_at timestamptz,
  completed_at timestamptz,
  html_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, workflow_run_id)
);
CREATE INDEX IF NOT EXISTS idx_github_wf_project
  ON public.github_workflow_run_snapshots (project_id, conclusion);

-- ── 9. github_release_snapshots ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_release_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  name text,
  target_commitish text,
  published_at timestamptz,
  prerelease boolean NOT NULL DEFAULT false,
  draft boolean NOT NULL DEFAULT false,
  html_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, tag_name)
);
CREATE INDEX IF NOT EXISTS idx_github_releases_project
  ON public.github_release_snapshots (project_id, published_at DESC);

-- ── 10. github_deployment_snapshots ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.github_deployment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  deployment_id bigint NOT NULL,
  environment text,
  ref text,
  sha text,
  state text,
  status_url text,
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, deployment_id)
);
CREATE INDEX IF NOT EXISTS idx_github_deploys_project
  ON public.github_deployment_snapshots (project_id, occurred_at DESC);

-- ── 11. github_project_links ────────────────────────────────────────────────
-- Future traceability between GitHub evidence and ProjectOps360° entities.
-- Table ready + read model; automatic linking stays conservative (branch/PR/
-- commit task-code detection only). NEVER mutates the linked project entity.
CREATE TABLE IF NOT EXISTS public.github_project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  github_entity_type text NOT NULL
    CHECK (github_entity_type IN ('branch','commit','pull_request','workflow_run','release','deployment')),
  github_entity_id text NOT NULL,
  project_entity_type text NOT NULL
    CHECK (project_entity_type IN ('task','milestone','risk','decision')),
  project_entity_id uuid NOT NULL,
  link_source text NOT NULL DEFAULT 'manual'
    CHECK (link_source IN ('manual','branch_pattern','pr_title','commit_message','isabella_suggestion')),
  confidence numeric(4,3),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, github_entity_type, github_entity_id, project_entity_type, project_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_github_links_project
  ON public.github_project_links (project_id, project_entity_type, project_entity_id);

-- ── updated_at triggers ─────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'github_app_configs','github_installations','github_repositories',
    'github_branch_snapshots','github_pull_request_snapshots',
    'github_workflow_run_snapshots','github_release_snapshots',
    'github_deployment_snapshots'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s '
      || 'FOR EACH ROW EXECUTE FUNCTION public.github_touch_updated_at();', t);
  END LOOP;
END $$;

-- ── RLS: org members read; service role writes (server actions / webhook) ────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'github_installations','github_repositories','github_activity_events',
    'github_branch_snapshots','github_pull_request_snapshots',
    'github_workflow_run_snapshots','github_release_snapshots',
    'github_deployment_snapshots','github_project_links'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%1$s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "Members read %1$s" ON public.%1$s FOR SELECT '
      || 'USING (public.is_org_member(organization_id));', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role all %1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "Service role all %1$s" ON public.%1$s FOR ALL '
      || 'USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'');', t);
  END LOOP;
END $$;

-- app_configs + connection_states: NEVER readable by clients (hold secrets /
-- nonces). Service role only. Public status is surfaced via server code.
ALTER TABLE public.github_app_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all github_app_configs" ON public.github_app_configs;
CREATE POLICY "Service role all github_app_configs"
  ON public.github_app_configs FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.github_connection_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all github_connection_states" ON public.github_connection_states;
CREATE POLICY "Service role all github_connection_states"
  ON public.github_connection_states FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.github_activity_events IS
  'GitHub Intelligence: normalized read-only execution evidence for software projects. Never mutates canonical tasks/milestones/risks/decisions.';
