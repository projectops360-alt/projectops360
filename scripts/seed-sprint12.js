require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const ORG_ID = '4f00f16b-96d8-4fd6-9375-20e2b11564a6';
const PROJECT_ID = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936';
const MILESTONE_ID = 'a1b2c3d4-0001-4000-8000-000000000012';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ═══════════════════════════════════════════════════════════════════════════════
// TASK DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const tasks = [
  // ── GROUP 1: Living Graph Foundation ────────────────────────────────────────
  {
    external_key: 'PI-001',
    title: 'Define Living Graph Data Model',
    description: 'Design the entity/edge schema for the process intelligence graph. Entities represent process nodes (task transitions, decision cascades, communication flows, document links). Edges represent causal, temporal, and dependency relationships. The model must support multi-tenant isolation, temporal queries (graph state at point-in-time), and efficient traversal.',
    status: 'prompt_ready',
    priority: 'p1',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-09',
    end_date: '2026-06-11',
    estimate_hours: 6,
    order_index: 43,
    prompt_body: `You are a Senior Data Architect working on ProjectOps360°, a Next.js 16 + Supabase project management platform.

TASK: Design the Living Graph data model for Process Intelligence.

CONTEXT:
- ProjectOps360° already has tables: roadmap_tasks, milestones, decisions, communications, meetings, documents, stakeholders, task_dependencies
- The Living Graph must represent HOW the project actually executes: task transitions, decision cascades, communication flows, document evidence chains
- It must be queryable at any point in time (temporal)
- It must support multi-tenant isolation via organization_id
- It must integrate with existing pgvector embeddings and RPC functions

REQUIREMENTS:
1. Design two core tables: process_nodes and process_edges
2. process_nodes: id, organization_id, project_id, node_type (enum: task_transition, decision_cascade, communication_flow, document_link, milestone_gate, blocker_event), source_entity_type, source_entity_id, title, description, metadata (jsonb), occurred_at, created_at
3. process_edges: id, organization_id, project_id, from_node_id, to_node_id, edge_type (enum: caused, enabled, blocked, delayed, accelerated, informed), weight, metadata (jsonb), created_at
4. Include process_snapshots table for point-in-time graph state caching
5. Define all indexes (HNSW for vector, B-tree for temporal queries, partial indexes for common filters)
6. Define RLS policies matching existing pattern
7. Create a migration SQL file at supabase/migrations/YYYYMMDD_create_living_graph.sql
8. Also create a seed function that backfills graph nodes from existing project data

OUTPUT: Complete migration SQL file with all CREATE TABLE, indexes, RLS policies, triggers, and a backfill function.`,
    prompt_context: 'Design entity/edge schema for process intelligence graph',
    acceptance_criteria: `1) process_nodes and process_edges tables created with proper types and constraints\n2) process_snapshots table for temporal state caching\n3) All indexes defined (B-tree for temporal, partial for filters)\n4) RLS policies matching existing org-based pattern\n5) Backfill function that creates nodes from existing tasks, decisions, communications\n6) Migration file at supabase/migrations/ ready to apply`,
  },
  {
    external_key: 'PI-002',
    title: 'Create Living Graph Supabase Migration',
    description: 'Apply the Living Graph migration: create process_nodes, process_edges, and process_snapshots tables with all indexes, RLS policies, triggers, and the backfill seed function. Then execute the backfill to populate the graph from existing ProjectOps360° data.',
    status: 'not_started',
    priority: 'p1',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-11',
    end_date: '2026-06-12',
    estimate_hours: 4,
    order_index: 44,
    prompt_body: `You are a Senior Supabase Engineer working on ProjectOps360°.

TASK: Apply the Living Graph migration and backfill data.

CONTEXT:
- The data model was designed in PI-001
- The migration SQL file exists at supabase/migrations/
- Supabase project URL: from NEXT_PUBLIC_SUPABASE_URL
- Service role key: from SUPABASE_SERVICE_ROLE_KEY

REQUIREMENTS:
1. Apply the migration to the Supabase instance using the SQL editor or supabase CLI
2. Verify all tables, indexes, and RLS policies are created
3. Execute the backfill function to populate process_nodes from:
   - All existing roadmap_tasks (create task_transition nodes for each status change)
   - All decisions (create decision_cascade nodes)
   - All communications (create communication_flow nodes)
4. Execute backfill for process_edges: create causal/temporal edges between related nodes
5. Verify row counts after backfill
6. Test a simple graph traversal query

OUTPUT: Verified migration applied, backfill completed, sample traversal query results.`,
    prompt_context: 'Apply migration and execute backfill from existing data',
    acceptance_criteria: `1) Migration applied successfully — all tables, indexes, RLS policies exist\n2) Backfill completed: process_nodes populated from tasks, decisions, communications\n3) process_edges populated with causal/temporal relationships\n4) Sample graph traversal query returns valid results\n5) Row counts verified and documented`,
  },
  {
    external_key: 'PI-003',
    title: 'Build Process Event Ingestion Pipeline',
    description: 'Create server actions and hooks that automatically emit graph events when existing entities change. When a task changes status, a decision is logged, a communication is recorded — emit a process_node and connect it with process_edges to related existing nodes.',
    status: 'not_started',
    priority: 'p1',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-12',
    end_date: '2026-06-15',
    estimate_hours: 8,
    order_index: 45,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Build the process event ingestion pipeline.

CONTEXT:
- ProjectOps360° uses Next.js 16 App Router with Supabase
- Server actions exist for: updateTaskStatus, createDecision, createCommunication, createMeeting, createDocument
- The Living Graph tables (process_nodes, process_edges) now exist
- Current pattern: server actions use createAdminClient() for writes, createClient() for reads

REQUIREMENTS:
1. Create src/lib/graph/emit-event.ts with:
   - emitProcessNode(type, sourceEntityType, sourceEntityId, title, metadata) — inserts into process_nodes
   - emitProcessEdge(fromNodeId, toNodeId, edgeType, metadata) — inserts into process_edges
   - autoLinkProcessNode(newNodeId) — finds related nodes and creates edges automatically
2. Integrate into existing server actions:
   - updateTaskStatusAction: emit task_transition node + edges to decision/communication nodes
   - createDecision: emit decision_cascade node + edges to related tasks
   - createCommunication: emit communication_flow node + edges to related entities
   - createMeeting: emit communication_flow node + edges
3. Use fire-and-forget pattern (don't block the main action)
4. Use createAdminClient() for graph writes (bypasses RLS)
5. Add error handling: if graph emit fails, log but don't fail the main action
6. Add TypeScript types for graph events in src/types/database.ts

OUTPUT: All files created, integration complete, graph events flowing when actions execute.`,
    prompt_context: 'Hook into existing server actions to emit graph events automatically',
    acceptance_criteria: `1) src/lib/graph/emit-event.ts created with emitProcessNode, emitProcessEdge, autoLinkProcessNode\n2) Integrated into updateTaskStatusAction, createDecision, createCommunication, createMeeting\n3) Fire-and-forget pattern: graph emit failures don't block main actions\n4) TypeScript types added to database.ts\n5) Manual test: change a task status → verify process_node created in Supabase`,
  },
  {
    external_key: 'PI-004',
    title: 'Implement Graph Traversal & Query API',
    description: 'Create Supabase RPC functions for graph traversal: path finding between two nodes, cycle detection, subgraph extraction for a given entity, shortest dependency path, and breadth-first neighbor queries.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-12',
    end_date: '2026-06-16',
    estimate_hours: 10,
    order_index: 46,
    prompt_body: `You are a Senior Database Engineer working on ProjectOps360°.

TASK: Implement graph traversal and query API as Supabase RPC functions.

CONTEXT:
- process_nodes and process_edges tables exist
- Supabase RPC functions use PL/pgSQL
- Existing pattern: match_documents() RPC for vector search
- Queries are project-scoped (always filter by project_id)

REQUIREMENTS:
1. Create migration supabase/migrations/YYYYMMDD_create_graph_traversal_api.sql with these RPC functions:
   a) find_path(project_id uuid, from_node_id uuid, to_node_id uuid, max_depth int DEFAULT 10)
      - Returns shortest path between two nodes using BFS
      - Returns: array of node IDs in path order, total weight, path length
   b) detect_cycles(project_id uuid, node_type text DEFAULT NULL)
      - Finds cycles in the graph (circular dependencies, feedback loops)
      - Returns: array of cycle descriptions with node IDs
   c) extract_subgraph(project_id uuid, entity_type text, entity_id uuid, depth int DEFAULT 2)
      - Extracts the N-depth neighborhood of a node
      - Returns: arrays of nodes and edges within the subgraph
   d) get_process_timeline(project_id uuid, from_date date DEFAULT NULL, to_date date DEFAULT NULL)
      - Returns all process nodes in chronological order within date range
      - Joins with source entity details
   e) get_node_neighbors(project_id uuid, node_id uuid, direction text DEFAULT 'both', edge_types text[] DEFAULT NULL)
      - Returns immediate neighbors of a node
      - Direction: 'incoming', 'outgoing', or 'both'
2. All functions should use SECURITY DEFINER with org membership check
3. Add proper indexes to support these queries
4. Create TypeScript types in src/types/database.ts

OUTPUT: Migration file with all RPC functions, TypeScript types, tested with sample queries.`,
    prompt_context: 'Create Supabase RPC functions for graph traversal, cycle detection, and subgraph extraction',
    acceptance_criteria: `1) Migration with 5 RPC functions created and applied\n2) find_path returns shortest path between nodes\n3) detect_cycles identifies circular dependencies\n4) extract_subgraph returns N-depth neighborhood\n5) get_process_timeline returns chronological process events\n6) TypeScript types added for all function signatures\n7) Sample queries verified in Supabase SQL editor`,
  },
  {
    external_key: 'PI-005',
    title: 'Build Living Graph Visualization Component',
    description: 'Create an interactive React component that visualizes the Living Graph. Use React Flow or D3.js to render process nodes and edges. Support zoom, pan, click-to-inspect, filtering by node type, and time-range selection.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-16',
    end_date: '2026-06-20',
    estimate_hours: 12,
    order_index: 47,
    prompt_body: `You are a Senior Frontend Engineer working on ProjectOps360°.

TASK: Build the Living Graph visualization component.

CONTEXT:
- ProjectOps360° uses Next.js 16, React 19, Tailwind CSS, shadcn/ui
- Graph traversal RPC functions exist (find_path, extract_subgraph, etc.)
- The visualization will be embedded in the Execution Map tab
- Existing pattern: components in src/components/roadmap/ or src/components/layout/

REQUIREMENTS:
1. Create src/components/graph/living-graph-view.tsx:
   - Use @xyflow/react (React Flow v12) for graph rendering
   - Custom node types for each process_node.node_type (different colors/icons)
   - Custom edge types for each process_edge.edge_type (solid, dashed, colored)
   - Node click → opens detail panel with source entity info
   - Zoom, pan, minimap, controls
   - Filter controls: by node_type, by time range, by entity
   - Search: find and highlight a specific node
2. Create src/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/page.tsx:
   - Server component that fetches graph data via RPC
   - Passes data to the client visualization
3. Add i18n keys in messages/en.json and messages/es.json under a new "livingGraph" namespace
4. Integrate into the Execution Map tab navigation
5. Responsive design: works on desktop and tablet
6. Performance: use virtualization for large graphs (100+ nodes)

OUTPUT: Complete visualization component, integrated into Execution Map, with i18n.`,
    prompt_context: 'Build interactive graph visualization with React Flow, node/edge types, filtering, and time-range selection',
    acceptance_criteria: `1) living-graph-view.tsx component renders process_nodes and process_edges\n2) Custom node types with distinct colors/icons per node_type\n3) Custom edge types with distinct styles per edge_type\n4) Click-to-inspect detail panel\n5) Filter by node_type, time range, entity\n6) Search and highlight functionality\n7) Page route integrated into Execution Map tabs\n8) i18n keys added for en.json and es.json`,
  },

  // ── GROUP 2: Process Interpretation ─────────────────────────────────────────
  {
    external_key: 'PI-006',
    title: 'Design Process Interpretation Architecture',
    description: 'Design the architecture for the Process Interpretation Engine: how to analyze graph patterns, identify process phases, detect deviations, and generate human-readable explanations of process behavior. Define interfaces, data flow, and integration points.',
    status: 'not_started',
    priority: 'p1',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-09',
    end_date: '2026-06-10',
    estimate_hours: 4,
    order_index: 48,
    prompt_body: `You are a Senior Software Architect working on ProjectOps360°.

TASK: Design the Process Interpretation Engine architecture.

CONTEXT:
- The Living Graph data model and traversal API exist
- The engine must interpret graph patterns to explain process behavior
- Output: human-readable narratives, detected patterns, deviation alerts
- Must integrate with AI (OpenAI API) for natural language generation
- Must be extensible for future interpretation types

REQUIREMENTS:
1. Create architecture document at docs/process-interpretation-architecture.md:
   - Data flow: graph traversal → pattern extraction → AI interpretation → narrative generation
   - Core interfaces:
     * ProcessInterpreter: analyzes a subgraph and returns structured insights
     * PatternDetector: finds recurring patterns in process data
     * DeviationDetector: identifies deviations from expected process flow
     * NarrativeGenerator: converts structured insights to human-readable text
   - Integration points:
     * Input: process_nodes + process_edges (from graph traversal RPC)
     * AI: OpenAI GPT-4o for narrative generation (via existing AI SDK pattern)
     * Output: ProcessInsight type with categories (pattern, deviation, bottleneck, sop_opportunity)
   - Caching strategy: cache interpretations, invalidate when graph changes
   - Error handling: graceful degradation when AI unavailable
2. Define TypeScript interfaces in src/types/process-intelligence.ts:
   - ProcessInsight, ProcessPattern, ProcessDeviation, ProcessNarrative
   - InterpretationRequest, InterpretationResponse
3. Define the API contract for interpretation server actions

OUTPUT: Architecture document, TypeScript interfaces, API contract defined.`,
    prompt_context: 'Architect the interpretation engine: data flow, interfaces, AI integration, caching',
    acceptance_criteria: `1) Architecture document at docs/process-interpretation-architecture.md\n2) TypeScript interfaces defined in src/types/process-intelligence.ts\n3) Core abstractions: ProcessInterpreter, PatternDetector, DeviationDetector, NarrativeGenerator\n4) AI integration contract (OpenAI GPT-4o via existing SDK pattern)\n5) Caching strategy defined\n6) API contract for server actions defined`,
  },
  {
    external_key: 'PI-007',
    title: 'Implement Process Timeline Reconstruction',
    description: 'Build the service that reconstructs an ordered process timeline from graph events. Given a project and date range, produce a chronological sequence of what happened, why it happened, and what it led to.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-15',
    end_date: '2026-06-17',
    estimate_hours: 8,
    order_index: 49,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Implement the process timeline reconstruction service.

CONTEXT:
- Graph traversal API exists (get_process_timeline RPC)
- Process interpretation architecture defined in PI-006
- TypeScript interfaces in src/types/process-intelligence.ts

REQUIREMENTS:
1. Create src/lib/process-intelligence/timeline-reconstructor.ts:
   - reconstructTimeline(projectId, dateRange?) → ProcessTimeline
   - Fetches process nodes via get_process_timeline RPC
   - Enriches each node with:
     * Source entity details (task title, decision summary, etc.)
     * Causal predecessors (what caused this event)
     * Consequential successors (what this event led to)
   - Groups events into process phases (planning, execution, review, etc.)
   - Identifies parallel tracks (multiple simultaneous activities)
2. Create ProcessTimeline type:
   - phases: ProcessPhase[] (named groups of events)
   - events: ProcessEvent[] (enriched nodes)
   - parallelTracks: ParallelTrack[] (simultaneous activities)
   - metadata: { totalEvents, dateRange, projectTitle }
3. Create server action: getProcessTimelineAction(projectId, from?, to?)
4. Add unit tests for timeline reconstruction logic

OUTPUT: Timeline reconstruction service, server action, and tests.`,
    prompt_context: 'Reconstruct ordered process timeline from graph events with causal chains',
    acceptance_criteria: `1) timeline-reconstructor.ts service created\n2) ProcessTimeline type with phases, events, parallelTracks\n3) Events enriched with causal predecessors and successors\n4) Server action getProcessTimelineAction created\n5) Unit tests for reconstruction logic pass`,
  },
  {
    external_key: 'PI-008',
    title: 'Build Behavior Pattern Detection',
    description: 'Implement the pattern detection service that finds recurring process patterns: repeated decision sequences, common task transition flows, frequent blocker-resolution cycles, and acceleration/deceleration signals in the process graph.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-15',
    end_date: '2026-06-18',
    estimate_hours: 10,
    order_index: 50,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Build the behavior pattern detection service.

CONTEXT:
- Graph traversal API and process_nodes/edges exist
- Process interpretation architecture from PI-006
- Timeline reconstruction from PI-007 provides chronological event sequences

REQUIREMENTS:
1. Create src/lib/process-intelligence/pattern-detector.ts:
   - detectPatterns(projectId, options?) → ProcessPattern[]
   - Pattern types:
     * DecisionSequence: repeated decision patterns (e.g., "when X blocked → always create Y decision")
     * TaskFlowPattern: common task transition sequences
     * BlockerCycle: recurring blocker-resolution patterns
     * AccelerationSignal: tasks that completed faster than estimated
     * DecelerationSignal: tasks that took longer than estimated
2. Algorithm approach:
   - For DecisionSequence: group decisions by type + outcome, find recurring edge patterns
   - For TaskFlowPattern: mine frequent subgraphs from task_transition sequences
   - For BlockerCycle: detect cycles in blocked → resolved paths
   - For Acceleration/Deceleration: compare actual_hours vs estimate_hours distributions
3. Each pattern includes:
   - type, title, description, frequency, confidence (0-1)
   - exampleInstances: actual graph paths that match
   - recommendation: suggested action based on pattern
4. Create server action: detectPatternsAction(projectId)
5. Cache results with revalidation (5 min)

OUTPUT: Pattern detection service with all pattern types, server action, cached results.`,
    prompt_context: 'Detect recurring process patterns: decision sequences, task flows, blocker cycles, acceleration/deceleration',
    acceptance_criteria: `1) pattern-detector.ts with detectPatterns function\n2) 5 pattern types detected: DecisionSequence, TaskFlowPattern, BlockerCycle, AccelerationSignal, DecelerationSignal\n3) Each pattern includes frequency, confidence, examples, recommendation\n4) Server action detectPatternsAction created\n5) Results cached with 5-minute revalidation`,
  },
  {
    external_key: 'PI-009',
    title: 'Create Process Interpretation API & UI Panel',
    description: 'Build the server actions and UI panel that expose process interpretation results. The panel shows a process narrative (AI-generated explanation), detected patterns, and deviation alerts. Accessible from the Execution Map.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-18',
    end_date: '2026-06-20',
    estimate_hours: 8,
    order_index: 51,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Create the process interpretation API and UI panel.

CONTEXT:
- Timeline reconstruction (PI-007) and pattern detection (PI-008) services exist
- AI integration via OpenAI API (existing pattern in src/lib/ai/)
- UI uses shadcn/ui + Tailwind CSS + next-intl i18n

REQUIREMENTS:
1. Create server action src/app/[locale]/(app)/projects/[projectId]/execution-map/actions.ts:
   - interpretProcessAction(projectId): calls timeline reconstructor + pattern detector + AI narrative
   - Uses OpenAI GPT-4o to generate a narrative from structured timeline + patterns
   - Returns: ProcessInterpretation { narrative, patterns, deviations, generatedAt }
   - Cache with revalidation (10 min)
2. Create src/components/process-intelligence/interpretation-panel.tsx:
   - Client component showing:
     * Process Narrative: AI-generated paragraph explaining project process
     * Detected Patterns: cards with pattern type, frequency, confidence
     * Deviation Alerts: highlighted items needing attention
   - Refresh button to re-interpret
   - Loading skeleton during generation
3. Create page route: src/app/[locale]/(app)/projects/[projectId]/execution-map/interpretation/page.tsx
4. Add i18n keys under "processIntelligence" namespace in en.json and es.json
5. Integrate into Execution Map tab navigation

OUTPUT: Interpretation API, UI panel, i18n, integrated into Execution Map.`,
    prompt_context: 'Expose interpretation results via server actions + build narrative UI panel',
    acceptance_criteria: `1) interpretProcessAction server action created\n2) AI narrative generation from timeline + patterns\n3) Interpretation panel component with narrative, patterns, deviations\n4) Page route under Execution Map\n5) i18n keys added\n6) Integrated into Execution Map tabs`,
  },

  // ── GROUP 3: Bottleneck Detection ───────────────────────────────────────────
  {
    external_key: 'PI-010',
    title: 'Implement Bottleneck Detection Algorithm',
    description: 'Build the bottleneck detection service that analyzes the process graph to find wait times between process steps, stalled transitions, and resource contention points. Quantify impact and suggest resolution strategies.',
    status: 'not_started',
    priority: 'p1',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-16',
    end_date: '2026-06-18',
    estimate_hours: 8,
    order_index: 52,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Implement the bottleneck detection algorithm.

CONTEXT:
- Process graph (process_nodes, process_edges) contains task_transition nodes with timestamps
- Pattern detector (PI-008) provides recurrence data
- Bottleneck types: wait time, stalled transition, resource contention

REQUIREMENTS:
1. Create src/lib/process-intelligence/bottleneck-detector.ts:
   - detectBottlenecks(projectId, options?) → ProcessBottleneck[]
   - Detection algorithms:
     * WaitTimeBottleneck: time between dependent task transitions exceeds threshold
     * StalledTransitionBottleneck: tasks stuck in a status for longer than expected
     * ResourceContentionBottleneck: multiple tasks blocked by same dependency/person
   - For each bottleneck:
     * type, severity (low/medium/high/critical)
     * affectedNodeIds: graph nodes in the bottleneck
     * waitTimeHours: how long the bottleneck has existed
     * impactScore: estimated impact on project timeline (0-100)
     * description: human-readable explanation
     * recommendation: suggested resolution
2. Thresholds configurable per project (default: wait > 3 days = medium, > 7 days = high)
3. Create server action: detectBottlenecksAction(projectId)
4. Cache results with revalidation (5 min)
5. Add TypeScript types in src/types/process-intelligence.ts

OUTPUT: Bottleneck detection service with 3 detection types, server action, types.`,
    prompt_context: 'Detect wait-time bottlenecks, stalled transitions, and resource contention in process graph',
    acceptance_criteria: `1) bottleneck-detector.ts with detectBottlenecks function\n2) 3 bottleneck types: WaitTime, StalledTransition, ResourceContention\n3) Each bottleneck has severity, affectedNodes, waitTime, impactScore, recommendation\n4) Configurable thresholds\n5) Server action detectBottlenecksAction created\n6) TypeScript types added`,
  },
  {
    external_key: 'PI-011',
    title: 'Build Bottleneck Visualization & Highlighting',
    description: 'Add bottleneck indicators to the Living Graph visualization. Highlight bottleneck nodes and edges with distinct styling. Show bottleneck details on hover/click. Add a bottleneck summary panel.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-18',
    end_date: '2026-06-20',
    estimate_hours: 6,
    order_index: 53,
    prompt_body: `You are a Senior Frontend Engineer working on ProjectOps360°.

TASK: Add bottleneck visualization to the Living Graph.

CONTEXT:
- Living Graph visualization (PI-005) exists using React Flow
- Bottleneck detection (PI-010) provides ProcessBottleneck data
- React Flow supports custom node/edge styles and highlighting

REQUIREMENTS:
1. Extend src/components/graph/living-graph-view.tsx:
   - Add bottleneckHighlighting prop: ProcessBottleneck[]
   - Bottleneck nodes get red/orange border glow based on severity
   - Bottleneck edges get animated dashed red lines
   - Hover on bottleneck node → tooltip with wait time, impact score, recommendation
   - Click bottleneck node → opens detail panel
2. Create src/components/graph/bottleneck-summary.tsx:
   - Summary panel showing:
     * Total bottlenecks count by severity
     * Top 3 bottlenecks with impact scores
     * "View in Graph" button to zoom to bottleneck location
3. Add a filter toggle: "Show only bottlenecks" / "Show all"
4. Add i18n keys for bottleneck labels and severity levels

OUTPUT: Bottleneck highlighting in graph, summary panel, filter toggle, i18n.`,
    prompt_context: 'Highlight bottleneck nodes/edges on the Living Graph with severity-based styling',
    acceptance_criteria: `1) Bottleneck nodes styled with severity-based colors (red/orange glow)\n2) Bottleneck edges animated with dashed red lines\n3) Hover tooltip shows wait time, impact, recommendation\n4) Bottleneck summary panel with severity counts and top 3\n5) "Show only bottlenecks" filter toggle\n6) i18n keys added`,
  },
  {
    external_key: 'PI-012',
    title: 'Create Bottleneck Alerting & Recommendations',
    description: 'Build the alerting system that proactively notifies when bottlenecks are detected or worsen. Generate AI-powered recommendations for resolving each bottleneck. Integrate with the existing notification concept.',
    status: 'not_started',
    priority: 'p3',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-20',
    end_date: '2026-06-23',
    estimate_hours: 8,
    order_index: 54,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Build bottleneck alerting and AI recommendation system.

CONTEXT:
- Bottleneck detection (PI-010) identifies bottlenecks with severity and recommendations
- OpenAI API available for generating detailed resolution recommendations
- No real-time notification system exists yet — build as a pull-based alert

REQUIREMENTS:
1. Create src/lib/process-intelligence/bottleneck-alerter.ts:
   - checkBottleneckAlerts(projectId) → BottleneckAlert[]
   - Compares current bottlenecks with last known state
   - Generates alerts for: NEW bottleneck, WORSENED severity, RESOLVED bottleneck
   - Each alert: type, severity, bottleneckId, message, suggestedActions
2. Create src/lib/process-intelligence/bottleneck-recommender.ts:
   - generateRecommendations(bottleneck) → BottleneckRecommendation
   - Uses OpenAI GPT-4o to generate detailed resolution plan
   - Includes: root cause analysis, step-by-step resolution, estimated time to resolve, risk if unresolved
3. Create server actions:
   - getBottleneckAlertsAction(projectId)
   - getBottleneckRecommendationAction(bottleneckId)
4. Create src/components/process-intelligence/bottleneck-alerts-panel.tsx:
   - Shows active alerts with severity badges
   - "Get AI Recommendation" button per bottleneck
   - Recommendation displayed in a dialog with action steps
5. Cache alerts (2 min), cache recommendations per bottleneck (30 min)

OUTPUT: Alerting service, AI recommender, server actions, UI panel.`,
    prompt_context: 'Proactive bottleneck alerts + AI-generated resolution recommendations',
    acceptance_criteria: `1) Bottleneck alerting detects new, worsened, and resolved bottlenecks\n2) AI recommender generates detailed resolution plans via OpenAI\n3) Server actions for alerts and recommendations\n4) UI panel showing alerts with severity badges\n5) "Get AI Recommendation" button with dialog\n6) Caching strategy implemented`,
  },

  // ── GROUP 4: SOP Intelligence ───────────────────────────────────────────────
  {
    external_key: 'PI-013',
    title: 'Implement SOP Opportunity Detection',
    description: 'Detect process patterns that represent Standard Operating Procedure opportunities: repeated decision patterns, successful task sequences, common communication flows that could be formalized into SOPs.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-18',
    end_date: '2026-06-20',
    estimate_hours: 8,
    order_index: 55,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Implement SOP opportunity detection.

CONTEXT:
- Pattern detector (PI-008) finds recurring process patterns
- Bottleneck detector (PI-010) identifies inefficiencies
- SOP opportunity = a recurring successful pattern that could be formalized

REQUIREMENTS:
1. Create src/lib/process-intelligence/sop-detector.ts:
   - detectSOPOpportunities(projectId) → SOPOpportunity[]
   - Detection logic:
     * Repeated task flow: same sequence of task transitions occurs 3+ times → SOP candidate
     * Decision pattern: same type of decision with same outcome 3+ times → SOP candidate
     * Communication template: similar communication patterns → SOP candidate
     * Anti-pattern from bottlenecks: bottleneck followed by resolution → "avoid this" SOP
   - Each SOPOpportunity:
     * type: standard_procedure | decision_template | communication_template | avoidance_rule
     * title, description
     * frequency: how often this pattern occurs
     * evidence: array of example instances (node paths)
     * potentialImpact: estimated time savings if formalized
     * confidence: 0-1
2. Create server action: detectSOPOpportunitiesAction(projectId)
3. Cache results (10 min revalidation)
4. Add TypeScript types in src/types/process-intelligence.ts

OUTPUT: SOP detection service, server action, types.`,
    prompt_context: 'Detect SOP opportunities from recurring successful patterns in the process graph',
    acceptance_criteria: `1) sop-detector.ts with detectSOPOpportunities function\n2) 4 SOP types: standard_procedure, decision_template, communication_template, avoidance_rule\n3) Each opportunity has frequency, evidence, potentialImpact, confidence\n4) Server action created\n5) TypeScript types added`,
  },
  {
    external_key: 'PI-014',
    title: 'Build SOP Draft Generation Service',
    description: 'Create an AI-powered SOP draft generation service that takes a detected SOP opportunity and generates a formal Standard Operating Procedure document with steps, responsibilities, and acceptance criteria.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-20',
    end_date: '2026-06-23',
    estimate_hours: 8,
    order_index: 56,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Build the SOP draft generation service.

CONTEXT:
- SOP opportunity detection (PI-013) identifies candidates
- OpenAI API available for natural language generation
- Generated SOPs should be editable by users before formalizing

REQUIREMENTS:
1. Create src/lib/process-intelligence/sop-generator.ts:
   - generateSOPDraft(opportunity: SOPOpportunity) → SOPDraft
   - Uses OpenAI GPT-4o to generate:
     * Title: descriptive SOP name
     * Purpose: why this SOP exists
     * Scope: when and where it applies
     * Steps: numbered procedure steps with roles
     * AcceptanceCriteria: how to verify the SOP was followed
     * Exceptions: when not to follow this SOP
   - Input context: the evidence (example process paths) from the opportunity
2. Create server action: generateSOPDraftAction(opportunityId)
3. Create src/components/process-intelligence/sop-draft-dialog.tsx:
   - Shows generated SOP draft in readable format
   - "Edit" mode: user can modify before saving
   - "Save as Document" button: creates a Document record in the documents table
   - "Regenerate" button: re-runs AI generation
4. Add i18n keys under "processIntelligence.sop" namespace
5. Cache generated drafts (30 min)

OUTPUT: SOP generation service, UI dialog, document integration.`,
    prompt_context: 'Generate AI-drafted SOPs from detected opportunities, editable by users before saving',
    acceptance_criteria: `1) sop-generator.ts generates structured SOP drafts via OpenAI\n2) SOP includes title, purpose, scope, steps, acceptance criteria, exceptions\n3) Server action generateSOPDraftAction created\n4) UI dialog for viewing/editing/saving SOP drafts\n5) "Save as Document" creates a documents table record\n6) i18n keys added`,
  },

  // ── GROUP 5: Retrospective Engine ───────────────────────────────────────────
  {
    external_key: 'PI-015',
    title: 'Design Retrospective Data Model & Triggers',
    description: 'Design the data model for process-driven retrospectives and define the triggers that initiate retrospective generation: sprint end, milestone completion, or on-demand.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-17',
    end_date: '2026-06-18',
    estimate_hours: 4,
    order_index: 57,
    prompt_body: `You are a Senior Data Architect working on ProjectOps360°.

