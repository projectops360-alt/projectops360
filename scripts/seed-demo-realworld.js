// ============================================================================
// Seed: "Demo: Lanzamiento E-commerce" — realistic messy project
// ============================================================================
// Fictional small project (4 milestones, 22 tasks) with real-world problems:
// blocked tasks, overdue work, rework loops, a descoped task, resolved and
// active blockers, decisions, documents and traceability gaps. Inserts the
// project + roadmap + full Living Graph (process_nodes/process_edges).
// Idempotent: fixed UUIDs + upsert on id.
//
// Run: node scripts/seed-demo-realworld.js
// ============================================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const ORG_ID = '4f00f16b-96d8-4fd6-9375-20e2b11564a6';
const PROJECT_ID = 'de300000-0000-4000-8000-000000000001';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Deterministic IDs ----------------------------------------------------------
const mid = (n) => `de3000a0-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`; // milestones
const tid = (n) => `de3000b0-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`; // tasks
const nid = (n) => `de3000c0-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`; // process nodes
const eid = (n) => `de3000d0-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`; // process edges

// ── Milestones ───────────────────────────────────────────────────────────────
const milestones = [
  { id: mid(1), order_index: 0, icon_key: 'setup', title: 'M1 — Descubrimiento y Alcance', status: 'completed', progress_percent: 100, start_date: '2026-04-06', target_date: '2026-04-24', completed_date: '2026-04-28', description: 'Definición de objetivos, requisitos y presupuesto. Cerró 4 días tarde por aprobación de presupuesto demorada.' },
  { id: mid(2), order_index: 1, icon_key: 'sparkles', title: 'M2 — Diseño y Prototipo', status: 'completed', progress_percent: 100, start_date: '2026-04-27', target_date: '2026-05-15', completed_date: '2026-05-22', description: 'Diseño UI y prototipo validado. Hubo retrabajo: el prototipo reveló requisitos incompletos.' },
  { id: mid(3), order_index: 2, icon_key: 'shield_database', title: 'M3 — Desarrollo', status: 'in_progress', progress_percent: 45, start_date: '2026-05-25', target_date: '2026-06-19', completed_date: null, description: 'Construcción de la tienda. Dos bloqueos activos: credenciales de pagos y datos de productos corruptos.' },
  { id: mid(4), order_index: 3, icon_key: 'rocket', title: 'M4 — QA y Lanzamiento', status: 'planned', progress_percent: 0, start_date: '2026-06-22', target_date: '2026-07-10', completed_date: null, description: 'Pruebas y go-live. En riesgo por los retrasos de M3.' },
];

// ── Tasks ────────────────────────────────────────────────────────────────────
// status, priority, progress, dates, is_blocked, blocker_reason, is_critical
const T = (n, milestone, title, props) => ({
  id: tid(n),
  organization_id: ORG_ID,
  project_id: PROJECT_ID,
  milestone_id: mid(milestone),
  external_key: `EC-${String(n).padStart(3, '0')}`,
  title,
  order_index: n,
  sprint_name: null,
  progress: 0,
  is_blocked: false,
  blocker_reason: null,
  is_critical: false,
  priority: 'p2',
  ...props,
});

