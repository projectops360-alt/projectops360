-- ============================================================================
-- ProjectOps360° — Living Guide™ Phase 1 (People & Permissions MVP)
-- Migration: 20260814000000_living_guide_phase1.sql
--
-- Implements the REVISED architecture from docs/living-guide-architecture.md.
--
-- Non-negotiable rules honored here:
--   • NOT a fourth knowledge silo. A dedicated curated corpus on the SAME
--     pgvector substrate, with its OWN RPCs (match_knowledge / _lexical).
--     match_documents() is left untouched.
--   • Separation of concerns:
--       knowledge_packages          = logical unit
--       knowledge_package_versions  = IMMUTABLE, append-only source of truth
--       knowledge_localizations     = independent EN/ES localized rows
--       knowledge_chunks            = DERIVED, rebuildable (embeddings + tsv)
--   • Confidence + provenance are first-class:
--       confidence_tier on each version; knowledge_answers records the exact
--       chunks, package versions, prompt version, model, tier, score, ai_run.
--   • Multi-tenant safety: organization_id NULL = global/product knowledge,
--     readable by all; tenant overlays scoped by is_org_member().
--
-- Reuses existing infra: vector(1536), HNSW, is_org_member(), update_updated_at,
-- ai_runs audit (prompt_type widened with 'guide_coaching').
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- digest() for content hashing

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 1: knowledge_packages  (logical unit)
-- organization_id NULL  → global/product knowledge (all tenants can read)
-- organization_id set   → tenant-specific overlay (future; org-scoped)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_packages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug                text NOT NULL,
  domain              text NOT NULL DEFAULT 'people_permissions',
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'deprecated', 'archived')),
  superseded_by       uuid REFERENCES public.knowledge_packages(id),
  default_language    text NOT NULL DEFAULT 'en',
  product_version_min text NOT NULL DEFAULT '1.0',
  product_version_max text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- A slug is unique within its scope (global vs a given org).
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_packages_slug_global
  ON public.knowledge_packages (slug)
  WHERE organization_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_packages_slug_org
  ON public.knowledge_packages (organization_id, slug)
  WHERE organization_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_packages_domain
  ON public.knowledge_packages (domain, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.knowledge_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.knowledge_packages IS
  'Living Guide curated knowledge corpus. organization_id NULL = global/product knowledge readable by all tenants; set = tenant overlay. The logical unit; content lives in immutable versions.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 2: knowledge_package_versions  (IMMUTABLE, append-only)
-- Carries the confidence tier and authorship/review provenance.
-- A new edit = a new version row; old versions are retained for audit.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_package_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id        uuid NOT NULL REFERENCES public.knowledge_packages(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_no        integer NOT NULL DEFAULT 1,
  is_current        boolean NOT NULL DEFAULT true,
  confidence_tier   text NOT NULL DEFAULT 'ai_suggestion'
                    CHECK (confidence_tier IN (
                      'verified', 'organization_policy', 'best_practice',
                      'learned_pattern', 'ai_suggestion'
                    )),
  authored_by       uuid REFERENCES auth.users(id),
  reviewed_by       uuid REFERENCES auth.users(id),   -- required (by policy) to reach 'verified'
  source_refs       jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, version_no)
);

-- Exactly one current version per package.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpv_one_current
  ON public.knowledge_package_versions (package_id)
  WHERE is_current;

COMMENT ON TABLE public.knowledge_package_versions IS
  'Immutable, append-only versions of a knowledge package. confidence_tier classifies the source of truth (verified|organization_policy|best_practice|learned_pattern|ai_suggestion). Never UPDATE content here; create a new version.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 3: knowledge_localizations  (independent EN/ES rows)
-- One row per (version, language). English and Spanish are official,
-- independent localized records — never a single multilingual blob.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_localizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        uuid NOT NULL REFERENCES public.knowledge_package_versions(id) ON DELETE CASCADE,
  package_id        uuid NOT NULL REFERENCES public.knowledge_packages(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  language          text NOT NULL,            -- 'en' | 'es' | future; modeled as data
  title             text NOT NULL,
  body              text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, language)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_localizations_pkg
  ON public.knowledge_localizations (package_id, language);