TASK: Design the retrospective data model and generation triggers.

CONTEXT:
- ProjectOps360° has milestones with status transitions (planned → in_progress → completed)
- Process timeline (PI-007) provides chronological event data
- Pattern detection (PI-008) provides behavioral insights
- Retrospectives should be generated when a sprint/milestone completes or on demand

REQUIREMENTS:
1. Design retrospectives table in docs/retrospective-data-model.md:
   - id, organization_id, project_id, milestone_id (nullable for on-demand)
   - title, narrative (text — the AI-generated retrospective)
   - patterns_detected (jsonb — array of pattern references)
   - bottlenecks_found (jsonb — array of bottleneck references)
   - sop_opportunities (jsonb — array of SOP opportunity references)
   - key_metrics (jsonb — velocity, cycle time, blocked time, etc.)
   - action_items (jsonb — suggested improvements)
   - generated_at, generated_by
   - created_at, updated_at, deleted_at
2. Define triggers:
   - Automatic: when milestone.status changes to 'completed'
   - On-demand: user clicks "Generate Retrospective" button
3. Create migration SQL file: supabase/migrations/YYYYMMDD_create_retrospectives.sql
4. Add TypeScript types in src/types/process-intelligence.ts
5. Define the server action contract for generation

OUTPUT: Data model document, migration file, TypeScript types, action contract.`,
    prompt_context: 'Design retrospectives table schema and generation triggers (milestone completion + on-demand)',
    acceptance_criteria: `1) Retrospective data model documented\n2) Migration file created with retrospectives table\n3) Automatic trigger on milestone completion\n4) On-demand trigger via server action\n5) TypeScript types added\n6) Server action contract defined`,
  },
  {
    external_key: 'PI-016',
    title: 'Implement AI Retrospective Generation',
    description: 'Build the retrospective generation service that uses process timeline, patterns, and bottlenecks to produce a comprehensive sprint/milestone retrospective with AI. Includes what happened, why, key metrics, and improvement suggestions.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-20',
    end_date: '2026-06-23',
    estimate_hours: 10,
    order_index: 58,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Implement AI retrospective generation.

CONTEXT:
- Retrospective data model and triggers defined (PI-015)
- Process timeline reconstruction (PI-007) provides event sequences
- Pattern detection (PI-008) provides behavioral insights
- Bottleneck detection (PI-010) provides inefficiency data
- SOP detection (PI-013) provides standardization opportunities
- OpenAI GPT-4o available for narrative generation

REQUIREMENTS:
1. Create src/lib/process-intelligence/retrospective-generator.ts:
   - generateRetrospective(projectId, options?: {milestoneId?, dateRange?}) → Retrospective
   - Data gathering:
     * Fetch timeline from PI-007
     * Fetch patterns from PI-008
     * Fetch bottlenecks from PI-010
     * Fetch SOP opportunities from PI-013
     * Compute key metrics:
       - Velocity: tasks completed per week
       - Average cycle time: task start to done
       - Blocked time: total hours tasks spent blocked
       - On-time delivery: % tasks completed by target date
   - AI generation (OpenAI GPT-4o):
     * System prompt: "You are a senior project manager writing a retrospective..."
     * Input: structured data (timeline, patterns, bottlenecks, metrics)
     * Output: narrative with sections:
       - Executive Summary
       - What Went Well
       - What Could Be Improved
       - Key Metrics & Trends
       - Recommended Actions
2. Create server action: generateRetrospectiveAction(projectId, milestoneId?)
3. Save result to retrospectives table
4. Fire-and-forget embedding generation for the retrospective narrative
5. Cache generated retrospective (revalidate on next milestone completion)

OUTPUT: Retrospective generation service, server action, embedding integration.`,
    prompt_context: 'Generate comprehensive AI retrospectives from timeline, patterns, bottlenecks, and metrics',
    acceptance_criteria: `1) retrospective-generator.ts created\n2) Gathers data from timeline, patterns, bottlenecks, SOP opportunities\n3) Computes key metrics (velocity, cycle time, blocked time, on-time delivery)\n4) AI generates narrative with 5 sections\n5) Server action saves to retrospectives table\n6) Embedding fire-and-forget for narrative search\n7) Caching with milestone-triggered invalidation`,
  },
  {
    external_key: 'PI-017',
    title: 'Build Retrospective UI & Export',
    description: 'Create the retrospective viewing experience: a dedicated page showing the AI-generated retrospective with sections, metrics charts, and action items. Support PDF and Markdown export for sharing.',
    status: 'not_started',
    priority: 'p3',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-23',
    end_date: '2026-06-25',
    estimate_hours: 8,
    order_index: 59,
    prompt_body: `You are a Senior Frontend Engineer working on ProjectOps360°.

TASK: Build the retrospective viewing UI and export feature.

CONTEXT:
- Retrospectives generated by PI-016 stored in retrospectives table
- UI uses Next.js 16, React 19, Tailwind CSS, shadcn/ui
- Need: viewing page, metrics visualization, PDF/Markdown export

REQUIREMENTS:
1. Create src/app/[locale]/(app)/projects/[projectId]/execution-map/retrospectives/page.tsx:
   - List retrospectives with date, milestone, key metrics
   - Click → opens retrospective detail
2. Create src/components/process-intelligence/retrospective-view.tsx:
   - Sections: Executive Summary, What Went Well, Improvements, Metrics, Actions
   - Metrics visualization: simple bar charts using CSS (no chart library needed)
   - Action items: clickable cards that can be promoted to roadmap tasks
3. Create src/components/process-intelligence/retrospective-export.tsx:
   - "Export PDF" button: uses window.print() with print-friendly CSS
   - "Export Markdown" button: converts retrospective to Markdown format and downloads
4. Add i18n keys under "processIntelligence.retrospective" namespace
5. Integrate into Execution Map tab navigation
6. "Generate Retrospective" button on the list page (on-demand generation)

OUTPUT: Retrospective list page, detail view, export, i18n, integrated into Execution Map.`,
    prompt_context: 'Retrospective viewing UI with sections, metrics, action items, and PDF/Markdown export',
    acceptance_criteria: `1) Retrospective list page with date, milestone, metrics\n2) Detail view with 5 sections and metrics visualization\n3) Action items clickable → can promote to roadmap tasks\n4) PDF export via print-friendly CSS\n5) Markdown export via download\n6) i18n keys added\n7) Integrated into Execution Map tabs`,
  },

  // ── GROUP 6: Improvement Pipeline ───────────────────────────────────────────
  {
    external_key: 'PI-018',
    title: 'Implement Improvement Backlog Item Creation',
    description: 'Build the service that automatically creates improvement backlog items from process insights: bottleneck resolutions, SOP opportunities, pattern deviations, and retrospective action items.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-20',
    end_date: '2026-06-23',
    estimate_hours: 8,
    order_index: 60,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Implement improvement backlog item creation from process insights.

CONTEXT:
- Bottlenecks (PI-010) provide resolution recommendations
- SOP opportunities (PI-013) provide standardization candidates
- Pattern deviations (PI-008) provide correction suggestions
- Retrospectives (PI-016) provide action items
- Improvement items should be stored in roadmap_tasks with a specific sprint_name or external_key prefix

REQUIREMENTS:
1. Create src/lib/process-intelligence/improvement-creator.ts:
   - createImprovementFromBottleneck(bottleneck) → RoadmapTask
   - createImprovementFromSOP(sopOpportunity) → RoadmapTask
   - createImprovementFromDeviation(deviation) → RoadmapTask
   - createImprovementFromRetrospectiveAction(actionItem, retrospectiveId) → RoadmapTask
   - Each function:
     * Creates a roadmap_task with:
       - title: "Improvement: [source description]"
       - description: detailed improvement context
       - status: "not_started"
       - priority: based on source severity (critical bottleneck → p1, etc.)
       - milestone_id: null (improvement items are un-milestoned until promoted)
       - sprint_name: "Improvement Backlog"
       - external_key: "IMPROV-[uuid-suffix]"
       - prompt_body: AI prompt for implementing the improvement
       - prompt_context: "Auto-generated from Process Intelligence"
       - acceptance_criteria: from source recommendation
     * Inserts via createAdminClient()
2. Create server action: createImprovementItemsAction(projectId, source: 'bottlenecks' | 'sop' | 'deviations' | 'retrospective')
3. Batch creation: creates multiple items in one call
4. Deduplication: check if an improvement item already exists for the same source

OUTPUT: Improvement creation service, server action, deduplication logic.`,
    prompt_context: 'Auto-generate improvement backlog items from bottlenecks, SOPs, deviations, and retrospective actions',
    acceptance_criteria: `1) improvement-creator.ts with 4 creation functions\n2) Each function creates a roadmap_task with proper fields\n3) Priority mapped from source severity\n4) Server action createImprovementItemsAction created\n5) Batch creation supported\n6) Deduplication prevents duplicate improvement items`,
  },
  {
    external_key: 'PI-019',
    title: 'Build Improvement Backlog UI & Roadmap Integration',
    description: 'Create the improvement backlog view: list of improvement items with source badges, priority, and one-click promotion to a milestone-assigned roadmap task. Filter by source type and priority.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-23',
    end_date: '2026-06-25',
    estimate_hours: 8,
    order_index: 61,
    prompt_body: `You are a Senior Frontend Engineer working on ProjectOps360°.