const tasks = [
  // M1 — completada (con retraso real en presupuesto)
  T(1, 1, 'Kickoff y definición de objetivos', { status: 'done', progress: 100, start_date: '2026-04-06', end_date: '2026-04-08', estimate_hours: 6, actual_hours: 5 }),
  T(2, 1, 'Levantamiento de requisitos', { status: 'done', progress: 100, start_date: '2026-04-08', end_date: '2026-04-14', estimate_hours: 16, actual_hours: 22, execution_notes: 'Se reabrió en mayo: el prototipo reveló requisitos incompletos (retrabajo).' }),
  T(3, 1, 'Benchmark de competencia', { status: 'done', progress: 100, start_date: '2026-04-09', end_date: '2026-04-13', estimate_hours: 8, actual_hours: 8 }),
  T(4, 1, 'Definición de catálogo inicial', { status: 'done', progress: 100, start_date: '2026-04-13', end_date: '2026-04-20', estimate_hours: 10, actual_hours: 15, execution_notes: 'Tomó 50% más de lo estimado: el cliente cambió la categorización dos veces.' }),
  T(5, 1, 'Aprobación de presupuesto', { status: 'done', progress: 100, priority: 'p1', is_critical: true, start_date: '2026-04-20', end_date: '2026-04-28', estimate_hours: 4, actual_hours: 4, execution_notes: 'Aprobada 4 días tarde: el sponsor estaba de viaje. Retrasó el inicio de diseño.' }),

  // M2 — completada con retrabajo y un bloqueo resuelto
  T(6, 2, 'Wireframes de páginas clave', { status: 'done', progress: 100, start_date: '2026-04-29', end_date: '2026-05-05', estimate_hours: 12, actual_hours: 12 }),
  T(7, 2, 'Diseño visual y UI kit', { status: 'done', progress: 100, start_date: '2026-05-05', end_date: '2026-05-12', estimate_hours: 16, actual_hours: 18 }),
  T(8, 2, 'Prototipo navegable', { status: 'done', progress: 100, is_critical: true, start_date: '2026-05-11', end_date: '2026-05-18', estimate_hours: 12, actual_hours: 16, execution_notes: 'Generó retrabajo: faltaban requisitos del flujo de devoluciones.' }),
  T(9, 2, 'Validación con usuarios', { status: 'done', progress: 100, start_date: '2026-05-14', end_date: '2026-05-21', estimate_hours: 10, actual_hours: 10, execution_notes: 'Estuvo bloqueada 4 días: no había usuarios reclutados para las pruebas.' }),
  T(10, 2, 'Handoff a desarrollo', { status: 'done', progress: 100, start_date: '2026-05-21', end_date: '2026-05-22', estimate_hours: 3, actual_hours: 3 }),

  // M3 — en progreso, el caos real
  T(11, 3, 'Setup de infraestructura', { status: 'done', progress: 100, start_date: '2026-05-25', end_date: '2026-05-28', estimate_hours: 8, actual_hours: 9 }),
  T(12, 3, 'Catálogo y carrito de compra', { status: 'in_progress', progress: 60, priority: 'p1', is_critical: true, start_date: '2026-05-28', end_date: '2026-06-06', estimate_hours: 24, actual_hours: 26, execution_notes: 'VENCIDA: debió terminar el 6 de junio. Retrabajo por cambios de inventario.' }),
  T(13, 3, 'Pasarela de pagos', { status: 'blocked', progress: 25, priority: 'p1', is_critical: true, is_blocked: true, blocker_reason: 'Esperando credenciales de producción del proveedor PayFlow desde el 3 de junio. Sin ETA confirmado.', start_date: '2026-06-01', end_date: '2026-06-10', estimate_hours: 16, actual_hours: 6 }),
  T(14, 3, 'Integración de inventario', { status: 'in_progress', progress: 40, priority: 'p1', start_date: '2026-06-03', end_date: '2026-06-12', estimate_hours: 14, actual_hours: 8, dependency_notes: 'Depende de EC-013 (pasarela) para el flujo de stock reservado.', execution_notes: 'Riesgo alto: el API del ERP devuelve datos inconsistentes.' }),
  T(15, 3, 'Migración de datos de productos', { status: 'blocked', progress: 10, is_blocked: true, blocker_reason: 'Los datos fuente tienen errores de formato (30% de SKUs sin precio). Esperando archivo corregido del cliente.', start_date: '2026-06-04', end_date: '2026-06-11', estimate_hours: 10, actual_hours: 2 }),
  T(16, 3, 'Panel de administración', { status: 'deferred', progress: 0, priority: 'p3', start_date: null, end_date: null, estimate_hours: 20, execution_notes: 'Aplazado a fase 2 por decisión del 5 de junio para proteger la fecha de lanzamiento.' }),

  // M4 — planeada, en riesgo, sin evidencia (brechas de trazabilidad)
  T(17, 4, 'Plan de pruebas', { status: 'not_started', progress: 0, start_date: '2026-06-22', end_date: '2026-06-24', estimate_hours: 6 }),
  T(18, 4, 'Pruebas E2E', { status: 'not_started', progress: 0, priority: 'p1', is_critical: true, start_date: '2026-06-24', end_date: '2026-07-01', estimate_hours: 16 }),
  T(19, 4, 'Pruebas de carga', { status: 'not_started', progress: 0, start_date: '2026-06-29', end_date: '2026-07-02', estimate_hours: 8 }),
  T(20, 4, 'Capacitación del equipo de tienda', { status: 'not_started', progress: 0, priority: 'p3', start_date: '2026-07-01', end_date: '2026-07-03', estimate_hours: 6 }),
  T(21, 4, 'Checklist de lanzamiento', { status: 'not_started', progress: 0, priority: 'p1', is_critical: true, start_date: '2026-07-06', end_date: '2026-07-08', estimate_hours: 4 }),
  T(22, 4, 'Go-live', { status: 'not_started', progress: 0, priority: 'p1', is_critical: true, start_date: '2026-07-09', end_date: '2026-07-10', estimate_hours: 6 }),
];

