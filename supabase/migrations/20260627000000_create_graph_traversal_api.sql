-- ============================================================================
-- ProjectOps360° — Graph Traversal & Query API (PI-004)
-- ============================================================================
-- Creates 5 RPC functions for traversing and querying the Living Graph:
--   1. find_path          — shortest path between two nodes (BFS)
--   2. detect_cycles     — find circular dependencies / feedback loops
--   3. extract_subgraph   — N-depth neighborhood of a node
--   4. get_process_timeline — chronological process events in date range
--   5. get_node_neighbors — immediate neighbors with direction filter
-- ============================================================================

-- ── Supporting indexes for traversal queries ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_process_edges_from_type
  ON public.process_edges (from_node_id, edge_type);

CREATE INDEX IF NOT EXISTS idx_process_edges_to_type
  ON public.process_edges (to_node_id, edge_type);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. find_path: shortest path between two nodes using BFS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.find_path(
  p_project_id uuid,
  p_from_node_id uuid,
  p_to_node_id uuid,
  p_max_depth int DEFAULT 10
)
RETURNS TABLE (
  path_node_ids uuid[],
  total_weight numeric,
  path_length int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current uuid;
  v_depth int;
  v_found boolean := false;
  v_path_ids uuid[];
  v_path_weight numeric := 0;
  v_w numeric;
BEGIN
  -- Validate both nodes exist in this project
  IF NOT EXISTS (
    SELECT 1 FROM public.process_nodes pn
    WHERE pn.id = p_from_node_id AND pn.project_id = p_project_id AND pn.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.process_nodes pn
    WHERE pn.id = p_to_node_id AND pn.project_id = p_project_id AND pn.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- Edge case: same node
  IF p_from_node_id = p_to_node_id THEN
    path_node_ids := ARRAY[p_from_node_id];
    total_weight := 0;
    path_length := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- BFS using temp table for parent tracking
  CREATE TEMP TABLE IF NOT EXISTS _bfs_visited (
    node_id uuid PRIMARY KEY,
    parent_id uuid,
    edge_weight numeric,
    bfs_depth int
  ) ON COMMIT DROP;
  TRUNCATE _bfs_visited;

  INSERT INTO _bfs_visited (node_id, parent_id, edge_weight, bfs_depth)
  VALUES (p_from_node_id, NULL, 0, 0);

  v_depth := 0;
  WHILE v_depth < p_max_depth AND NOT v_found LOOP
    v_depth := v_depth + 1;

    -- Expand frontier: for each unvisited node at depth-1, add its unvisited neighbors
    INSERT INTO _bfs_visited (node_id, parent_id, edge_weight, bfs_depth)
    SELECT
      e.to_node_id,
      e.from_node_id,
      e.weight,
      v_depth
    FROM _bfs_visited v
    JOIN public.process_edges e ON e.from_node_id = v.node_id
    JOIN public.process_nodes n ON n.id = e.to_node_id AND n.deleted_at IS NULL
    WHERE v.bfs_depth = v_depth - 1
      AND n.project_id = p_project_id
      AND e.to_node_id NOT IN (SELECT bv.node_id FROM _bfs_visited bv)
    ON CONFLICT (node_id) DO NOTHING;

    v_found := EXISTS (
      SELECT 1 FROM _bfs_visited WHERE node_id = p_to_node_id
    );
  END LOOP;

  -- Reconstruct path if found
  IF v_found THEN
    v_path_ids := ARRAY[p_to_node_id];
    v_path_weight := 0;

    v_current := p_to_node_id;
    LOOP
      SELECT bv.parent_id, bv.edge_weight INTO v_current, v_w
        FROM _bfs_visited bv WHERE bv.node_id = v_current;

      EXIT WHEN v_current IS NULL;

      v_path_weight := v_path_weight + COALESCE(v_w, 1.0);
      v_path_ids := ARRAY[v_current] || v_path_ids;
    END LOOP;

    path_node_ids := v_path_ids;
    total_weight := v_path_weight;
    path_length := array_length(v_path_ids, 1) - 1;
    RETURN NEXT;
  END IF;

  DROP TABLE IF EXISTS _bfs_visited;
  RETURN;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. detect_cycles: find circular dependencies / feedback loops
-- ═══════════════════════════════════════════════════════════════════════════════
-- Per-node DFS using PL/pgSQL with strict depth=4 limit and early termination.
-- Only checks nodes that have both incoming and outgoing edges.

CREATE OR REPLACE FUNCTION public.detect_cycles(
  p_project_id uuid,
  p_node_type text DEFAULT NULL
)
RETURNS TABLE (
  cycle_id int,
  node_ids uuid[],
  node_titles text[],
  cycle_length int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_count int := 0;
  v_start RECORD;
  v_cur uuid;
  v_nid uuid;
  v_ntitle text;
  v_path uuid[];
  v_ptitles text[];
  v_d int;
BEGIN
  -- Only examine nodes with both in/out edges (potential cycle members)
  FOR v_start IN
    SELECT pn.id, pn.title
    FROM public.process_nodes pn
    WHERE pn.project_id = p_project_id
      AND pn.deleted_at IS NULL
      AND (p_node_type IS NULL OR pn.node_type = p_node_type)
      AND EXISTS (SELECT 1 FROM public.process_edges pe WHERE pe.from_node_id = pn.id AND pe.project_id = p_project_id)
      AND EXISTS (SELECT 1 FROM public.process_edges pe WHERE pe.to_node_id = pn.id AND pe.project_id = p_project_id)
    ORDER BY pn.occurred_at
    -- Limit candidates to avoid runaway
    LIMIT 50
  LOOP
    -- Simple BFS from this node, depth 4, looking for a path back to itself
    v_path := ARRAY[v_start.id];
    v_ptitles := ARRAY[v_start.title];
    v_d := 0;

    WHILE v_d < 4 AND v_cycle_count < 20 LOOP
      v_d := v_d + 1;
      -- Check if any current-path node has an edge back to v_start.id
      FOR v_nid, v_ntitle IN
        SELECT e.to_node_id, n.title
        FROM unnest(v_path) AS p_node
        JOIN public.process_edges e ON e.from_node_id = p_node AND e.project_id = p_project_id
        JOIN public.process_nodes n ON n.id = e.to_node_id AND n.deleted_at IS NULL
        WHERE n.project_id = p_project_id
          AND e.to_node_id = v_start.id
        LIMIT 1
      LOOP
        -- Cycle found!
        v_cycle_count := v_cycle_count + 1;
        cycle_id := v_cycle_count;
        node_ids := v_path || ARRAY[v_start.id];
        node_titles := v_ptitles || ARRAY[v_start.title];
        cycle_length := v_d;
        RETURN NEXT;
        -- Move to next start node (only report shortest cycle per node)
        v_d := 99; -- break the while
      END LOOP;

      IF v_d < 4 THEN
        -- Expand frontier: add all neighbors of current path nodes that aren't already in path
        FOR v_nid, v_ntitle IN
          SELECT DISTINCT ON (e.to_node_id) e.to_node_id, n.title
          FROM unnest(v_path) AS p_node
          JOIN public.process_edges e ON e.from_node_id = p_node AND e.project_id = p_project_id
          JOIN public.process_nodes n ON n.id = e.to_node_id AND n.deleted_at IS NULL
          WHERE n.project_id = p_project_id
            AND e.to_node_id <> ALL(v_path)
            AND e.to_node_id <> v_start.id
          LIMIT 10
        LOOP
          v_path := v_path || ARRAY[v_nid];
          v_ptitles := v_ptitles || ARRAY[v_ntitle];
        END LOOP;
      END IF;
    END LOOP;

    IF v_cycle_count >= 20 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. extract_subgraph: N-depth neighborhood of a node
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.extract_subgraph(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_depth int DEFAULT 2
)
RETURNS TABLE (
  nodes jsonb,
  edges jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_node_id uuid;
  v_result_nodes jsonb;
  v_result_edges jsonb;
  v_depth int;
BEGIN
  -- Find the starting node by source entity
  SELECT pn.id INTO v_start_node_id
  FROM public.process_nodes pn
  WHERE pn.project_id = p_project_id
    AND pn.source_entity_type = p_entity_type
    AND pn.source_entity_id = p_entity_id
    AND pn.deleted_at IS NULL
  LIMIT 1;

  IF v_start_node_id IS NULL THEN
    nodes := '[]'::jsonb;
    edges := '[]'::jsonb;
    RETURN NEXT;
    RETURN;
  END IF;

  -- BFS to collect nodes within p_depth hops (bidirectional)
  CREATE TEMP TABLE IF NOT EXISTS _subgraph_nodes (
    node_id uuid PRIMARY KEY,
    bfs_depth int
  ) ON COMMIT DROP;
  TRUNCATE _subgraph_nodes;

  INSERT INTO _subgraph_nodes (node_id, bfs_depth) VALUES (v_start_node_id, 0);

  FOR v_depth IN 1..p_depth LOOP
    -- Follow outgoing edges
    INSERT INTO _subgraph_nodes (node_id, bfs_depth)
    SELECT e.to_node_id, v_depth
    FROM _subgraph_nodes sn
    JOIN public.process_edges e ON e.from_node_id = sn.node_id
    JOIN public.process_nodes n ON n.id = e.to_node_id AND n.deleted_at IS NULL
    WHERE sn.bfs_depth = v_depth - 1
      AND n.project_id = p_project_id
      AND e.to_node_id NOT IN (SELECT sgn.node_id FROM _subgraph_nodes sgn)
    ON CONFLICT (node_id) DO NOTHING;

    -- Also follow incoming edges (reverse traversal)
    INSERT INTO _subgraph_nodes (node_id, bfs_depth)
    SELECT e.from_node_id, v_depth
    FROM _subgraph_nodes sn
    JOIN public.process_edges e ON e.to_node_id = sn.node_id
    JOIN public.process_nodes n ON n.id = e.from_node_id AND n.deleted_at IS NULL
    WHERE sn.bfs_depth = v_depth - 1
      AND n.project_id = p_project_id
      AND e.from_node_id NOT IN (SELECT sgn.node_id FROM _subgraph_nodes sgn)
    ON CONFLICT (node_id) DO NOTHING;
  END LOOP;

  -- Collect nodes as JSON
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pn.id,
      'node_type', pn.node_type,
      'source_entity_type', pn.source_entity_type,
      'source_entity_id', pn.source_entity_id,
      'title', pn.title,
      'metadata', pn.metadata,
      'occurred_at', pn.occurred_at
    )
  ) INTO v_result_nodes
  FROM public.process_nodes pn
  WHERE pn.id IN (SELECT sgn.node_id FROM _subgraph_nodes sgn)
    AND pn.deleted_at IS NULL;

  -- Collect edges between these nodes as JSON
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pe.id,
      'from_node_id', pe.from_node_id,
      'to_node_id', pe.to_node_id,
      'edge_type', pe.edge_type,
      'weight', pe.weight,
      'metadata', pe.metadata
    )
  ) INTO v_result_edges
  FROM public.process_edges pe
  WHERE pe.from_node_id IN (SELECT sgn.node_id FROM _subgraph_nodes sgn)
    AND pe.to_node_id IN (SELECT sgn2.node_id FROM _subgraph_nodes sgn2)
    AND pe.project_id = p_project_id;

  nodes := COALESCE(v_result_nodes, '[]'::jsonb);
  edges := COALESCE(v_result_edges, '[]'::jsonb);

  DROP TABLE IF EXISTS _subgraph_nodes;

  RETURN NEXT;
  RETURN;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. get_process_timeline: chronological process events in date range
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_process_timeline(
  p_project_id uuid,
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL
)
RETURNS TABLE (
  node_id uuid,
  node_type text,
  source_entity_type text,
  source_entity_id uuid,
  title text,
  metadata jsonb,
  occurred_at timestamptz,
  in_degree int,
  out_degree int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    pn.id AS node_id,
    pn.node_type,
    pn.source_entity_type,
    pn.source_entity_id,
    pn.title,
    pn.metadata,
    pn.occurred_at,
    (SELECT count(*) FROM public.process_edges pe WHERE pe.to_node_id = pn.id AND pe.project_id = p_project_id)::int AS in_degree,
    (SELECT count(*) FROM public.process_edges pe WHERE pe.from_node_id = pn.id AND pe.project_id = p_project_id)::int AS out_degree
  FROM public.process_nodes pn
  WHERE pn.project_id = p_project_id
    AND pn.deleted_at IS NULL
    AND (p_from_date IS NULL OR pn.occurred_at >= p_from_date)
    AND (p_to_date IS NULL OR pn.occurred_at < (p_to_date + interval '1 day'))
  ORDER BY pn.occurred_at ASC;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. get_node_neighbors: immediate neighbors with direction filter
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_node_neighbors(
  p_project_id uuid,
  p_node_id uuid,
  p_direction text DEFAULT 'both',
  p_edge_types text[] DEFAULT NULL
)
RETURNS TABLE (
  neighbor_id uuid,
  neighbor_node_type text,
  neighbor_title text,
  neighbor_source_entity_type text,
  neighbor_source_entity_id uuid,
  neighbor_occurred_at timestamptz,
  edge_id uuid,
  edge_type text,
  edge_weight numeric,
  edge_metadata jsonb,
  direction text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Outgoing edges (current node → neighbor)
  SELECT
    pn.id AS neighbor_id,
    pn.node_type AS neighbor_node_type,
    pn.title AS neighbor_title,
    pn.source_entity_type AS neighbor_source_entity_type,
    pn.source_entity_id AS neighbor_source_entity_id,
    pn.occurred_at AS neighbor_occurred_at,
    pe.id AS edge_id,
    pe.edge_type,
    pe.weight AS edge_weight,
    pe.metadata AS edge_metadata,
    'outgoing' AS direction
  FROM public.process_edges pe
  JOIN public.process_nodes pn ON pn.id = pe.to_node_id AND pn.deleted_at IS NULL
  WHERE pe.from_node_id = p_node_id
    AND pe.project_id = p_project_id
    AND pn.project_id = p_project_id
    AND p_direction IN ('outgoing', 'both')
    AND (p_edge_types IS NULL OR pe.edge_type = ANY(p_edge_types))

  UNION ALL

  -- Incoming edges (neighbor → current node)
  SELECT
    pn.id AS neighbor_id,
    pn.node_type AS neighbor_node_type,
    pn.title AS neighbor_title,
    pn.source_entity_type AS neighbor_source_entity_type,
    pn.source_entity_id AS neighbor_source_entity_id,
    pn.occurred_at AS neighbor_occurred_at,
    pe.id AS edge_id,
    pe.edge_type,
    pe.weight AS edge_weight,
    pe.metadata AS edge_metadata,
    'incoming' AS direction
  FROM public.process_edges pe
  JOIN public.process_nodes pn ON pn.id = pe.from_node_id AND pn.deleted_at IS NULL
  WHERE pe.to_node_id = p_node_id
    AND pe.project_id = p_project_id
    AND pn.project_id = p_project_id
    AND p_direction IN ('incoming', 'both')
    AND (p_edge_types IS NULL OR pe.edge_type = ANY(p_edge_types))

  ORDER BY neighbor_occurred_at ASC;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Function comments
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.find_path(uuid, uuid, uuid, int) IS
  'BFS shortest-path between two process nodes. Returns path_node_ids, total_weight, path_length.';
COMMENT ON FUNCTION public.detect_cycles(uuid, text) IS
  'DFS-based cycle detection in the process graph. Optionally filter by node_type.';
COMMENT ON FUNCTION public.extract_subgraph(uuid, text, uuid, int) IS
  'Extract N-depth neighborhood subgraph around a source entity. Returns nodes and edges as JSONB arrays.';
COMMENT ON FUNCTION public.get_process_timeline(uuid, date, date) IS
  'Chronological timeline of process events with in/out degree counts.';
COMMENT ON FUNCTION public.get_node_neighbors(uuid, uuid, text, text[]) IS
  'Immediate neighbors of a node, filtered by direction (incoming/outgoing/both) and edge types.';