TASK: Build the improvement backlog UI with roadmap integration.

CONTEXT:
- Improvement items created by PI-018 stored as roadmap_tasks with sprint_name="Improvement Backlog"
- Existing roadmap/roadmap-client.tsx shows tasks grouped by milestone
- Improvement items have no milestone (null) — they need a dedicated view
- Promotion: assigning a milestone_id and changing sprint_name

REQUIREMENTS:
1. Create src/app/[locale]/(app)/projects/[projectId]/execution-map/improvements/page.tsx:
   - Server component that fetches improvement backlog tasks
   - Filter by sprint_name = "Improvement Backlog"
2. Create src/components/process-intelligence/improvement-backlog.tsx:
   - Client component showing improvement items in a table/card layout
   - Columns: title, source badge (bottleneck/SOP/deviation/retrospective), priority, created date
   - Source badge styling: bottleneck=red, SOP=blue, deviation=amber, retrospective=purple
   - Click item → opens TaskFormDialog in edit mode (reuse existing component)
   - "Promote to Roadmap" button:
     * Opens milestone selector dialog
     * On select: updates task.milestone_id, task.sprint_name → removes "Improvement Backlog"
     * Refreshes both improvement list and roadmap
3. Create src/components/process-intelligence/promote-dialog.tsx:
   - Milestone selector with "No milestone" option
   - Optional: set sprint_name, estimate_hours
   - Confirm button calls promoteToRoadmapAction
