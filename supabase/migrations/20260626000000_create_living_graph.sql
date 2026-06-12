-- ═══════════════════════════════════════════════════════════════════════════════
-- Living Graph — Process Intelligence Data Model
-- Creates: process_nodes, process_edges, process_snapshots
-- Plus: indexes, RLS policies, triggers, backfill function
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── process_nodes ────────────────────────────────────────────────────────────────
-- Represents events in the project process: task transitions, decision cascades,
-- communication flows, document links, milestone gates, blocker events.

CREATE TABLE IF NOT EXISTS public.process_nodes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  node_type         text NOT NULL
    CHECK (node_type IN (
      'task_transition', 'decision_cascade', 'communication_flow',
      'document_link', 'milestone_gate', 'blocker_event'
    )),
  source_entity_type text NOT NULL
    CHECK (source_entity_type IN (
      'roadmap_tasks', 'decisions', 'communication_items',
      'meetings', 'documents', 'milestones'
    )),
  source_entity_id  uuid NOT NULL,
  title              text NOT NULL,
  description        text,
  metadata           jsonb NOT NULL DEFAULT '{}',
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  embedding          vector(1536),
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate nodes for the same source entity + type within a project
CREATE UNIQUE INDEX IF NOT EXISTS idx_process_nodes_unique_source
  ON public.process_nodes (project_id, source_entity_type, source_entity_id, node_type)
  WHERE deleted_at IS NULL;

-- ── process_edges ────────────────────────────────────────────────────────────────
-- Causal and temporal relationships between process nodes.

CREATE TABLE IF NOT EXISTS public.process_edges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_node_id      uuid NOT NULL REFERENCES public.process_nodes(id) ON DELETE CASCADE,
  to_node_id        uuid NOT NULL REFERENCES public.process_nodes(id) ON DELETE CASCADE,
  edge_type         text NOT NULL
    CHECK (edge_type IN (
      'caused', 'enabled', 'blocked', 'delayed', 'accelerated', 'informed'
    )),
  weight            numeric(6,2) NOT NULL DEFAULT 1.0,
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- A node cannot link to itself
  CHECK (from_node_id != to_node_id),

  -- Prevent duplicate edges of the same type
  UNIQUE (from_node_id, to_node_id, edge_type)
);

-- ── process_snapshots ────────────────────────────────────────────────────────────
-- Point-in-time cache of graph state for temporal queries.

CREATE TABLE IF NOT EXISTS public.process_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date     date NOT NULL,
  node_count        integer NOT NULL DEFAULT 0,
  edge_count        integer NOT NULL DEFAULT 0,
  summary           jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- One snapshot per project per date
  UNIQUE (project_id, snapshot_date)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════════