COMMENT ON TABLE public.knowledge_localizations IS
  'Independent localized content rows (one per language per version). Retrieval matches the query language and answers are generated in-language.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 4: knowledge_chunks  (DERIVED, rebuildable artifacts)
-- Embeddings + lexical tsv. Always rebuildable from the immutable localization.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  localization_id   uuid NOT NULL REFERENCES public.knowledge_localizations(id) ON DELETE CASCADE,
  version_id        uuid NOT NULL REFERENCES public.knowledge_package_versions(id) ON DELETE CASCADE,
  package_id        uuid NOT NULL REFERENCES public.knowledge_packages(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  language          text NOT NULL,
  ordinal           integer NOT NULL DEFAULT 0,
  body              text NOT NULL,
  content_hash      text NOT NULL,            -- sha256(body) → idempotent re-embedding
  embedding         vector(1536),             -- NULL until indexed (lexical works regardless)
  embedding_model   text,
  embedding_dims    integer,
  index_status      text NOT NULL DEFAULT 'pending'
                    CHECK (index_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  -- Language-aware lexical vector (stemming + stopword removal per language);
  -- generated, always in sync. Query side must use the matching config.
  tsv               tsvector GENERATED ALWAYS AS (
                      to_tsvector(
                        CASE WHEN language = 'es' THEN 'spanish'::regconfig ELSE 'english'::regconfig END,
                        coalesce(body, '')
                      )
                    ) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv
  ON public.knowledge_chunks USING gin (tsv)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_version
  ON public.knowledge_chunks (version_id, language)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_chunks_hash
  ON public.knowledge_chunks (localization_id, content_hash)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.knowledge_chunks IS
  'DERIVED, rebuildable chunks: pgvector embedding (HNSW) + lexical tsv (GIN) for hybrid retrieval. content_hash makes re-embedding idempotent. Never the source of truth.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 5: knowledge_answers  (provenance — first-class, immutable)
-- One row per generated coaching answer. Ties into ai_runs.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_answers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id),
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  query_text        text NOT NULL,
  answer_language   text NOT NULL DEFAULT 'en',
  surface           text,                      -- where it was asked (module/screen)
  context_payload   jsonb NOT NULL DEFAULT '{}',-- module/screen/role/permissions/action
  intent            text,                      -- explain_screen | step_by_step | question | best_practices | common_mistakes
  retrieved_chunks  jsonb NOT NULL DEFAULT '[]',-- [{chunk_id, package_id, version_id, similarity, rank, tier}]
  package_versions  jsonb NOT NULL DEFAULT '[]',-- exact KP versions cited
  prompt_version    text,
  model             text,
  confidence_tier   text
                    CHECK (confidence_tier IS NULL OR confidence_tier IN (
                      'verified', 'organization_policy', 'best_practice',
                      'learned_pattern', 'ai_suggestion'
                    )),
  confidence_score  numeric(4,3),
  grounded          boolean NOT NULL DEFAULT false,  -- true = answered from retrieved KPs
  ai_run_id         uuid REFERENCES public.ai_runs(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_answers_org
  ON public.knowledge_answers (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_answers_user
  ON public.knowledge_answers (user_id, created_at DESC);

COMMENT ON TABLE public.knowledge_answers IS
  'Immutable provenance record for every Living Guide answer: query, context, retrieved chunks, cited KP versions, prompt version, model, confidence tier+score, and ai_run reference. Source of analytics and trust.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 6: guide_events  (append-only telemetry — NEVER vectorized)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guide_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id),
  answer_id         uuid REFERENCES public.knowledge_answers(id) ON DELETE SET NULL,
  event_type        text NOT NULL
                    CHECK (event_type IN (
                      'opened', 'asked', 'answered', 'no_answer',
                      'feedback_helpful', 'feedback_unhelpful',
                      'source_viewed', 'quick_action', 'error'
                    )),
  query_hash        text,
  surface           text,
  role              text,
  metadata          jsonb NOT NULL DEFAULT '{}',
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guide_events_org
  ON public.guide_events (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_guide_events_type
  ON public.guide_events (event_type, occurred_at DESC);

COMMENT ON TABLE public.guide_events IS
  'Append-only Living Guide telemetry for the learning loop. Never embedded, never part of the corpus.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 7: Row Level Security
-- Curated corpus: global rows (organization_id IS NULL) readable by all
-- authenticated users; tenant overlays via is_org_member(). Writes are
-- service_role only in Phase 1 (seeding + governed authoring via admin client).
-- Answers/events: members read/insert within their org.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.knowledge_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_package_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_localizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_answers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_events                ENABLE ROW LEVEL SECURITY;

-- Read policies (global OR own-org) for the four corpus tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'knowledge_packages','knowledge_package_versions',
    'knowledge_localizations','knowledge_chunks'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Read curated knowledge" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "Read curated knowledge" ON public.%I FOR SELECT
         USING (organization_id IS NULL OR public.is_org_member(organization_id));', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role manages knowledge" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "Service role manages knowledge" ON public.%I FOR ALL
         USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'');', t);
  END LOOP;
END $$;

-- knowledge_answers: members read + insert within their org
DROP POLICY IF EXISTS "Members read answers" ON public.knowledge_answers;
CREATE POLICY "Members read answers" ON public.knowledge_answers
  FOR SELECT USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "Members insert answers" ON public.knowledge_answers;
CREATE POLICY "Members insert answers" ON public.knowledge_answers
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "Service role manages answers" ON public.knowledge_answers;
CREATE POLICY "Service role manages answers" ON public.knowledge_answers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- guide_events: members read + insert within their org
DROP POLICY IF EXISTS "Members read events" ON public.guide_events;
CREATE POLICY "Members read events" ON public.guide_events
  FOR SELECT USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "Members insert events" ON public.guide_events;
CREATE POLICY "Members insert events" ON public.guide_events
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));
DROP POLICY IF EXISTS "Service role manages events" ON public.guide_events;
CREATE POLICY "Service role manages events" ON public.guide_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 8: Widen ai_runs.prompt_type with 'guide_coaching'
-- (preserve every existing value)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_runs DROP CONSTRAINT IF EXISTS ai_runs_prompt_type_check;
ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_prompt_type_check
  CHECK (prompt_type IN (
    'summary', 'decision_analysis', 'stakeholder_mapping',
    'risk_assessment', 'action_extraction',
    'communication_history_summary', 'drawing_interpretation',
    'memory_classification', 'guide_coaching', 'custom'
  ));

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 9: Dedicated retrieval RPCs (DO NOT overload match_documents)
-- ──────────────────────────────────────────────────────────────────────────

-- 9a. Semantic (vector) retrieval over the curated corpus.
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding         vector(1536),
  filter_organization_id  uuid,
  filter_language         text DEFAULT NULL,
  match_threshold         float DEFAULT 0.6,
  match_count             int DEFAULT 8
)
RETURNS TABLE (
  chunk_id        uuid,
  package_id      uuid,
  version_id      uuid,
  slug            text,
  language        text,
  title           text,
  body            text,
  confidence_tier text,
  similarity      float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id, c.package_id, c.version_id, p.slug, c.language,
    l.title, c.body, v.confidence_tier,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_package_versions v ON v.id = c.version_id AND v.is_current
  JOIN public.knowledge_packages p          ON p.id = c.package_id
  JOIN public.knowledge_localizations l     ON l.id = c.localization_id
  WHERE c.embedding IS NOT NULL
    AND c.deleted_at IS NULL
    AND p.status = 'published'
    AND p.deleted_at IS NULL
    AND (p.organization_id IS NULL OR p.organization_id = filter_organization_id)
    AND (filter_language IS NULL OR c.language = filter_language)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_knowledge IS
  'Living Guide semantic retrieval. Returns chunks from PUBLISHED packages that are global (organization_id IS NULL) or owned by the caller org. Never touches match_documents.';

-- 9b. Lexical (keyword) retrieval — the other half of hybrid search.
CREATE OR REPLACE FUNCTION public.match_knowledge_lexical(
  query_text              text,
  filter_organization_id  uuid,
  filter_language         text DEFAULT NULL,
  match_count             int DEFAULT 8
)
RETURNS TABLE (
  chunk_id        uuid,
  package_id      uuid,
  version_id      uuid,
  slug            text,
  language        text,
  title           text,
  body            text,
  confidence_tier text,
  rank            float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id, c.package_id, c.version_id, p.slug, c.language,
    l.title, c.body, v.confidence_tier,
    ts_rank_cd(
      c.tsv,
      websearch_to_tsquery(
        CASE WHEN filter_language = 'es' THEN 'spanish'::regconfig ELSE 'english'::regconfig END,
        query_text
      )
    )::float AS rank
  FROM public.knowledge_chunks c
  JOIN public.knowledge_package_versions v ON v.id = c.version_id AND v.is_current
  JOIN public.knowledge_packages p          ON p.id = c.package_id
  JOIN public.knowledge_localizations l     ON l.id = c.localization_id
  WHERE c.deleted_at IS NULL
    AND p.status = 'published'
    AND p.deleted_at IS NULL
    AND (p.organization_id IS NULL OR p.organization_id = filter_organization_id)
    AND (filter_language IS NULL OR c.language = filter_language)
    AND c.tsv @@ websearch_to_tsquery(
      CASE WHEN filter_language = 'es' THEN 'spanish'::regconfig ELSE 'english'::regconfig END,
      query_text
    )
  ORDER BY rank DESC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_knowledge_lexical IS
  'Living Guide lexical retrieval (tsvector). Works even before embeddings are generated, so hybrid search degrades gracefully.';

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 10: Seed — 11 People & Permissions packages, EN + ES
-- Content (packages/versions/localizations) is the immutable source of truth.
-- Chunks are DERIVED here deterministically (one chunk per localization for the
-- MVP); embeddings are filled later by the indexer (idempotent via content_hash).
-- ──────────────────────────────────────────────────────────────────────────

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'people-what-is',             'people_permissions', 'published', 'en'),
    (NULL, 'roles-what-are',             'people_permissions', 'published', 'en'),
    (NULL, 'permissions-what-are',       'people_permissions', 'published', 'en'),
    (NULL, 'pmo-can-see',                'people_permissions', 'published', 'en'),
    (NULL, 'pm-can-see',                 'people_permissions', 'published', 'en'),
    (NULL, 'team-member-can-see',        'people_permissions', 'published', 'en'),
    (NULL, 'how-create-user',            'people_permissions', 'published', 'en'),
    (NULL, 'how-assign-role',            'people_permissions', 'published', 'en'),
    (NULL, 'how-restrict-project-access','people_permissions', 'published', 'en'),
    (NULL, 'common-permission-mistakes', 'people_permissions', 'published', 'en'),
    (NULL, 'why-cannot-see-project',     'people_permissions', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, '["RBAC model: 20260807_rbac_org_roles, 20260808_project_scoped_rls"]'::jsonb
  FROM pkg p
  JOIN (VALUES
    ('people-what-is','verified'),
    ('roles-what-are','verified'),
    ('permissions-what-are','verified'),
    ('pmo-can-see','verified'),
    ('pm-can-see','verified'),
    ('team-member-can-see','verified'),
    ('how-create-user','verified'),
    ('how-assign-role','verified'),
    ('how-restrict-project-access','verified'),
    ('common-permission-mistakes','best_practice'),
    ('why-cannot-see-project','verified')
  ) AS t(slug, tier) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    -- 1. What is the People module?
    ('people-what-is','en','What is the People module?',
     'The People module is where you manage everyone who participates in your organization and its projects: workspace users, project team members, crews, vendors, and external stakeholders. From here you control who exists in the workspace and, together with roles and permissions, what each person is allowed to see and do. People added to a project team are operational and do not consume a paid seat; only workspace users with an organization role do.'),
    ('people-what-is','es','¿Qué es el módulo de Personas?',
     'El módulo de Personas es donde gestionas a todos los que participan en tu organización y sus proyectos: usuarios del espacio de trabajo, miembros de equipo de proyecto, cuadrillas, proveedores y stakeholders externos. Desde aquí controlas quién existe en el espacio de trabajo y, junto con los roles y permisos, qué puede ver y hacer cada persona. Las personas agregadas al equipo de un proyecto son operativas y no consumen un asiento pagado; solo los usuarios del espacio de trabajo con un rol de organización lo hacen.'),
    -- 2. What are roles?
    ('roles-what-are','en','What are roles?',
     'A role is the level of authority a person holds. ProjectOps360 enforces eight organization roles: Company Owner, PMO Admin, Portfolio Manager, Project Manager, Team Member, Stakeholder, Client, and Viewer. The first three are PMO-level roles that can see every project in the organization and the PMO Center. Project Managers manage the projects they are assigned to. Team Members contribute to the work assigned to them. Stakeholders, Clients, and Viewers have limited, mostly read-only access. Your role is the source of truth for what you can access.'),
    ('roles-what-are','es','¿Qué son los roles?',
     'Un rol es el nivel de autoridad que tiene una persona. ProjectOps360 aplica ocho roles de organización: Propietario de la empresa, Administrador PMO, Gerente de portafolio, Gerente de proyecto, Miembro del equipo, Stakeholder, Cliente y Observador. Los primeros tres son roles de nivel PMO que pueden ver todos los proyectos de la organización y el Centro PMO. Los Gerentes de proyecto gestionan los proyectos que les son asignados. Los Miembros del equipo contribuyen al trabajo que se les asigna. Stakeholders, Clientes y Observadores tienen acceso limitado, en su mayoría de solo lectura. Tu rol es la fuente de verdad de lo que puedes acceder.'),
    -- 3. What are permissions?
    ('permissions-what-are','en','What are permissions?',
     'Permissions are the specific actions a role allows, such as viewing a project, editing tasks, managing team members, approving work, or managing billing. In ProjectOps360 permissions are derived from your organization role and your access to a specific project, and they are enforced both in the interface and at the database level through Row Level Security. This means a person cannot bypass the interface to reach data their role does not permit. Permissions are checked on every action, not only when a screen loads.'),
    ('permissions-what-are','es','¿Qué son los permisos?',
     'Los permisos son las acciones específicas que un rol permite, como ver un proyecto, editar tareas, gestionar miembros del equipo, aprobar trabajo o gestionar la facturación. En ProjectOps360 los permisos se derivan de tu rol de organización y de tu acceso a un proyecto específico, y se aplican tanto en la interfaz como en la base de datos mediante Row Level Security. Esto significa que una persona no puede saltarse la interfaz para llegar a datos que su rol no permite. Los permisos se verifican en cada acción, no solo al cargar una pantalla.'),
    -- 4. What can a PMO see?
    ('pmo-can-see','en','What can a PMO see?',
     'A PMO-level user (Company Owner, PMO Admin, or Portfolio Manager) has organization-wide visibility. They can see every project in the organization, open the PMO Center, view portfolio-level reporting, and manage organization settings, members, and billing depending on their exact role. PMO Admins and Company Owners can invite users and assign roles. This broad visibility exists so leadership can oversee the whole portfolio; it should be granted carefully because it bypasses per-project restrictions.'),
    ('pmo-can-see','es','¿Qué puede ver un PMO?',
     'Un usuario de nivel PMO (Propietario de la empresa, Administrador PMO o Gerente de portafolio) tiene visibilidad en toda la organización. Puede ver todos los proyectos de la organización, abrir el Centro PMO, ver reportes a nivel de portafolio y gestionar la configuración de la organización, los miembros y la facturación según su rol exacto. Los Administradores PMO y los Propietarios pueden invitar usuarios y asignar roles. Esta visibilidad amplia existe para que el liderazgo supervise todo el portafolio; debe otorgarse con cuidado porque omite las restricciones por proyecto.'),
    -- 5. What can a Project Manager see?
    ('pm-can-see','en','What can a Project Manager see?',
     'A Project Manager sees and manages the projects they are assigned to, not the entire organization. Within their projects they can manage the team, assign tasks, edit the plan, manage risks, run reports, and approve work. They do not automatically see other projects in the organization, and they do not have PMO Center or billing access. If a Project Manager needs to see another project, they must be added to that project team.'),
    ('pm-can-see','es','¿Qué puede ver un Gerente de proyecto?',
     'Un Gerente de proyecto ve y gestiona los proyectos que le son asignados, no toda la organización. Dentro de sus proyectos puede gestionar el equipo, asignar tareas, editar el plan, gestionar riesgos, generar reportes y aprobar trabajo. No ve automáticamente otros proyectos de la organización y no tiene acceso al Centro PMO ni a la facturación. Si un Gerente de proyecto necesita ver otro proyecto, debe ser agregado al equipo de ese proyecto.'),
    -- 6. What can a Team Member see?
    ('team-member-can-see','en','What can a Team Member see?',
     'A Team Member (contributor) sees only the projects they belong to and works mainly on the tasks assigned to them. They can move and edit their own tasks on the workboard but cannot edit tasks that belong to other people, manage the team, or change project-wide settings. This deliberate restriction keeps contributors focused and protects the plan. If a Team Member cannot see a project, it is usually because they have not been added to that project team.'),
    ('team-member-can-see','es','¿Qué puede ver un Miembro del equipo?',
     'Un Miembro del equipo (contribuyente) ve solo los proyectos a los que pertenece y trabaja principalmente en las tareas que se le asignan. Puede mover y editar sus propias tareas en el tablero, pero no puede editar tareas que pertenecen a otras personas, gestionar el equipo ni cambiar la configuración del proyecto. Esta restricción deliberada mantiene enfocados a los contribuyentes y protege el plan. Si un Miembro del equipo no puede ver un proyecto, normalmente es porque no ha sido agregado al equipo de ese proyecto.'),
    -- 7. How to create a user
    ('how-create-user','en','How to create a user',
     'To add a person as a workspace user, open the People module and invite them by email. When they accept, a profile and an organization membership are created for them. Adding someone as a workspace user assigns them an organization role and may consume a paid seat depending on the role. If you only need someone to appear on a project team without a login, add them as a project team person instead, which does not create a user or consume a seat.'),
    ('how-create-user','es','Cómo crear un usuario',
     'Para agregar a una persona como usuario del espacio de trabajo, abre el módulo de Personas e invítala por correo electrónico. Cuando acepte, se crean un perfil y una membresía de organización. Agregar a alguien como usuario del espacio de trabajo le asigna un rol de organización y puede consumir un asiento pagado según el rol. Si solo necesitas que alguien aparezca en el equipo de un proyecto sin inicio de sesión, agrégalo como persona del equipo de proyecto, lo cual no crea un usuario ni consume un asiento.'),
    -- 8. How to assign a role
    ('how-assign-role','en','How to assign a role',
     'Roles are assigned from the People module by a PMO Admin or Company Owner. Open the member you want to change and select their organization role. Choose the least powerful role that still lets the person do their job: grant PMO-level roles only to leadership who must see the whole portfolio, Project Manager to those who run projects, and Team Member to contributors. Changing a role takes effect immediately and is enforced everywhere, including the database.'),
    ('how-assign-role','es','Cómo asignar un rol',
     'Los roles se asignan desde el módulo de Personas por un Administrador PMO o un Propietario de la empresa. Abre el miembro que quieres cambiar y selecciona su rol de organización. Elige el rol menos poderoso que aún le permita a la persona hacer su trabajo: otorga roles de nivel PMO solo al liderazgo que debe ver todo el portafolio, Gerente de proyecto a quienes dirigen proyectos y Miembro del equipo a los contribuyentes. Cambiar un rol surte efecto de inmediato y se aplica en todas partes, incluida la base de datos.'),
    -- 9. How to restrict project access
    ('how-restrict-project-access','en','How to restrict project access',
     'Project access is controlled by project membership, not only by organization role. To restrict who can see a project, keep its team limited to the people who need it and avoid granting PMO-level roles to anyone who should not see the whole portfolio. Remember that PMO-level users see every project regardless of team membership, so the way to keep a sensitive project limited to a small group is to add only the Project Managers and Team Members who belong to it, and to ensure no unnecessary PMO-level roles exist.'),
    ('how-restrict-project-access','es','Cómo restringir el acceso a un proyecto',
     'El acceso a un proyecto se controla por la membresía del proyecto, no solo por el rol de organización. Para restringir quién puede ver un proyecto, manten su equipo limitado a las personas que lo necesitan y evita otorgar roles de nivel PMO a quien no deba ver todo el portafolio. Recuerda que los usuarios de nivel PMO ven todos los proyectos sin importar la membresía del equipo, así que la forma de mantener un proyecto sensible limitado a un grupo pequeño es agregar solo a los Gerentes de proyecto y Miembros del equipo que pertenecen a él, y asegurarte de que no existan roles de nivel PMO innecesarios.'),
    -- 10. Common permission mistakes
    ('common-permission-mistakes','en','Common permission mistakes',
     'The most common permission mistakes are: granting PMO-level roles too freely, which gives people visibility into every project; expecting a Project Manager or Team Member to see a project they were never added to; forgetting that adding a project team person does not create a login; and assuming the interface is the only safeguard when Row Level Security also blocks unauthorized data at the database. A good habit is to grant the least privilege necessary and review PMO-level roles periodically.'),
    ('common-permission-mistakes','es','Errores comunes de permisos',
     'Los errores de permisos más comunes son: otorgar roles de nivel PMO con demasiada libertad, lo que da a las personas visibilidad de todos los proyectos; esperar que un Gerente de proyecto o un Miembro del equipo vea un proyecto al que nunca fue agregado; olvidar que agregar una persona al equipo de un proyecto no crea un inicio de sesión; y suponer que la interfaz es la única protección cuando Row Level Security también bloquea los datos no autorizados en la base de datos. Un buen hábito es otorgar el menor privilegio necesario y revisar periódicamente los roles de nivel PMO.'),
    -- 11. Why a user cannot see a project
    ('why-cannot-see-project','en','Why a user cannot see a project',
     'If a user cannot see a project, the usual reason is that they are not a member of that project team and they do not hold a PMO-level role that grants organization-wide visibility. Other causes are that their organization role is too limited (for example a Viewer or Client), that the project belongs to a different organization than the one they currently have active, or that their access was intentionally restricted. To fix it, add them to the project team with an appropriate project role, or, only if they genuinely need to see everything, raise their organization role.'),
    ('why-cannot-see-project','es','Por qué un usuario no puede ver un proyecto',
     'Si un usuario no puede ver un proyecto, la razón habitual es que no es miembro del equipo de ese proyecto y no tiene un rol de nivel PMO que otorgue visibilidad en toda la organización. Otras causas son que su rol de organización es demasiado limitado (por ejemplo Observador o Cliente), que el proyecto pertenece a una organización distinta de la que tiene activa en ese momento, o que su acceso fue restringido intencionalmente. Para solucionarlo, agrégalo al equipo del proyecto con un rol de proyecto apropiado o, solo si realmente necesita verlo todo, eleva su rol de organización.')
  ) AS c(slug, language, title, body) ON c.slug = p.slug
  RETURNING id, version_id, package_id, organization_id, language, body
)
INSERT INTO public.knowledge_chunks (
  localization_id, version_id, package_id, organization_id, language,
  ordinal, body, content_hash, index_status
)
SELECT
  l.id, l.version_id, l.package_id, l.organization_id, l.language,
  0, l.body, encode(digest(l.body, 'sha256'), 'hex'), 'pending'
FROM loc l;