4. Create server action: promoteToRoadmapAction(taskId, milestoneId, sprintName?)
5. Add i18n keys under "processIntelligence.improvements" namespace

OUTPUT: Improvement backlog page, promote dialog, server action, i18n.`,
    prompt_context: 'Improvement backlog view with source badges, priority filter, and one-click promotion to roadmap',
    acceptance_criteria: `1) Improvement backlog page under Execution Map\n2) Items shown with source badges (color-coded)\n3) Click opens TaskFormDialog for editing\n4) "Promote to Roadmap" with milestone selector\n5) Server action promoteToRoadmapAction created\n6) i18n keys added`,
  },

  // ── GROUP 7: Insight-to-Action ──────────────────────────────────────────────
  {
    external_key: 'PI-020',
    title: 'Design Insight-to-Action Approval Workflow',
    description: 'Design the workflow for converting process insights into user-approved actions. Define the approval states, the UI flow, and the data model for tracking which insights have been approved, rejected, or modified by the user.',
    status: 'not_started',
    priority: 'p1',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-20',
    end_date: '2026-06-21',
    estimate_hours: 4,
    order_index: 62,
    prompt_body: `You are a Senior Product Engineer working on ProjectOps360°.

TASK: Design the Insight-to-Action approval workflow.

CONTEXT:
- Process insights come from: bottlenecks, SOPs, patterns, retrospectives
- Some insights can be auto-converted to improvement items (PI-018)
- But critical decisions need user approval before becoming actions
- The workflow must be: Insight → Review → Approve/Modify/Reject → Action