// ── Process graph ────────────────────────────────────────────────────────────
// Nodes: 4 gates (n1-4), 22 task transitions (n11-32), 3 blockers (n41-43),
// 3 documents (n51-53), 2 decisions (n61-62)
const N = (id, node_type, source_entity_type, source_entity_id, title, occurred_at, metadata = {}) => ({
  id,
  organization_id: ORG_ID,
  project_id: PROJECT_ID,
  node_type,
  source_entity_type,
  source_entity_id,
  title,
  metadata,
  occurred_at,
});

const taskNode = (n) => nid(10 + n); // task k → node id 10+k

const nodes = [
  N(nid(1), 'milestone_gate', 'milestones', mid(1), 'M1 — Descubrimiento y Alcance', '2026-04-06T09:00:00Z'),
  N(nid(2), 'milestone_gate', 'milestones', mid(2), 'M2 — Diseño y Prototipo', '2026-04-27T09:00:00Z'),
  N(nid(3), 'milestone_gate', 'milestones', mid(3), 'M3 — Desarrollo', '2026-05-25T09:00:00Z'),
  N(nid(4), 'milestone_gate', 'milestones', mid(4), 'M4 — QA y Lanzamiento', '2026-06-22T09:00:00Z'),
  // Task transitions (occurred_at = task start, staggered)
  ...tasks.map((t, i) =>
    N(taskNode(i + 1), 'task_transition', 'roadmap_tasks', t.id, t.title,
      `${t.start_date ?? '2026-06-05'}T10:00:00Z`,
      { new_status: t.status, demo_realworld: true }),
  ),
  // Blockers (2 active, 1 resolved)
  N(nid(41), 'blocker_event', 'roadmap_tasks', tid(13), 'Bloqueo: credenciales de PayFlow pendientes', '2026-06-03T14:00:00Z', { is_blocked: true, active: true }),
  N(nid(42), 'blocker_event', 'roadmap_tasks', tid(15), 'Bloqueo: datos de productos con errores de formato', '2026-06-05T11:00:00Z', { is_blocked: true, active: true }),
  N(nid(43), 'blocker_event', 'roadmap_tasks', tid(9), 'Bloqueo (resuelto): sin usuarios para validación', '2026-05-14T10:00:00Z', { is_blocked: false, resolved_at: '2026-05-18' }),
  // Documents
  N(nid(51), 'document_link', 'documents', nid(51), 'Documento de requisitos v2', '2026-05-19T16:00:00Z'),
  N(nid(52), 'document_link', 'documents', nid(52), 'Contrato proveedor de pagos PayFlow', '2026-05-30T12:00:00Z'),
  N(nid(53), 'document_link', 'documents', nid(53), 'Acta de handoff diseño → desarrollo', '2026-05-22T15:00:00Z'),
  // Decisions
  N(nid(61), 'decision_cascade', 'decisions', nid(61), 'Decisión: aplazar panel admin a fase 2', '2026-06-05T17:00:00Z'),
  N(nid(62), 'decision_cascade', 'decisions', nid(62), 'Decisión: PayFlow como proveedor de pagos', '2026-05-28T13:00:00Z'),
];

const E = (id, from, to, edge_type, weight = 1, metadata = {}) => ({
  id,
  organization_id: ORG_ID,
  project_id: PROJECT_ID,
  from_node_id: from,
  to_node_id: to,
  edge_type,
  weight,
  metadata: { demo_realworld: true, ...metadata },
});

