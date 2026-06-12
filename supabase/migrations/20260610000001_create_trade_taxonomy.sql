-- ═══════════════════════════════════════════════════════════════════════════════
-- Trade & Skill Taxonomy — Data Center Labor Risk Intelligence Lab
-- Creates: trade_taxonomy table with indexes, RLS policies, triggers, comments
-- Additive only — does not modify any existing table or data
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_taxonomy (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  trade_key         text NOT NULL,
  label_i18n        jsonb NOT NULL DEFAULT '{}',
  trade_type        text NOT NULL DEFAULT 'trade'
                      CHECK (trade_type IN (
                        'trade', 'skill', 'certification', 'specialist_role'
                      )),
  parent_key        text,
  metadata          jsonb NOT NULL DEFAULT '{}',
  order_index       integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trade_taxonomy_org
  ON public.trade_taxonomy (organization_id)
  WHERE deleted_at IS NULL;

-- Partial unique index: prevent duplicate trade_key per org+project among active rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_taxonomy_unique_key
  ON public.trade_taxonomy (organization_id, project_id, trade_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trade_taxonomy_project
  ON public.trade_taxonomy (project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trade_taxonomy_type
  ON public.trade_taxonomy (project_id, trade_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trade_taxonomy_parent
  ON public.trade_taxonomy (project_id, parent_key)
  WHERE deleted_at IS NULL AND parent_key IS NOT NULL;

-- ── GIN index for metadata JSONB queries ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trade_taxonomy_metadata
  ON public.trade_taxonomy USING gin (metadata)
  WHERE deleted_at IS NULL;

-- ── Triggers ────────────────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.trade_taxonomy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.trade_taxonomy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read trade_taxonomy" ON public.trade_taxonomy;
DROP POLICY IF EXISTS "Members can insert trade_taxonomy" ON public.trade_taxonomy;
DROP POLICY IF EXISTS "Members can update trade_taxonomy" ON public.trade_taxonomy;
DROP POLICY IF EXISTS "Members can delete trade_taxonomy" ON public.trade_taxonomy;
DROP POLICY IF EXISTS "Service role has full access on trade_taxonomy" ON public.trade_taxonomy;

CREATE POLICY "Members can read trade_taxonomy"
  ON public.trade_taxonomy
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert trade_taxonomy"
  ON public.trade_taxonomy
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update trade_taxonomy"
  ON public.trade_taxonomy
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete trade_taxonomy"
  ON public.trade_taxonomy
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on trade_taxonomy"
  ON public.trade_taxonomy
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Column comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.trade_taxonomy IS
  'Reference taxonomy for construction trades, skills, certifications, and specialist roles. Used by the Data Center Labor Risk Intelligence Lab.';
COMMENT ON COLUMN public.trade_taxonomy.trade_key IS
  'Stable identifier for the taxonomy entry: e.g. "electrical", "ups-oem-tech". Used as parent_key reference and in queries.';
COMMENT ON COLUMN public.trade_taxonomy.label_i18n IS
  'i18n display label: {"en": "Electrical", "es": "Eléctrico"}';
COMMENT ON COLUMN public.trade_taxonomy.trade_type IS
  'Category: trade (top-level), skill, certification, or specialist_role';
COMMENT ON COLUMN public.trade_taxonomy.parent_key IS
  'Hierarchical parent: skills/certs/roles reference their parent trade_key. Null for top-level trades.';
COMMENT ON COLUMN public.trade_taxonomy.metadata IS
  'Structured JSONB with skills[], certifications[], work_packages[], commissioning_relevance{}.';