REQUIREMENTS:
1. Create architecture document at docs/insight-to-action-workflow.md:
   - Approval states: pending_review, approved, modified, rejected, enacted
   - Workflow:
     * Insight generated → state: pending_review
     * User reviews → can approve, modify parameters, or reject
     * If approved → auto-create improvement item (PI-018) → state: enacted
     * If modified → update parameters → auto-create → state: enacted
     * If rejected → mark as rejected with reason → no action created
   - Data model:
     * insight_actions table: id, organization_id, project_id, insight_type, insight_source_id, title, description, proposed_action, approval_state, modified_params, rejection_reason, enacted_task_id, reviewed_by, reviewed_at, created_at
   - UI flow:
     * Notification badge when new insights pending review
     * Review panel with insight details + action buttons
     * History of approved/rejected insights
2. Create migration file: supabase/migrations/YYYYMMDD_create_insight_actions.sql
3. Add TypeScript types in src/types/process-intelligence.ts
4. Define server action contracts

OUTPUT: Workflow document, migration file, TypeScript types, action contracts.`,
    prompt_context: 'Design approval workflow for converting process insights into user-approved actions',
    acceptance_criteria: `1) Workflow document at docs/insight-to-action-workflow.md\n2) 5 approval states: pending_review, approved, modified, rejected, enacted\n3) insight_actions table migration created\n4) TypeScript types for InsightAction and ApprovalState\n5) Server action contracts defined`,
  },
  {
    external_key: 'PI-021',
    title: 'Implement Action Generation from Process Insights',
    description: 'Build the service that takes pending process insights and generates proposed actions with confidence scores, impact estimates, and effort estimates. Use AI to formulate the best action for each insight.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-23',
    end_date: '2026-06-25',
    estimate_hours: 10,
    order_index: 63,
    prompt_body: `You are a Senior Full Stack Engineer working on ProjectOps360°.