-- process_nodes indexes
CREATE INDEX IF NOT EXISTS idx_process_nodes_org
  ON public.process_nodes (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_process_nodes_project
  ON public.process_nodes (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_process_nodes_type
  ON public.process_nodes (project_id, node_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_process_nodes_source
  ON public.process_nodes (source_entity_type, source_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_process_nodes_occurred
  ON public.process_nodes (project_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_process_nodes_embedding
  ON public.process_nodes USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

-- process_edges indexes
CREATE INDEX IF NOT EXISTS idx_process_edges_project
  ON public.process_edges (project_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_process_edges_from
  ON public.process_edges (from_node_id);
CREATE INDEX IF NOT EXISTS idx_process_edges_to
  ON public.process_edges (to_node_id);
CREATE INDEX IF NOT EXISTS idx_process_edges_type
  ON public.process_edges (project_id, edge_type);

-- process_snapshots indexes
CREATE INDEX IF NOT EXISTS idx_process_snapshots_project
  ON public.process_snapshots (project_id, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Triggers
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.process_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row-Level Security
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.process_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_snapshots ENABLE ROW LEVEL SECURITY;

-- process_nodes policies
CREATE POLICY "Members can read process_nodes"
  ON public.process_nodes FOR SELECT
  USING (public.is_org_member(organization_id));
CREATE POLICY "Members can insert process_nodes"
  ON public.process_nodes FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members can update process_nodes"
  ON public.process_nodes FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members can delete process_nodes"
  ON public.process_nodes FOR DELETE
  USING (public.is_org_member(organization_id));
CREATE POLICY "Service role has full access on process_nodes"
  ON public.process_nodes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- process_edges policies
CREATE POLICY "Members can read process_edges"
  ON public.process_edges FOR SELECT
  USING (public.is_org_member(organization_id));
CREATE POLICY "Members can insert process_edges"
  ON public.process_edges FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members can update process_edges"
  ON public.process_edges FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members can delete process_edges"
  ON public.process_edges FOR DELETE
  USING (public.is_org_member(organization_id));
CREATE POLICY "Service role has full access on process_edges"
  ON public.process_edges FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- process_snapshots policies
CREATE POLICY "Members can read process_snapshots"
  ON public.process_snapshots FOR SELECT
  USING (public.is_org_member(organization_id));
CREATE POLICY "Members can insert process_snapshots"
  ON public.process_snapshots FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members can update process_snapshots"
  ON public.process_snapshots FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members can delete process_snapshots"
  ON public.process_snapshots FOR DELETE
  USING (public.is_org_member(organization_id));
CREATE POLICY "Service role has full access on process_snapshots"
  ON public.process_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════════
-- Column comments
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE public.process_nodes IS
  'Process Intelligence: nodes representing events in project execution (task transitions, decisions, communications, etc.)';
COMMENT ON TABLE public.process_edges IS
  'Process Intelligence: causal/temporal relationships between process nodes';
COMMENT ON TABLE public.process_snapshots IS
  'Process Intelligence: point-in-time cache of graph state for temporal queries';
COMMENT ON COLUMN public.process_nodes.embedding IS
  'OpenAI text-embedding-3-small vector (1536 dims). Null until embedding is generated.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Backfill function: populate graph from existing project data
-- Idempotent: skips if node already exists for (source_entity_type, source_entity_id, node_type)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.backfill_living_graph(p_filter_project_id uuid DEFAULT NULL)
RETURNS TABLE (out_project_id uuid, out_nodes_created bigint, out_edges_created bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_nodes_created bigint := 0;
  v_edges_created bigint := 0;
  v_task_record RECORD;
  v_decision_record RECORD;
  v_comm_record RECORD;
  v_milestone_record RECORD;
  v_new_node_id uuid;
  v_prev_node_id uuid;
  v_row_count bigint;
BEGIN
  -- Iterate over all (or filtered) projects
  FOR v_project_id IN
    SELECT p.id FROM public.projects p
    WHERE p.deleted_at IS NULL
      AND (p_filter_project_id IS NULL OR p.id = p_filter_project_id)
  LOOP
    v_nodes_created := 0;
    v_edges_created := 0;

    -- ── 1. Task transitions ──────────────────────────────────────────────────
    -- Create a node for each task that has progressed beyond 'not_started'.
    FOR v_task_record IN
      SELECT rt.id, rt.organization_id, rt.title, rt.status, rt.created_at, rt.updated_at
      FROM public.roadmap_tasks rt
      WHERE rt.project_id = v_project_id
        AND rt.status != 'not_started'
        AND rt.deleted_at IS NULL
      ORDER BY rt.updated_at ASC
    LOOP
      -- Skip if already exists (idempotent)
      IF EXISTS (
        SELECT 1 FROM public.process_nodes pn
        WHERE pn.project_id = v_project_id
          AND pn.source_entity_type = 'roadmap_tasks'
          AND pn.source_entity_id = v_task_record.id
          AND pn.node_type = 'task_transition'
          AND pn.deleted_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.process_nodes (
        organization_id, project_id, node_type,
        source_entity_type, source_entity_id,
        title, metadata, occurred_at
      ) VALUES (
        v_task_record.organization_id,
        v_project_id,
        'task_transition',
        'roadmap_tasks',
        v_task_record.id,
        v_task_record.title,
        jsonb_build_object(
          'new_status', v_task_record.status,
          'title', v_task_record.title
        ),
        COALESCE(v_task_record.updated_at, v_task_record.created_at)
      ) RETURNING id INTO v_new_node_id;

      v_nodes_created := v_nodes_created + 1;
    END LOOP;

    -- ── 2. Decision cascades ─────────────────────────────────────────────────
    FOR v_decision_record IN
      SELECT d.id, d.organization_id, d.title_i18n, d.created_at
      FROM public.decisions d
      WHERE d.project_id = v_project_id
        AND d.deleted_at IS NULL
      ORDER BY d.created_at ASC
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.process_nodes pn
        WHERE pn.project_id = v_project_id
          AND pn.source_entity_type = 'decisions'
          AND pn.source_entity_id = v_decision_record.id
          AND pn.node_type = 'decision_cascade'
          AND pn.deleted_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.process_nodes (
        organization_id, project_id, node_type,
        source_entity_type, source_entity_id,
        title, metadata, occurred_at
      ) VALUES (
        v_decision_record.organization_id,
        v_project_id,
        'decision_cascade',
        'decisions',
        v_decision_record.id,
        COALESCE(v_decision_record.title_i18n->>'en', v_decision_record.title_i18n->>'es', 'Decision'),
        jsonb_build_object('entity_type', 'decision'),
        v_decision_record.created_at
      );

      v_nodes_created := v_nodes_created + 1;
    END LOOP;

    -- ── 3. Communication flows ──────────────────────────────────────────────
    FOR v_comm_record IN
      SELECT ci.id, ci.organization_id, ci.title_i18n, ci.source_type, ci.created_at
      FROM public.communication_items ci
      WHERE ci.project_id = v_project_id
        AND ci.deleted_at IS NULL
      ORDER BY ci.created_at ASC
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.process_nodes pn
        WHERE pn.project_id = v_project_id
          AND pn.source_entity_type = 'communication_items'
          AND pn.source_entity_id = v_comm_record.id
          AND pn.node_type = 'communication_flow'
          AND pn.deleted_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.process_nodes (
        organization_id, project_id, node_type,
        source_entity_type, source_entity_id,
        title, metadata, occurred_at
      ) VALUES (
        v_comm_record.organization_id,
        v_project_id,
        'communication_flow',
        'communication_items',
        v_comm_record.id,
        COALESCE(v_comm_record.title_i18n->>'en', v_comm_record.title_i18n->>'es', 'Communication'),
        jsonb_build_object('source_type', COALESCE(v_comm_record.source_type, 'unknown')),
        v_comm_record.created_at
      );

      v_nodes_created := v_nodes_created + 1;
    END LOOP;

    -- ── 4. Milestone gates ─────────────────────────────────────────────────
    FOR v_milestone_record IN
      SELECT m.id, m.organization_id, m.title, m.status, m.created_at
      FROM public.milestones m
      WHERE m.project_id = v_project_id
        AND m.status != 'planned'
        AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.process_nodes pn
        WHERE pn.project_id = v_project_id
          AND pn.source_entity_type = 'milestones'
          AND pn.source_entity_id = v_milestone_record.id
          AND pn.node_type = 'milestone_gate'
          AND pn.deleted_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.process_nodes (
        organization_id, project_id, node_type,
        source_entity_type, source_entity_id,
        title, metadata, occurred_at
      ) VALUES (
        v_milestone_record.organization_id,
        v_project_id,
        'milestone_gate',
        'milestones',
        v_milestone_record.id,
        v_milestone_record.title,
        jsonb_build_object('new_status', v_milestone_record.status),
        v_milestone_record.created_at
      );

      v_nodes_created := v_nodes_created + 1;
    END LOOP;

    -- ── 5. Create edges between sequential task transitions ──────────────────
    -- Link task transition nodes that occurred close in time with 'caused' edges
    INSERT INTO public.process_edges (
      organization_id, project_id, from_node_id, to_node_id, edge_type, weight
    )
    SELECT
      n1.organization_id,
      v_project_id,
      n1.id,
      n2.id,
      'caused',
      1.0
    FROM public.process_nodes n1
    JOIN public.process_nodes n2
      ON n2.project_id = n1.project_id
      AND n2.source_entity_type = 'roadmap_tasks'
      AND n2.node_type = 'task_transition'
      AND n2.occurred_at > n1.occurred_at
      AND n2.occurred_at < n1.occurred_at + interval '1 hour'
    WHERE n1.project_id = v_project_id
      AND n1.source_entity_type = 'roadmap_tasks'
      AND n1.node_type = 'task_transition'
      AND n1.deleted_at IS NULL
      AND n2.deleted_at IS NULL
    ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_edges_created := v_edges_created + v_row_count;

    -- ── 6. Create edges between decisions and tasks via traceability_links ────
    -- traceability_links uses (source_type, source_id, target_type, target_id), not entity_*
    INSERT INTO public.process_edges (
      organization_id, project_id, from_node_id, to_node_id, edge_type, weight
    )
    SELECT
      dn.organization_id,
      v_project_id,
      dn.id,
      tn.id,
      'caused',
      1.0
    FROM public.process_nodes dn
    JOIN public.traceability_links tl
      ON tl.target_type = 'decision'
      AND tl.target_id = dn.source_entity_id
    JOIN public.process_nodes tn
      ON tn.source_entity_type = CASE tl.source_type
          WHEN 'action_item' THEN 'roadmap_tasks'
          ELSE tl.source_type
        END
      AND tn.source_entity_id = tl.source_id
      AND tn.node_type = 'task_transition'
      AND tn.deleted_at IS NULL
    WHERE dn.project_id = v_project_id
      AND dn.node_type = 'decision_cascade'
      AND dn.deleted_at IS NULL
      AND tl.organization_id = dn.organization_id
    ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_edges_created := v_edges_created + v_row_count;

    -- Return per-project result
    out_project_id := v_project_id;
    out_nodes_created := v_nodes_created;
    out_edges_created := v_edges_created;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;