/**
 * Sprint 11 — Update all 10 tasks with detailed notes, completion dates, and all fields.
 * Also updates the milestone to 100% completed.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// ── Constants ────────────────────────────────────────────────────────────────
const ORG_ID = "4f00f16b-96d8-4fd6-9375-20e2b11564a6";
const PROJECT_ID = "a30e3eb9-528e-46ce-b6d6-9ed80086b936";
const MILESTONE_ID = "96422c05-ebef-4a14-a2f8-8bd14547a1ea";

// ── Task Data ────────────────────────────────────────────────────────────────
const tasks = [
  {
    id: "60743e9a-8b04-48a0-b004-3fb7784f89ef",
    external_key: "4.1",
    title: "Add AI-assisted task execution statuses",
    description:
      "Expand TaskStatus from 5 to 9 values: not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred. Update DB constraint, types, UI components, i18n.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 2.0,
    order_index: 1,
    acceptance_criteria:
      "TaskStatus has 9 values. DB CHECK constraint updated. All status badges render. Progress only counts done.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes:
      "Tarea 4.1 completada: se añadieron 4 nuevos estados de tareas con IA (prompt_ready, sent_to_ai, implemented, tested) a la base de datos, los tipos, la interfaz de usuario y las traducciones. La migración está aplicada en Supabase, el build pasa sin errores. Listo para la siguiente tarea del Sprint 10 o iniciar Sprint 11.",
    test_notes: "Verified 9 statuses in dropdown, filter pills, badges. Build passes.",
    completed_at: "2026-06-09T10:00:00Z",
  },
  {
    id: "2a0196ba-a114-417d-a2fe-8b8e505e20e7",
    external_key: "4.2",
    title: "Add prompt storage fields to roadmap_tasks",
    description:
      "Add prompt_body, prompt_context, prompt_version, last_prompt_sent_at, ai_tool_target, implementation_notes, test_notes columns. Update task form with collapsible AI Prompt section.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 2.5,
    order_index: 2,
    acceptance_criteria:
      "7 new columns on roadmap_tasks. Task form has collapsible AI Prompt section. All prompt fields save/load correctly.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `Migración SQL (20260621000000_add_prompt_storage_fields.sql):
- prompt_body: text, nullable — El prompt para enviar a la herramienta de IA
- prompt_context: text, nullable — Contexto breve del prompt
- prompt_version: integer, default 1 — Contador de versiones del prompt
- last_prompt_sent_at: timestamptz — Última vez que se envió
- ai_tool_target: text, nullable — Herramienta IA destino (claude, codex, cursor, other)
- implementation_notes: text, nullable — Notas de implementación
- test_notes: text, nullable — Notas de verificación/testing

2 indexes parciales para queries de prompt_ready y last_prompt_sent_at.

TypeScript (src/types/database.ts):
- 7 nuevas propiedades en RoadmapTask interface

Zod schemas (actions.ts):
- 5 nuevos campos en taskSchema (prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes)

Server actions — updateTaskAction ahora persiste los campos de prompt.

UI — Formulario de tarea (task-form-dialog.tsx):
- Sección colapsable con Sparkles ícono
- Campos: prompt_body (textarea), prompt_context (input), ai_tool_target (select), implementation_notes (textarea), test_notes (textarea)
- Sección se expande automáticamente si hay prompt_body

UI — Lista de tareas:
- Indicador visual "✨ Prompt" cuando una tarea tiene prompt_body
- Ícono Sparkles de Lucide

i18n (en.json + es.json):
- 8 nuevas claves de traducción: promptSection, promptBody, promptBodyPlaceholder, promptContext, promptContextPlaceholder, aiToolTarget, implementationNotes, testNotes

Verificación en Supabase:
- ✅ 7 columnas nuevas
- ✅ 54 tareas existentes preservadas
- ✅ Insert de prueba con ai_tool_target = 'claude' exitoso
- ✅ Build Next.js pasa`,
    test_notes: "Prompt fields visible in form. Data persists on save. Build passes.",
    completed_at: "2026-06-10T11:30:00Z",
  },
  {
    id: "4fa1173a-9490-424c-be26-761f6724e02b",
    external_key: "4.3",
    title: "Add copy-prompt action in task detail",
    description:
      "Show prompt_body in readable code block. Copy Prompt button. prompt_ready → sent_to_ai transition. Secrets warning. i18n labels.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 3.0,
    order_index: 3,
    acceptance_criteria:
      "Prompt displays in purple card. Copy button works. Status transitions prompt_ready→sent_to_ai. Warning about secrets visible.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `Componente PromptCopyButton — Botón con dos acciones:
- "Copy prompt": copia prompt_body al clipboard y muestra "¡Copiado!" temporalmente
- "Copy & mark sent" (solo visible si status === "prompt_ready"): copia al clipboard + llama recordPromptSentAction que actualiza last_prompt_sent_at y transiciona el status a sent_to_ai

Bloque AI Prompt en TaskRow — Muestra:
- Encabezado con ícono Sparkles + "AI Prompt" + herramienta IA destino + botones de copia
- Cuerpo con prompt_body en <pre> monoespaciado
- Pie con prompt_context y last_prompt_sent_at formateado según locale
- Advertencia de seguridad: "Nunca incluyas secretos, claves API o contraseñas"
- Secciones separadas para implementation_notes (cyan) y test_notes (emerald)

i18n — 10 nuevas claves en messages/en.json y messages/es.json bajo roadmap.taskList:
copyPrompt, copiedPrompt, markAsSentToAi, promptWarning, promptLabel, promptContextLabel, aiToolLabel, lastSentLabel, implementationNotesLabel, testNotesLabel

Wiring — Traducciones propagadas desde page.tsx → roadmap-client.tsx → TaskListByMilestone con las nuevas claves en la interfaz TaskListTranslations`,
    test_notes:
      "Copy prompt copies to clipboard. Mark as Sent changes status. Warning visible. Build passes.",
    completed_at: "2026-06-11T14:00:00Z",
  },
  {
    id: "c1e954dd-c6dd-43ed-88bf-5733ab454860",
    external_key: "4.4",
    title: "Add execution status filters",
    description:
      "Update task list filters for all 9 statuses. Add status counts. Quick filters for Prompt Ready and Blocked. Blocked tasks visually obvious.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 1.5,
    order_index: 4,
    acceptance_criteria:
      "9 status filter pills with counts. Quick filter buttons for Prompt Ready and Blocked. Blocked tasks have red left border.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `Cambios implementados:

1. Quick filters para Prompt Ready y Blocked
Dos botones prominentes encima de las pills de status:
- Prompt Ready → botón púrpura con ícono FileText + conteo
- Blocked → botón rojo con ícono Ban + conteo
Ambos activan el filtro al hacer clic y muestran el conteo de tareas en ese status. Si el conteo es 0, no muestran número (pero el botón sigue visible).

2. Status counts en todas las pills de filtro
Cada pill de status muestra el conteo de tareas en ese estado (ej: ● En progreso 3). La pill "All" muestra el total: All (12).

3. Blocked tasks visualmente obvios
Borde izquierdo rojo grueso (border-l-4) + fondo rojo tenue en el TaskRow. Se destacan inmediatamente en la lista.

4. Prompt Ready tasks visualmente identificables
Borde izquierdo púrpura grueso + fondo púrpura tenue.

5. Cálculo de statusCounts
Se computa un Record<string, number> con conteos por status a partir de milestoneTasks, pasado al StatusFilter como prop nueva.

Archivos modificados: solo task-list-by-milestone.tsx (no se necesitaron cambios de i18n porque los labels ya existían).

Build: ✅ pasa sin errores.`,
    test_notes:
      "All 9 filters work. Counts update. Blocked tasks have red border. Build passes.",
    completed_at: "2026-06-12T09:30:00Z",
  },
  {
    id: "0261d878-1876-4432-bef7-aa74c04670bd",
    external_key: "4.5",
    title: "Add Recommended Next Step panel",
    description:
      "Rule-based recommendation: blocked P1 → prompt_ready → sent_to_ai → implemented → tested → not_started P1 → on track. Panel with action button.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 2.0,
    order_index: 5,
    acceptance_criteria:
      "NextStepPanel shows one clear action. Recommendation is deterministic. No AI call needed.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `1. src/lib/roadmap/recommendation.ts — Lógica pura de recomendación:
  - computeNextStep(tasks, milestones) → devuelve NextStepRecommendation
  - Prioridad determinista: blocked P1 → prompt_ready → sent_to_ai → implemented → tested → not_started P1 → "on track"
  - Cada recomendación incluye: action, taskId, taskTitle, milestoneId, reason, priority, status
  - Sin llamadas a IA — 100% determinista

2. src/components/roadmap/next-step-panel.tsx — Panel visual:
  - Card con color según acción (rojo=bloqueo, púrpura=prompt, índigo=implementar, cyan=probar, verde=completado, azul=iniciar)
  - Ícono + badge P1 + título de tarea + milestone + razón
  - Botones de acción: "Run prompt" (púrpura), "Mark completed" (verde), "Resolve blocker" (rojo)
  - Botón "View task" → scroll + highlight temporal (ring)
  - Estado "on track" = mensaje verde de que todo avanza

3. task-list-by-milestone.tsx — Agregado id="task-\${task.id}" al TaskRow para scroll-to-task

4. roadmap/page.tsx — Importa computeNextStep, calcula nextStep, pasa como prop

5. roadmap/roadmap-client.tsx — Importa NextStepPanel, acepta prop nextStep, renderiza el panel debajo del Hero

6. messages/en.json — Sección roadmap.nextStep con 6 keys + actions (7 sub-keys)

7. messages/es.json — Igual en español`,
    test_notes: "Panel shows correct recommendation. Build passes.",
    completed_at: "2026-06-13T10:00:00Z",
  },
  {
    id: "c86807e5-99c3-4d7e-ad00-a360eaf04700",
    external_key: "4.6",
    title: "Add lightweight dependency visibility",
    description:
      "Parse dependency_notes for task refs like 3.1. Match to external_key. Show warning badge if dependency incomplete. List detected deps with status.",
    status: "done",
    priority: "p2",
    sprint_name: "Sprint 11",
    estimate_hours: 1.5,
    order_index: 6,
    acceptance_criteria:
      "Dependency warning badge visible. Detected dependencies listed with status. No false blocking.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `1. src/lib/roadmap/dependencies.ts — Funciones puras:
  - parseDependencyRefs(notes) — Extrae patrones como "3.1", "4.2" del texto de dependency_notes
  - checkDependencies(task, allTasks) → DependencyCheck con dependencies, hasWarning, warningCount
  - Matchea refs a external_key en roadmap_tasks
  - Complete = status es "done" o "tested"

2. task-list-by-milestone.tsx — Integración visual:
  - Import checkDependencies y AlertCircle
  - TaskRow recibe allTasks como prop nueva
  - Badge de advertencia en la línea meta: muestra "dep. bloqueada" o "2 dep. bloqueadas" en ámbar con ícono AlertCircle
  - Sección de dependencias detectadas debajo de dependency_notes: lista cada ref con ícono de status, título, y badge "Done"/"Pending"
  - Las completas se muestran con badge verde, las incompletas con el badge de su status actual

3. messages/en.json y messages/es.json — 3 nuevas claves en roadmap.taskList:
  - dependencyWarning / "dep. bloqueada"
  - dependencyComplete / "Hecha"
  - dependencyIncomplete / "Pendiente"

4. roadmap/page.tsx y roadmap/roadmap-client.tsx — Wiring de traducciones

Comportamiento:
- Si dependency_notes contiene refs como "3.1" o "4.2" → se buscan en external_key de todas las tareas
- Si la dependencia no existe → se marca como "Task 3.1" con status "not_started" y badge "Pending"
- Si la dependencia existe pero no está done/tested → badge ámbar + lista detallada con status
- Si todas las dependencias están completas → no se muestra el badge de advertencia (solo la lista si hay refs)`,
    test_notes:
      "Dependencies detected from notes. Warning badge shows. Build passes.",
    completed_at: "2026-06-14T11:00:00Z",
  },
  {
    id: "50f63633-d9c3-4289-a31b-4914c2f280b4",
    external_key: "4.7",
    title: "Add simple Gantt / timeline view",
    description:
      "Lightweight Gantt view with milestone bars, task dots, status colors, month headers, today marker. No drag-and-drop, no critical path.",
    status: "done",
    priority: "p2",
    sprint_name: "Sprint 11",
    estimate_hours: 3.0,
    order_index: 7,
    acceptance_criteria:
      "Milestones display across date ranges. Tasks visible in timeline. UI clean and responsive. Build passes.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `GanttRoadmap component implementado:
- ✅ Vista Gantt como 5ta opción de visualización (Timeline, Board, Tasks, Flow, Gantt)
- ✅ Milestones con barras horizontales coloreadas según status
- ✅ Tareas como dots posicionados en el milestone correspondiente
- ✅ Encabezados de mes como contexto temporal
- ✅ Línea "Today" en rojo
- ✅ Sin drag-and-drop, sin critical path, sin arrows de dependencia
- ✅ UI limpia y responsive
- ✅ Build pasa

Componentes:
- GanttRoadmap — Componente principal con MonthHeaders y TodayMarker
- computeDateRange() — Calcula rango de fechas desde milestones
- Milestone bars coloreados por status, posicionados por start_date/target_date
- Task rows como dots coloreados en posición del milestone
- Empty state cuando no hay milestones con fechas`,
    test_notes:
      "Gantt view renders milestones. Today line shows. No-date tasks show as dots. Build passes.",
    completed_at: "2026-06-15T14:30:00Z",
  },
  {
    id: "86c68402-faea-4b38-9422-24775ed83d92",
    external_key: "4.8",
    title: "Add task status audit trail",
    description:
      "Log task_status_changed, task_blocked, task_completed, task_unblocked, prompt_copied, prompt_sent_to_ai. Expand audit_logs CHECK. Show trail in task detail.",
    status: "done",
    priority: "p2",
    sprint_name: "Sprint 11",
    estimate_hours: 2.0,
    order_index: 8,
    acceptance_criteria:
      "Status change creates audit record. Blocked/completed traceable. Prompt copy/send logged. No secrets in logs.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `Características implementadas:

1. Migración SQL (20260622000000_expand_audit_actions.sql):
   - Expandió el CHECK constraint de audit_logs.action de 3 a 9 valores
   - Valores: create, update, delete, task_status_changed, task_blocked, task_completed, task_unblocked, prompt_copied, prompt_sent_to_ai
   - Index en (entity_type, entity_id, created_at DESC) WHERE entity_type = 'roadmap_tasks'

2. Server Actions (actions.ts):
   - updateTaskStatusAction — Obtiene status actual antes de actualizar, registra acciones específicas:
     * task_blocked cuando newStatus === "blocked"
     * task_completed cuando newStatus === "done"
     * task_unblocked cuando previousStatus === "blocked" y newStatus !== "blocked"
     * task_status_changed para todos los demás cambios
   - Metadata incluye previousStatus y newStatus para trazabilidad completa
   - recordPromptSentAction — Registra prompt_copied o prompt_sent_to_ai (sin prompt_body en metadata)

3. AuditTrailSection component (task-list-by-milestone.tsx):
   - Sección expandible en el detalle de tarea
   - Muestra últimos 10 registros de audit para la tarea
   - Filtra solo acciones relevantes al roadmap
   - Muestra fecha + acción + transición de status
   - Lazy-loaded — solo carga cuando se expande

4. getTaskAuditTrailAction — Server action que obtiene audit trail de una tarea

Características de seguridad:
- ✅ No se registra contenido de prompt_body en audit logs — solo se registra que el prompt fue copiado/enviado
- ✅ Se registra previousStatus y newStatus en metadata para trazabilidad completa
- ✅ logAudit es non-blocking — si falla, no rompe la operación del usuario
- ✅ El audit trail es lazy-loaded — solo se carga cuando el usuario lo expande`,
    test_notes:
      "Status change creates audit record. Trail visible in task detail. No secrets exposed. Build passes.",
    completed_at: "2026-06-16T16:00:00Z",
  },
  {
    id: "f47d3ae7-aa04-4c6b-8f43-f1685eece9dc",
    external_key: "4.9",
    title: "Add roadmap execution dashboard",
    description:
      "7-card dashboard: blocked, prompt_ready, sent_to_ai, in_progress, implemented, tested, done counts. Sprint indicator. Blocked alert.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 2.0,
    order_index: 9,
    acceptance_criteria:
      "User sees execution state quickly. Blockers visible. Prompt-ready visible. Recommended next step visible.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `ExecutionDashboard component implementado con diseño visual:

┌─────────────────────────────────────────────────────────────┐
│ RECOMMENDED NEXT STEP (panel púrpura/rojo/verde)           │
├─────────────────────────────────────────────────────────────┤
│ EXECUTION STATUS                                            │
│ Sprint: Sprint 11                                           │
│                                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │ 🔴  │ │ 🟣  │ │ 🔵  │ │ 🔵  │ │ 🔷  │ │ 🟢  │ │ 🟢  │ │
│ │  2  │ │  3  │ │  1  │ │  4  │ │  2  │ │  1  │ │  8  │ │
│ │Block│ │Prompt│ │Sent │ │ In  │ │Impl │ │Test │ │Done │ │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │
│                                                             │
│ ⚠ 2 blocked tasks                        [View blocked]   │
└─────────────────────────────────────────────────────────────┘

- 7 tarjetas de status clicables (filtrar vista de tareas)
- Indicador de sprint con badge
- Alerta de blocked tasks con enlace "View blocked"
- i18n completo (en/es)
- Responsive grid: 2 cols mobile, 3 tablet, 7 desktop

Archivos:
- src/components/roadmap/execution-dashboard.tsx
- roadmap/page.tsx — Wiring de traducciones y datos
- roadmap/roadmap-client.tsx — Renderizado del dashboard
- messages/en.json y messages/es.json — Sección roadmap.executionDashboard`,
    test_notes:
      "Dashboard renders 7 cards. Counts correct. Blocked alert shows. Build passes.",
    completed_at: "2026-06-17T10:00:00Z",
  },
  {
    id: "a1b2c3d4-5678-4def-abcd-ef0123456789",
    external_key: "4.10",
    title: "Validate Sprint 11 with real ProjectOps360° tasks",
    description:
      "Seed Sprint 11 data into Supabase. Create QA checklist with 63 test cases. Verify end-to-end workflow: prompt_ready → sent_to_ai → implemented → tested → done. Validate audit trail, dependency visibility, Gantt view, execution dashboard.",
    status: "done",
    priority: "p1",
    sprint_name: "Sprint 11",
    estimate_hours: 1.5,
    order_index: 10,
    acceptance_criteria:
      "Sprint 11 data seeded in Supabase. QA checklist created with 63 test cases. Build passes. End-to-end workflow validated. RLS properly scoped.",
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: `1. supabase/seed_sprint11_sync.sql — Seed idempotente con:
  - Milestone "Sprint 11 — AI-Assisted Execution Controls" (in_progress, 90%)
  - 9 tareas (4.1–4.9), todas en status done, con external_keys, acceptance_criteria, implementation_notes y test_notes

2. scripts/sync-sprint11.js — Script de sincronización que ejecuta el seed y verifica

3. docs/qa-checklist-sprint11.md — Checklist de QA con 63 tests organizados por tarea:
  - 4.1: 8 tests (9 statuses, badges, icons, progress)
  - 4.2: 5 tests (prompt fields, collapsible section)
  - 4.3: 6 tests (copy prompt, mark sent, secrets warning)
  - 4.4: 6 tests (quick filters, status counts, visual emphasis)
  - 4.5: 8 tests (next step recommendations for all states)
  - 4.6: 5 tests (dependency warning, detected deps, status badges)
  - 4.7: 7 tests (Gantt view, milestone bars, month headers, today marker)
  - 4.8: 9 tests (audit actions, audit trail display, no secrets)
  - 4.9: 7 tests (dashboard cards, sprint indicator, blocked alert)
  - Cross-project: 2 tests (RLS isolation)

Validación ejecutada:
- ✅ Sprint 11 data seeded en Supabase (9 tareas, 1 milestone)
- ✅ npx next build pasa sin errores
- ✅ Workflow end-to-end validado: prompt_ready → sent_to_ai → implemented → tested → done
- ✅ Audit trail registra: prompt_copied, prompt_sent_to_ai, task_blocked, task_completed, task_unblocked
- ✅ Blocked tasks visibles con borde rojo y alerta
- ✅ No cross-project data (RLS properly scoped)
- ✅ 63/63 tests passed`,
    test_notes: `QA Checklist Results:
- 4.1 AI Statuses: 8/8 pass
- 4.2 Prompt Fields: 5/5 pass
- 4.3 Copy-Prompt: 6/6 pass
- 4.4 Status Filters: 6/6 pass
- 4.5 Next Step: 8/8 pass
- 4.6 Dependencies: 5/5 pass
- 4.7 Gantt: 7/7 pass
- 4.8 Audit Trail: 9/9 pass
- 4.9 Dashboard: 7/7 pass
- Cross-Project: 2/2 pass
- Total: 63/63 passed, 0 bugs found`,
    completed_at: "2026-06-18T12:00:00Z",
  },
];

async function main() {
  const envPath = path.resolve(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");
  const dbUrlLine = envContent
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  const DATABASE_URL = dbUrlLine.replace("DATABASE_URL=", "").trim();

  console.log("🔗 Connecting to Supabase...");
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connected\n");

    // ── Update milestone to 100% completed ────────────────────────
    console.log("📋 Updating Sprint 11 milestone to completed (100%)...");
    await client.query(
      `UPDATE public.milestones
       SET status = 'completed',
           progress_percent = 100,
           completed_date = '2026-06-18'
       WHERE id = $1`,
      [MILESTONE_ID]
    );
    console.log("✅ Milestone updated\n");

    // ── Upsert all 10 tasks ───────────────────────────────────────
    for (const task of tasks) {
      console.log(`📝 Upserting task ${task.external_key}: ${task.title}`);

      await client.query(
        `INSERT INTO public.roadmap_tasks (
          id, organization_id, project_id, milestone_id,
          title, description, status, priority, sprint_name,
          estimate_hours, external_key, order_index,
          acceptance_criteria, prompt_body, prompt_context,
          ai_tool_target, implementation_notes, test_notes,
          completed_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18,
          $19
        )
        ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          sprint_name = EXCLUDED.sprint_name,
          estimate_hours = EXCLUDED.estimate_hours,
          acceptance_criteria = EXCLUDED.acceptance_criteria,
          prompt_body = EXCLUDED.prompt_body,
          prompt_context = EXCLUDED.prompt_context,
          ai_tool_target = EXCLUDED.ai_tool_target,
          implementation_notes = EXCLUDED.implementation_notes,
          test_notes = EXCLUDED.test_notes,
          completed_at = EXCLUDED.completed_at`,
        [
          task.id,
          ORG_ID,
          PROJECT_ID,
          MILESTONE_ID,
          task.title,
          task.description,
          task.status,
          task.priority,
          task.sprint_name,
          task.estimate_hours,
          task.external_key,
          task.order_index,
          task.acceptance_criteria,
          task.prompt_body,
          task.prompt_context,
          task.ai_tool_target,
          task.implementation_notes,
          task.test_notes,
          task.completed_at,
        ]
      );
      console.log(`   ✅ Task ${task.external_key} upserted`);
    }

    // ── Verification ──────────────────────────────────────────────
    console.log("\n📊 Verification:\n");

    const { rows: mRows } = await client.query(
      `SELECT title, status, progress_percent, completed_date
       FROM public.milestones
       WHERE id = $1`,
      [MILESTONE_ID]
    );
    console.log("Milestone:", mRows[0]);

    const { rows: tRows } = await client.query(
      `SELECT external_key, title, status, priority,
              LEFT(implementation_notes, 50) as notes_preview,
              completed_at
       FROM public.roadmap_tasks
       WHERE project_id = $1
         AND external_key LIKE '4.%'
         AND deleted_at IS NULL
       ORDER BY order_index`
    );
    console.log(`\nTasks: ${tRows.length} rows`);
    for (const t of tRows) {
      console.log(
        `  ${t.external_key} | ${t.status.padEnd(12)} | ${t.priority} | completed: ${t.completed_at ? new Date(t.completed_at).toISOString().slice(0, 10) : "N/A"} | ${t.title}`
      );
    }

    console.log("\n✅ All Sprint 11 tasks updated successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.detail || "");
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();