TASK: Implement action generation from process insights.

CONTEXT:
- Insight-to-Action workflow defined (PI-020)
- insight_actions table exists
- Process insights come from: bottleneck detection, SOP detection, pattern detection, retrospectives
- OpenAI GPT-4o available for action formulation

REQUIREMENTS:
1. Create src/lib/process-intelligence/action-generator.ts:
   - generateActionFromBottleneck(bottleneck) → ProposedAction
   - generateActionFromSOP(sopOpportunity) → ProposedAction
   - generateActionFromDeviation(deviation) → ProposedAction
   - generateActionFromRetrospective(actionItem) → ProposedAction
   - ProposedAction:
     * title, description: what should be done
     * confidence: 0-1 (AI confidence this action will help)
     * impactEstimate: low/medium/high (expected project impact)
     * effortEstimate: hours (estimated implementation effort)
     * riskIfIgnored: what happens if this action is not taken
     * steps: array of implementation steps
2. Each generator:
   - Takes the insight data as context
   - Calls OpenAI GPT-4o with structured prompt
   - Returns parsed ProposedAction
3. Batch generation: generatePendingInsightActions(projectId) → creates insight_actions records for all pending insights
4. Create server action: generateInsightActionsAction(projectId)
5. Deduplication: don't generate actions for insights that already have pending insight_actions