let e = 0;
const edges = [
  // Gates enable their tasks
  ...tasks.map((t, i) => {
    const m = Number(t.milestone_id.slice(-2));
    return E(eid(++e), nid(m), taskNode(i + 1), 'enabled');
  }),
  // Sequential flow inside milestones + handoffs between milestones
  E(eid(++e), taskNode(1), taskNode(2), 'caused'),
  E(eid(++e), taskNode(2), taskNode(4), 'caused', 2),
  E(eid(++e), taskNode(3), taskNode(4), 'informed'),
  E(eid(++e), taskNode(4), taskNode(5), 'caused', 2),
  E(eid(++e), taskNode(5), taskNode(6), 'accelerated', 1, { handoff: 'M1→M2' }),
  E(eid(++e), taskNode(6), taskNode(7), 'caused'),
  E(eid(++e), taskNode(7), taskNode(8), 'caused', 2),
  E(eid(++e), taskNode(8), taskNode(9), 'caused', 2),
  E(eid(++e), taskNode(9), taskNode(10), 'caused'),
  E(eid(++e), taskNode(10), taskNode(11), 'accelerated', 1, { handoff: 'M2→M3' }),
  E(eid(++e), taskNode(11), taskNode(12), 'caused', 2),
  E(eid(++e), taskNode(11), taskNode(13), 'caused'),
  E(eid(++e), taskNode(12), taskNode(14), 'caused', 2),
  E(eid(++e), taskNode(13), taskNode(14), 'caused', 3, { reason: 'flujo de stock reservado depende de pagos' }),
  E(eid(++e), taskNode(13), taskNode(15), 'caused'),
  E(eid(++e), taskNode(14), taskNode(18), 'caused', 2),
  E(eid(++e), taskNode(12), taskNode(18), 'caused', 2),
  E(eid(++e), taskNode(17), taskNode(18), 'caused'),
  E(eid(++e), taskNode(18), taskNode(19), 'caused'),
  E(eid(++e), taskNode(18), taskNode(21), 'caused', 2),
  E(eid(++e), taskNode(20), taskNode(22), 'informed'),
  E(eid(++e), taskNode(21), taskNode(22), 'caused', 3),
  // Rework loops (delayed back-edges)
  E(eid(++e), taskNode(8), taskNode(2), 'delayed', 2, { reason: 'prototipo reveló requisitos incompletos del flujo de devoluciones' }),
  E(eid(++e), taskNode(14), taskNode(12), 'delayed', 1, { reason: 'cambios de inventario obligaron a rehacer parte del carrito' }),
  // Blockers block tasks (B3 históricamente bloqueó T9)
  E(eid(++e), nid(41), taskNode(13), 'blocked', 2),
  E(eid(++e), nid(42), taskNode(15), 'blocked', 2),
  E(eid(++e), nid(43), taskNode(9), 'blocked', 1, { resolved: true }),
  // Evidence / decisions
  E(eid(++e), nid(51), taskNode(2), 'informed'),
  E(eid(++e), nid(52), taskNode(13), 'informed'),
  E(eid(++e), nid(53), taskNode(11), 'informed'),
  E(eid(++e), nid(61), taskNode(16), 'informed', 1, { decision: 'descope' }),
  E(eid(++e), nid(62), taskNode(13), 'caused', 1, { decision: 'vendor' }),
];

// ── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding "Demo: Lanzamiento E-commerce"…');

  const { error: pErr } = await sb.from('projects').upsert({
    id: PROJECT_ID,
    organization_id: ORG_ID,
    slug: 'demo-lanzamiento-ecommerce',
    title_i18n: { en: 'Demo: E-commerce Launch', es: 'Demo: Lanzamiento E-commerce' },
    description_i18n: {
      en: 'Fictional demo project with real-world problems: blockers, delays, rework and scope cuts.',
      es: 'Proyecto demo ficticio con problemas de la vida real: bloqueos, retrasos, retrabajo y recortes de alcance.',
    },
    status: 'active',
    start_date: '2026-04-06',
    target_end_date: '2026-07-10',
  }, { onConflict: 'id' });
  if (pErr) throw new Error(`projects: ${pErr.message}`);
  console.log('✔ project');

  const { error: mErr } = await sb.from('milestones').upsert(
    milestones.map((m) => ({ ...m, organization_id: ORG_ID, project_id: PROJECT_ID })),
    { onConflict: 'id' },
  );
  if (mErr) throw new Error(`milestones: ${mErr.message}`);
  console.log(`✔ ${milestones.length} milestones`);

  const { error: tErr } = await sb.from('roadmap_tasks').upsert(tasks, { onConflict: 'id' });
  if (tErr) throw new Error(`roadmap_tasks: ${tErr.message}`);
  console.log(`✔ ${tasks.length} tasks`);

  // ── Reconcile milestone status from task data ──────────────────────────────────
  // After seeding tasks, recalculate each milestone's status and progress_percent
  // so the UI shows correct computed state rather than stale hardcoded values.
  const TASK_COMPLETE_STATUSES = ['done'];
  for (const m of milestones) {
    const mTasks = tasks.filter(t => t.milestone_id === m.id);
    const total = mTasks.length;
    const done = mTasks.filter(t => TASK_COMPLETE_STATUSES.includes(t.status)).length;
    const blocked = mTasks.filter(t => t.status === 'blocked').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : m.progress_percent;
    let status;
    if (total === 0) status = m.status;
    else if (done === total) status = 'completed';
    else if (blocked === total) status = 'blocked';
    else if (blocked > 0) status = 'at_risk';
    else if (done > 0) status = 'in_progress';
    else status = 'planned';

    if (status !== m.status || progress !== m.progress_percent) {
      const { error: uErr } = await sb.from('milestones')
        .update({ status, progress_percent: progress })
        .eq('id', m.id);
      if (uErr) console.warn(`⚠ milestone ${m.id} reconcile failed: ${uErr.message}`);
      else console.log(`  ↻ milestone "${m.title}": ${m.status}→${status}, ${m.progress_percent}%→${progress}%`);
    }
  }

  const { error: nErr } = await sb.from('process_nodes').upsert(nodes, { onConflict: 'id' });
  if (nErr) throw new Error(`process_nodes: ${nErr.message}`);
  console.log(`✔ ${nodes.length} process nodes`);

  const { error: eErr } = await sb.from('process_edges').upsert(edges, { onConflict: 'id' });
  if (eErr) throw new Error(`process_edges: ${eErr.message}`);
  console.log(`✔ ${edges.length} process edges`);

  // ── Seed task dependencies ──────────────────────────────────────────────────────
  // Derive finish_to_start dependencies from the task sequence logic:
  // predecessors must complete before successors can start.
  const deps = [
    // M1: Kickoff → Requisitos → Catálogo → Presupuesto
    { predecessor_id: tid(1), successor_id: tid(2) }, // Kickoff → Requisitos
    { predecessor_id: tid(2), successor_id: tid(4) }, // Requisitos → Catálogo
    { predecessor_id: tid(3), successor_id: tid(4) }, // Benchmark → Catálogo
    { predecessor_id: tid(4), successor_id: tid(5) }, // Catálogo → Presupuesto

    // M1 → M2 handoff
    { predecessor_id: tid(5), successor_id: tid(6) }, // Presupuesto → Wireframes

    // M2: Wireframes → Diseño visual → Prototipo → Validación → Handoff
    { predecessor_id: tid(6), successor_id: tid(7) }, // Wireframes → Diseño visual
    { predecessor_id: tid(7), successor_id: tid(8) }, // Diseño visual → Prototipo
    { predecessor_id: tid(8), successor_id: tid(9) }, // Prototipo → Validación
    { predecessor_id: tid(9), successor_id: tid(10) }, // Validación → Handoff

    // M2 → M3 handoff
    { predecessor_id: tid(10), successor_id: tid(11) }, // Handoff → Setup infra

    // M3: Setup → Catálogo, Pagos; Catálogo+Pagos → Inventario; Pagos → Migración
    { predecessor_id: tid(11), successor_id: tid(12) }, // Setup → Catálogo/carrito
    { predecessor_id: tid(11), successor_id: tid(13) }, // Setup → Pasarela de pagos
    { predecessor_id: tid(12), successor_id: tid(14) }, // Catálogo → Inventario
    { predecessor_id: tid(13), successor_id: tid(14) }, // Pagos → Inventario
    { predecessor_id: tid(13), successor_id: tid(15) }, // Pagos → Migración datos

    // M3 → M4 handoff (Development must complete before QA)
    { predecessor_id: tid(12), successor_id: tid(18) }, // Catálogo → Pruebas E2E
    { predecessor_id: tid(14), successor_id: tid(18) }, // Inventario → Pruebas E2E

    // M4: Plan de pruebas → Pruebas E2E → Pruebas de carga; Checklist → Go-live
    { predecessor_id: tid(17), successor_id: tid(18) }, // Plan de pruebas → Pruebas E2E
    { predecessor_id: tid(18), successor_id: tid(19) }, // Pruebas E2E → Pruebas de carga
    { predecessor_id: tid(18), successor_id: tid(21) }, // Pruebas E2E → Checklist
    { predecessor_id: tid(21), successor_id: tid(22) }, // Checklist → Go-live
    { predecessor_id: tid(20), successor_id: tid(22) }, // Capacitación → Go-live
  ].map((d, i) => ({
    id: `dep-seed-${String(i + 1).padStart(3, '0')}`,
    organization_id: ORG_ID,
    project_id: PROJECT_ID,
    predecessor_id: d.predecessor_id,
    successor_id: d.successor_id,
    dependency_type: 'finish_to_start',
    lag_days: 0,
  }));

  const { error: dErr } = await sb.from('task_dependencies').upsert(deps, { onConflict: 'id' });
  if (dErr) {
    console.warn(`⚠ task_dependencies: ${dErr.message} (table may not exist yet)`);
  } else {
    console.log(`✔ ${deps.length} task dependencies`);
  }

  console.log(`\nDone. Project: ${PROJECT_ID}`);
  console.log('Living Graph: /projects/' + PROJECT_ID + '/execution-map/living-graph');
}

main().catch((err) => {
  console.error('SEED FAILED:', err.message);
  process.exit(1);
});