OUTPUT: Action generation service, batch processing, server action, deduplication.`,
    prompt_context: 'Generate AI-proposed actions from insights with confidence, impact, effort, and risk estimates',
    acceptance_criteria: `1) action-generator.ts with 4 generation functions\n2) Each returns ProposedAction with confidence, impact, effort, risk\n3) Batch generation processes all pending insights\n4) Server action generateInsightActionsAction created\n5) Deduplication prevents duplicate actions for same insight\n6) Actions stored in insight_actions table`,
  },
  {
    external_key: 'PI-022',
    title: 'Build Insight-to-Action UI with Approval Flow',
    description: 'Create the user interface for reviewing AI-proposed actions. Show the insight, the proposed action, confidence/impact/effort scores. User can approve, modify parameters, or reject. Approved actions are auto-created as roadmap tasks.',
    status: 'not_started',
    priority: 'p2',
    sprint_name: 'Sprint 12',
    start_date: '2026-06-25',
    end_date: '2026-06-27',
    estimate_hours: 10,
    order_index: 64,
    prompt_body: `You are a Senior Frontend Engineer working on ProjectOps360°.

TASK: Build the Insight-to-Action UI with approval flow.

CONTEXT:
- Insight actions generated by PI-021 stored in insight_actions table
- Approval workflow defined in PI-020 with 5 states
- Approved actions should auto-create roadmap_tasks via PI-018 improvement creator
- UI uses Next.js 16, React 19, Tailwind CSS, shadcn/ui, next-intl

REQUIREMENTS:
1. Create src/app/[locale]/(app)/projects/[projectId]/execution-map/insights/page.tsx:
   - Server component fetching pending and recent insight actions
   - Tabs: "Pending Review" (pending_review), "Enacted" (enacted), "Rejected" (rejected)
2. Create src/components/process-intelligence/insight-action-card.tsx:
   - Shows: insight source, title, description
   - Proposed action: steps, confidence %, impact badge, effort hours
   - Risk if ignored (highlighted in amber/red)
   - Three action buttons:
     * "Approve" (green) → calls approveInsightAction → creates roadmap_task → state: enacted
     * "Modify" (blue) → opens edit dialog to adjust params → then approve
     * "Reject" (red) → opens rejection reason dialog → state: rejected
3. Create src/components/process-intelligence/reject-dialog.tsx:
   - Rejection reason textarea (required)
   - "Confirm Rejection" button
4. Create server actions:
   - approveInsightActionAction(insightActionId) → creates roadmap_task, updates state
   - modifyInsightActionAction(insightActionId, params) → updates proposed action
   - rejectInsightActionAction(insightActionId, reason) → updates state + reason
5. Add i18n keys under "processIntelligence.insightToAction" namespace
6. Add notification badge count to sidebar when pending insights > 0

OUTPUT: Insight review page, action cards, approval flow, server actions, i18n, notification badge.`,
    prompt_context: 'UI for reviewing AI-proposed actions: approve, modify, or reject with auto task creation',
    acceptance_criteria: `1) Insight review page with 3 tabs (Pending, Enacted, Rejected)\n2) Action cards showing confidence, impact, effort, risk\n3) Approve → auto-create roadmap_task\n4) Modify → edit dialog → approve\n5) Reject → reason dialog → mark rejected\n6) Server actions for approve, modify, reject\n7) i18n keys added\n8) Notification badge in sidebar when pending > 0`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEPENDENCY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const dependencies = [
  // Group 1: Living Graph Foundation
  ['PI-001', 'PI-002'],   // Schema before migration
  ['PI-002', 'PI-003'],   // Tables before ingestion
  ['PI-002', 'PI-004'],   // Tables before traversal API
  ['PI-003', 'PI-005'],   // Data before visualization
  ['PI-004', 'PI-005'],   // Traversal for visualization
  // Group 2: Process Interpretation
  ['PI-001', 'PI-006'],   // Data model before interpretation architecture
  ['PI-006', 'PI-007'],   // Architecture before timeline
  ['PI-006', 'PI-008'],   // Architecture before pattern detection
  ['PI-007', 'PI-009'],   // Timeline before interpretation API
  ['PI-008', 'PI-009'],   // Patterns before interpretation API
  // Group 3: Bottleneck Detection
  ['PI-008', 'PI-010'],   // Patterns feed bottleneck detection
  ['PI-010', 'PI-011'],   // Detection before visualization
  ['PI-011', 'PI-012'],   // Visualization before alerting
  // Group 4: SOP Intelligence
  ['PI-008', 'PI-013'],   // Patterns feed SOP detection
  ['PI-013', 'PI-014'],   // Detection before generation
  // Group 5: Retrospective Engine
  ['PI-007', 'PI-015'],   // Timeline feeds retrospective model
  ['PI-015', 'PI-016'],   // Model before generation
  ['PI-016', 'PI-017'],   // Generation before UI
  // Group 6: Improvement Pipeline
  ['PI-010', 'PI-018'],   // Bottlenecks feed improvement items
  ['PI-013', 'PI-018'],   // SOP opportunities feed improvement items
  ['PI-018', 'PI-019'],   // Creation before backlog UI
  // Group 7: Insight-to-Action
  ['PI-012', 'PI-020'],   // Recommendations feed insight-to-action
  ['PI-018', 'PI-020'],   // Improvements feed insight-to-action
  ['PI-020', 'PI-021'],   // Workflow before action generation
  ['PI-021', 'PI-022'],   // Generation before UI
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEED EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log('🚀 Sprint 12 Seed — Starting...\n');

  // Step 1: Upsert Milestone
  console.log('📌 Step 1: Upserting milestone...');
  const { data: milestoneData, error: milestoneError } = await sb
    .from('milestones')
    .upsert({
      id: MILESTONE_ID,
      organization_id: ORG_ID,
      project_id: PROJECT_ID,
      title: 'Sprint 12 — Process Intelligence & Living Graph AI',
      description: 'Build the Process Intelligence layer: interpret the Living Graph, explain process behavior, detect bottlenecks, identify SOP opportunities, generate retrospectives, create improvement backlog items, and convert process insights into user-approved actions.',
      status: 'in_progress',
      start_date: '2026-06-09',
      target_date: '2026-06-27',
      progress_percent: 0,
      order_index: 120,
      icon_key: 'sparkles',
    }, { onConflict: 'id' })
    .select('id, title')
    .single();

  if (milestoneError) {
    console.error('❌ Milestone error:', milestoneError.message);
    // Try without id conflict (the partial unique index on title)
    const { data: existingMilestone } = await sb
      .from('milestones')
      .select('id')
      .eq('project_id', PROJECT_ID)
      .eq('title', 'Sprint 12 — Process Intelligence & Living Graph AI')
      .is('deleted_at', null)
      .single();

    if (existingMilestone) {
      console.log('📌 Milestone already exists, updating...');
      const { error: updateError } = await sb
        .from('milestones')
        .update({
          description: 'Build the Process Intelligence layer: interpret the Living Graph, explain process behavior, detect bottlenecks, identify SOP opportunities, generate retrospectives, create improvement backlog items, and convert process insights into user-approved actions.',
          status: 'in_progress',
          start_date: '2026-06-09',
          target_date: '2026-06-27',
          order_index: 120,
          icon_key: 'sparkles',
        })
        .eq('id', existingMilestone.id);
      if (updateError) console.error('❌ Milestone update error:', updateError.message);
      else console.log('✅ Milestone updated:', existingMilestone.id);
    }
  } else {
    console.log('✅ Milestone created:', milestoneData?.title);
  }

  // Step 2: Upsert Tasks
  console.log('\n📋 Step 2: Upserting 22 tasks...');
  const taskIds = {};

  for (const task of tasks) {
    // Check if task already exists
    const { data: existing } = await sb
      .from('roadmap_tasks')
      .select('id')
      .eq('project_id', PROJECT_ID)
      .eq('external_key', task.external_key)
      .is('deleted_at', null)
      .single();

    const payload = {
      organization_id: ORG_ID,
      project_id: PROJECT_ID,
      milestone_id: MILESTONE_ID,
      external_key: task.external_key,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      sprint_name: task.sprint_name,
      start_date: task.start_date,
      end_date: task.end_date,
      estimate_hours: task.estimate_hours,
      order_index: task.order_index,
      prompt_body: task.prompt_body,
      prompt_context: task.prompt_context,
      acceptance_criteria: task.acceptance_criteria,
    };

    if (existing) {
      const { error } = await sb
        .from('roadmap_tasks')
        .update(payload)
        .eq('id', existing.id);
      if (error) {
        console.error(`❌ ${task.external_key} update error:`, error.message);
      } else {
        taskIds[task.external_key] = existing.id;
        console.log(`  ✅ ${task.external_key} updated: ${task.title}`);
      }
    } else {
      const { data, error } = await sb
        .from('roadmap_tasks')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        console.error(`❌ ${task.external_key} insert error:`, error.message);
      } else {
        taskIds[task.external_key] = data.id;
        console.log(`  ✅ ${task.external_key} inserted: ${task.title}`);
      }
    }
  }

  // Step 3: Insert Dependencies
  console.log('\n🔗 Step 3: Inserting dependencies...');
  let depsCreated = 0;
  for (const [pred, succ] of dependencies) {
    const predId = taskIds[pred];
    const succId = taskIds[succ];
    if (!predId || !succId) {
      console.error(`  ⚠️ Skipping ${pred}→${succ}: missing ID`);
      continue;
    }

    // Check if dependency already exists
    const { data: existingDep } = await sb
      .from('task_dependencies')
      .select('id')
      .eq('predecessor_id', predId)
      .eq('successor_id', succId)
      .eq('dependency_type', 'finish_to_start')
      .single();

    if (existingDep) {
      console.log(`  ⏭️ ${pred} → ${succ} already exists`);
      continue;
    }

    const { error } = await sb
      .from('task_dependencies')
      .insert({
        organization_id: ORG_ID,
        project_id: PROJECT_ID,
        predecessor_id: predId,
        successor_id: succId,
        dependency_type: 'finish_to_start',
      });

    if (error) {
      console.error(`  ❌ ${pred} → ${succ} error:`, error.message);
    } else {
      depsCreated++;
      console.log(`  ✅ ${pred} → ${succ}`);
    }
  }

  // Step 4: Verification
  console.log('\n🔍 Step 4: Verification...');

  const { data: milestoneVerify } = await sb
    .from('milestones')
    .select('id, title, status')
    .eq('project_id', PROJECT_ID)
    .eq('title', 'Sprint 12 — Process Intelligence & Living Graph AI')
    .is('deleted_at', null)
    .single();
  console.log(`  Milestone: ${milestoneVerify?.title} (${milestoneVerify?.status})`);

  const { count: taskCount } = await sb
    .from('roadmap_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', PROJECT_ID)
    .like('external_key', 'PI-%')
    .is('deleted_at', null);
  console.log(`  Tasks: ${taskCount}/22`);

  const { count: depCount } = await sb
    .from('task_dependencies')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', PROJECT_ID);
  console.log(`  Dependencies created this run: ${depsCreated}`);
  console.log(`  Total dependencies in project: ${depCount}`);

  console.log('\n✨ Sprint 12 seed complete!');
}

seed().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});