-- ═══════════════════════════════════════════════════════════════════════════════
-- Data Center Labor Risk Intelligence Lab — Seed Data
-- Sandbox project for testing data center labor risk intelligence in ProjectOps360°
-- This file is idempotent: safe to re-run (uses ON CONFLICT upserts)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constants ──────────────────────────────────────────────────────────────────
-- organization_id: 4f00f16b-96d8-4fd6-9375-20e2b11564a6
-- project_id:      dc100000-0000-4000-8000-000000000000
-- slug:            dc-labor-risk-lab

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Upsert Project
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO projects (
  id, organization_id, slug, title_i18n, description_i18n, status,
  start_date, target_end_date
) VALUES (
  'dc100000-0000-4000-8000-000000000000',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc-labor-risk-lab',
  '{"en": "Data Center Labor Risk Intelligence Lab", "es": "Laboratorio de Inteligencia de Riesgo Laboral para Centros de Datos"}',
  '{"en": "Sandbox project to test labor capacity gaps, workface readiness, productivity variance, commissioning specialist constraints, and Living Graph AI explanations for data center construction workflows. Focus: Labor risk in data center construction. Features: Labor Capacity & Skills Matrix, 3/6 Week Labor Lookahead, Workface Readiness Board, Labor Productivity Variance Engine, Commissioning Labor Risk Tracker, Living Graph labor risk simulation. Critical Trades: Electrical, Mechanical/HVAC, Controls/BMS, Low Voltage/Fiber, Fire Protection, QA/QC, Commissioning, OEM Vendor, Owner Witness. Methodology: Hybrid. Project Type: Data Center Construction Intelligence Lab.", "es": "Proyecto sandbox para probar brechas de capacidad laboral, preparación de frentes de trabajo, varianza de productividad, restricciones de especialistas de puesta en servicio y explicaciones de IA del Living Graph para flujos de trabajo de construcción de centros de datos. Enfoque: Riesgo laboral en construcción de centros de datos. Características: Matriz de Capacidad y Habilidades Laborales, Vista Anticipada Laboral de 3/6 Semanas, Tablero de Preparación de Frentes de Trabajo, Motor de Varianza de Productividad Laboral, Rastreador de Riesgo Laboral de Puesta en Servicio, simulación de riesgo laboral en Living Graph. Oficios Críticos: Eléctrico, Mecánico/HVAC, Controles/BMS, Bajo Voltaje/Fibra, Protección contra Incendios, QA/QC, Puesta en Servicio, Proveedor OEM, Testigo del Propietario. Metodología: Híbrida. Tipo de Proyecto: Laboratorio de Inteligencia de Construcción de Centros de Datos."}',
  'active',
  '2026-07-14',
  '2026-08-08'
)
ON CONFLICT (organization_id, slug) DO UPDATE SET
  title_i18n      = EXCLUDED.title_i18n,
  description_i18n = EXCLUDED.description_i18n,
  status          = EXCLUDED.status,
  start_date      = EXCLUDED.start_date,
  target_end_date = EXCLUDED.target_end_date,
  updated_at      = now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Upsert Milestones (DCL-M1 through DCL-M5)
-- ═══════════════════════════════════════════════════════════════════════════════

-- DCL-M1: Test Data Foundation
INSERT INTO milestones (
  id, organization_id, project_id, title, description, status,
  start_date, target_date, progress_percent, order_index
) VALUES (
  'dc100000-0000-4000-8000-000000000101',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'M1 — Test Data Foundation',
  'Create the sandbox project foundation, trade taxonomy, crews, critical activities, baseline risks, and initial Living Graph data for a data center labor risk simulation lab.',
  'planned',
  '2026-07-14',
  '2026-07-18',
  0,
  1
)
ON CONFLICT (id) DO UPDATE SET
  description     = EXCLUDED.description,
  status          = EXCLUDED.status,
  start_date      = EXCLUDED.start_date,
  target_date      = EXCLUDED.target_date,
  progress_percent = EXCLUDED.progress_percent,
  order_index      = EXCLUDED.order_index,
  updated_at       = now();

-- DCL-M2: Labor Capacity & Skills Matrix
INSERT INTO milestones (
  id, organization_id, project_id, title, description, status,
  start_date, target_date, progress_percent, order_index
) VALUES (
  'dc100000-0000-4000-8000-000000000102',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'M2 — Labor Capacity & Skills Matrix',
  'Build the labor capacity and skills model to compare required labor vs available crews by trade, skill, week, location, and critical path impact.',
  'planned',
  '2026-07-19',
  '2026-07-23',
  0,
  2
)
ON CONFLICT (id) DO UPDATE SET
  description     = EXCLUDED.description,
  status          = EXCLUDED.status,
  start_date      = EXCLUDED.start_date,
  target_date      = EXCLUDED.target_date,
  progress_percent = EXCLUDED.progress_percent,
  order_index      = EXCLUDED.order_index,
  updated_at       = now();

-- DCL-M3: Lookahead & Workface Readiness
INSERT INTO milestones (
  id, organization_id, project_id, title, description, status,
  start_date, target_date, progress_percent, order_index
) VALUES (
  'dc100000-0000-4000-8000-000000000103',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'M3 — Lookahead & Workface Readiness',
  'Create 3-week and 6-week lookahead planning plus workface readiness checks to detect crews assigned to work that is not ready.',
  'planned',
  '2026-07-24',
  '2026-07-29',
  0,
  3
)
ON CONFLICT (id) DO UPDATE SET
  description     = EXCLUDED.description,
  status          = EXCLUDED.status,
  start_date      = EXCLUDED.start_date,
  target_date      = EXCLUDED.target_date,
  progress_percent = EXCLUDED.progress_percent,
  order_index      = EXCLUDED.order_index,
  updated_at       = now();

-- DCL-M4: Labor Productivity Variance Engine
INSERT INTO milestones (
  id, organization_id, project_id, title, description, status,
  start_date, target_date, progress_percent, order_index
) VALUES (
  'dc100000-0000-4000-8000-000000000104',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'M4 — Labor Productivity Variance Engine',
  'Measure estimated vs actual labor performance, detect productivity variance, classify likely process causes, and explain variance without blaming crews.',
  'planned',
  '2026-07-30',
  '2026-08-03',
  0,
  4
)
ON CONFLICT (id) DO UPDATE SET
  description     = EXCLUDED.description,
  status          = EXCLUDED.status,
  start_date      = EXCLUDED.start_date,
  target_date      = EXCLUDED.target_date,
  progress_percent = EXCLUDED.progress_percent,
  order_index      = EXCLUDED.order_index,
  updated_at       = now();

-- DCL-M5: Commissioning Labor Risk & Living Graph Simulation
INSERT INTO milestones (
  id, organization_id, project_id, title, description, status,
  start_date, target_date, progress_percent, order_index
) VALUES (
  'dc100000-0000-4000-8000-000000000105',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'M5 — Commissioning Labor Risk & Living Graph Simulation',
  'Track commissioning specialist and OEM availability, simulate labor-driven downstream impacts, and validate labor risk explanations inside the Living Graph.',
  'planned',
  '2026-08-04',
  '2026-08-08',
  0,
  5
)
ON CONFLICT (id) DO UPDATE SET
  description     = EXCLUDED.description,
  status          = EXCLUDED.status,
  start_date      = EXCLUDED.start_date,
  target_date      = EXCLUDED.target_date,
  progress_percent = EXCLUDED.progress_percent,
  order_index      = EXCLUDED.order_index,
  updated_at       = now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Upsert Tasks (DCL-001 through DCL-025)
-- Uses ON CONFLICT on (project_id, external_key) for idempotency
-- prompt_body ← ai_prompt, prompt_context ← ai_next_action
-- ═══════════════════════════════════════════════════════════════════════════════

-- DCL-001: Create Data Center Labor Risk Intelligence Lab project seed (M1, prompt_ready, p1, 2h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000101',
  'DCL-001',
  'Create Data Center Labor Risk Intelligence Lab project seed',
  'Create the separate sandbox project record and baseline configuration for testing data center labor risk intelligence in ProjectOps360°.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-14', '2026-07-18', 2, 1,
  0, false,
  'Act as a Senior Supabase Engineer. Create or validate a separate sandbox project named Data Center Labor Risk Intelligence Lab inside ProjectOps360°. This project must not affect the main ProjectOps360° roadmap. Ensure the project has its own project_id, status, date range, metadata, and test purpose. Add safe seed/upsert logic so the project can be inserted more than once without duplicate records. Output the files or SQL changed and verify the project appears in the Projects page.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-002: Define data center trade and skill taxonomy (M1, prompt_ready, p1, 3h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000101',
  'DCL-002',
  'Define data center trade and skill taxonomy',
  'Define the critical trades, skills, certifications, and specialist roles needed for data center construction labor risk testing.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-14', '2026-07-18', 3, 2,
  0, false,
  'Act as a Data Center Construction SME and Product Engineer. Define a trade and skill taxonomy for the lab including Electrical, Mechanical/HVAC, Controls/BMS, Low Voltage/Fiber, Fire Protection, QA/QC, Commissioning, OEM Vendor, and Owner Witness roles. Include skill level, certification requirement, typical work packages, and commissioning relevance. Implement this as seed data or metadata using the safest existing schema. Do not overbuild tables unless needed.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-003: Seed crews, specialists, and availability constraints (M1, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000101',
  'DCL-003',
  'Seed crews, specialists, and availability constraints',
  'Create fictitious crews and specialists with intentionally imperfect availability to test labor shortages and specialist risk.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-14', '2026-07-18', 4, 3,
  0, false,
  'Act as a Senior Data Engineer. Seed fictitious labor resources for the lab: Electrical Crew A, Electrical Crew B, Electrical Crew C, Mechanical Crew A, Controls Tech A, Fiber Crew A, QA/QC Inspector, Commissioning Agent, UPS OEM Technician, Generator Vendor, and Owner Witness. Include availability windows, capacity, trade, skill level, and constraints such as partial availability, over-allocation, and unconfirmed vendor availability. Make the data easy to query by week and trade.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-004: Seed critical data center construction activities (M1, implemented, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000101',
  'DCL-004',
  'Seed critical data center construction activities',
  'Create critical activities such as switchgear installation, UPS installation, CRAH installation, BMS testing, fiber pathways, QA inspections, L4 UPS test, and L5 integrated systems test.',
  'implemented', 'p1', 'DC Lab',
  '2026-07-14', '2026-07-18', 4, 4,
  100, false,
  'Act as a Senior Construction Planning Engineer. Seed critical data center construction activities for the lab. Include Switchgear Installation, UPS Installation, Generator Setup, CRAH Installation, BMS Point-to-Point Testing, Fiber Pathway Installation, Electrical Room QA, L3 Pre-functional Testing, L4 UPS Functional Test, L5 Integrated Systems Test, and Client Handover. Each activity must include planned dates, required trade, required crew count, estimated hours, location/zone, and predecessor dependencies.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-005: Create baseline labor risk scenarios and Living Graph links (M1, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000101',
  'DCL-005',
  'Create baseline labor risk scenarios and Living Graph links',
  'Insert intentional labor risks and graph relationships to test whether the system can detect, explain, and visualize labor-driven execution risk.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-14', '2026-07-18', 5, 5,
  0, false,
  'Act as a Process Intelligence Engineer. Create baseline risk scenarios for the lab: electrical crew shortage, QA/QC inspector over-allocation, mechanical workface not ready, UPS OEM technician unavailable, fiber productivity variance, BMS dependency gap, unresolved RFI, and missing submittal. Link these risks to activities, crews, milestones, and Living Graph nodes/edges where possible. The goal is to create realistic imperfect data for testing AI explanations.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-006: Design labor capacity data model (M2, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000102',
  'DCL-006',
  'Design labor capacity data model',
  'Design or extend the model needed to represent required labor, available labor, skills, utilization, shortages, and critical path impact.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-19', '2026-07-23', 4, 6,
  0, false,
  'Act as a Senior Supabase/Postgres Architect. Design the minimum viable labor capacity model for ProjectOps360° data center testing. Support required headcount, available headcount, trade, skill, certification, date/week, location, crew, utilization, shortage risk, and critical path impact. Reuse existing tables if possible; otherwise propose safe additive tables. Include SQL migration or schema changes, indexes, and RLS considerations.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-007: Calculate required vs available labor by trade and week (M2, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000102',
  'DCL-007',
  'Calculate required vs available labor by trade and week',
  'Implement calculation logic that compares planned labor demand with available labor capacity by trade, week, milestone, and activity.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-19', '2026-07-23', 5, 7,
  0, false,
  'Act as a Staff-level TypeScript Engineer. Implement labor capacity calculation logic that compares required labor from planned activities against available crew capacity by trade and week. Return labor gap, over-allocation, utilization percentage, shortage severity, affected activities, and affected milestones. Keep the logic deterministic and testable. Do not call live AI yet.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-008: Build Labor Capacity & Skills Matrix UI (M2, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000102',
  'DCL-008',
  'Build Labor Capacity & Skills Matrix UI',
  'Create the UI matrix showing trades, crews, required capacity, available capacity, gaps, utilization, and risk level.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-19', '2026-07-23', 5, 8,
  0, false,
  'Act as a Senior UX Engineer. Build a Labor Capacity & Skills Matrix UI for the Data Center Labor Risk Intelligence Lab. The matrix must show trade, crew/specialist, required headcount, available headcount, utilization, skill level, certification, date/week, gap, and risk level. Add filters for trade, week, milestone, location, and critical-only. Use existing shadcn/ui and ProjectOps360° styling.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-009: Generate AI-style labor gap explanations (M2, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000102',
  'DCL-009',
  'Generate AI-style labor gap explanations',
  'Add deterministic AI-style explanations for labor shortages, over-allocation, skill mismatch, and downstream schedule impact.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-19', '2026-07-23', 4, 9,
  0, false,
  'Act as a Senior PMO Process Intelligence Engineer. Generate deterministic AI-style explanations for labor capacity gaps. Explanations must state what trade is short, when the shortage occurs, which activities are affected, why it matters, and recommended mitigation. Avoid blaming people. Use process-centered language such as labor capacity gap, over-allocation risk, skill coverage risk, and downstream schedule impact.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-010: Connect labor capacity risks to Living Graph (M2, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000102',
  'DCL-010',
  'Connect labor capacity risks to Living Graph',
  'Represent labor capacity shortages as graph nodes/overlays linked to affected activities, milestones, and dependencies.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-19', '2026-07-23', 5, 10,
  0, false,
  'Act as a Senior Graph Visualization Engineer. Connect labor capacity risks to the Living Graph. Labor shortages should appear as risk nodes or overlays connected to affected activities, milestones, and downstream dependencies. Add fields or mapping logic for requires_trade, assigned_to, labor_gap, delays, and impacts relationships. Clicking the risk should explain the shortage and downstream effect.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-011: Create 3-week and 6-week labor lookahead view (M3, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000103',
  'DCL-011',
  'Create 3-week and 6-week labor lookahead view',
  'Build lookahead views that show upcoming activities, required trades, available crews, labor gaps, and readiness state.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-24', '2026-07-29', 5, 11,
  0, false,
  'Act as a Senior Construction UX Engineer. Create 3-week and 6-week labor lookahead views for the lab. Show upcoming activities, required trades, required crews, available crews, labor gaps, readiness status, blockers, and critical path flag. The view should help answer whether the next weeks of work are executable with available labor.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-012: Implement workface readiness checklist model (M3, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000103',
  'DCL-012',
  'Implement workface readiness checklist model',
  'Create readiness criteria for each activity such as RFI answered, submittal approved, drawing current, material onsite, area released, permit ready, and predecessor complete.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-24', '2026-07-29', 4, 12,
  0, false,
  'Act as a Workface Planning SME and Product Engineer. Implement a workface readiness checklist model for data center construction activities. Each activity should support readiness criteria: RFI answered, submittal approved, drawing current, material onsite, area released, safety/permit ready, predecessor complete, QA prerequisite complete, and crew assigned. Return readiness percentage and missing prerequisites.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-013: Detect crews assigned to work that is not ready (M3, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000103',
  'DCL-013',
  'Detect crews assigned to work that is not ready',
  'Create logic to identify labor idle risk when crews are assigned to tasks missing key prerequisites.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-24', '2026-07-29', 5, 13,
  0, false,
  'Act as a Process Improvement Engineer. Implement detection logic for crews assigned to work that is not ready. If a crew is assigned but readiness criteria are missing, flag labor idle risk. Return activity, crew, missing prerequisites, idle risk severity, days at risk, downstream impact, and recommended action. Avoid blaming the crew; frame the issue as workface readiness risk.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-014: Build Workface Readiness Board (M3, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000103',
  'DCL-014',
  'Build Workface Readiness Board',
  'Create a board that lists upcoming activities, assigned crews, readiness percentage, missing prerequisites, blockers, and recommended actions.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-24', '2026-07-29', 5, 14,
  0, false,
  'Act as a Senior Frontend Engineer. Build the Workface Readiness Board for ProjectOps360°. The board must show upcoming data center activities, assigned crew, required trade, readiness percentage, missing prerequisites, blocker type, idle risk, downstream impact, and recommended action. Include filters for trade, week, readiness status, critical path, and blocked items.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-015: Add AI readiness explanations to lookahead and graph (M3, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000103',
  'DCL-015',
  'Add AI readiness explanations to lookahead and graph',
  'Generate explanations for why work is or is not ready, what prerequisite is missing, and what action should happen before crews arrive.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-24', '2026-07-29', 4, 15,
  0, false,
  'Act as a Senior AI Product Engineer. Add deterministic AI-style readiness explanations to the lookahead view and Living Graph. For each not-ready activity, explain what is missing, why it matters, what crew may be affected, what downstream work is at risk, and the recommended next action. Example: Mechanical crew is scheduled for CRAH installation, but the workface is not ready because the equipment delivery confirmation and approved submittal are missing.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-016: Add estimated vs actual labor hour tracking (M4, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000104',
  'DCL-016',
  'Add estimated vs actual labor hour tracking',
  'Create fields and sample data for estimated hours, actual hours, crew size, production rate, rework count, and delay reason.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-30', '2026-08-03', 4, 16,
  0, false,
  'Act as a Senior Data Engineer. Add or seed estimated vs actual labor hour tracking for lab activities. Support estimated_hours, actual_hours, planned_production_rate, actual_production_rate, crew_size, rework_count, delay_reason, and location/zone. Use safe schema extensions or metadata if needed. Seed at least one activity with a major variance for testing.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-017: Calculate labor productivity variance (M4, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000104',
  'DCL-017',
  'Calculate labor productivity variance',
  'Implement calculations for productivity variance, schedule risk, variance severity, and trend by trade/activity type.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-30', '2026-08-03', 5, 17,
  0, false,
  'Act as a Senior Analytics Engineer. Implement labor productivity variance calculations. Compare estimated hours vs actual hours and planned production rate vs actual production rate. Return variance percentage, severity, affected trade, activity type, location, trend, and schedule risk. Include logic to avoid false positives when the task is incomplete or missing actuals.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-018: Classify likely productivity variance causes (M4, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000104',
  'DCL-018',
  'Classify likely productivity variance causes',
  'Create deterministic classification for causes such as workface not ready, drawing issue, RFI delay, material delay, rework, crew shortage, or skill mismatch.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-30', '2026-08-03', 5, 18,
  0, false,
  'Act as a Senior Process Mining Engineer. Create deterministic cause classification for productivity variance. Use available signals such as readiness gaps, unresolved RFIs, drawing revisions, material delays, rework count, crew shortage, skill mismatch, blockers, and dependency delays. Return likely cause, confidence score, evidence summary, and recommended process improvement. Do not blame individual workers.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-019: Display productivity risk in dashboard and Living Graph (M4, prompt_ready, p2, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000104',
  'DCL-019',
  'Display productivity risk in dashboard and Living Graph',
  'Show productivity variance in dashboard cards, activity details, and Living Graph overlays.',
  'prompt_ready', 'p2', 'DC Lab',
  '2026-07-30', '2026-08-03', 5, 19,
  0, false,
  'Act as a Senior Frontend Engineer. Display productivity variance in ProjectOps360° through a compact dashboard card, activity-level details, and a Living Graph overlay. Highlight activities with high variance, affected trades, and likely process causes. Keep the UI concise and actionable. Ensure the graph overlay does not clutter the visualization.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-020: Generate AI productivity recommendations (M4, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000104',
  'DCL-020',
  'Generate AI productivity recommendations',
  'Generate process-centered recommendations for productivity issues such as improving readiness, clarifying drawings, resolving RFIs, or resequencing work.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-07-30', '2026-08-03', 4, 20,
  0, false,
  'Act as a Senior PMO Process Improvement Consultant. Generate deterministic AI-style productivity recommendations. For each high-variance activity, explain what happened, likely process cause, downstream risk, and recommended mitigation. Use language such as productivity variance detected, workface constraint, drawing clarity issue, or resequencing opportunity. Do not say the crew performed poorly.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-021: Model commissioning specialist requirements (M5, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000105',
  'DCL-021',
  'Model commissioning specialist requirements',
  'Create data model and seed data for commissioning agents, OEM technicians, test witnesses, electrical testing crews, controls technicians, and vendor availability.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-08-04', '2026-08-08', 5, 21,
  0, false,
  'Act as a Senior Data Center Commissioning SME. Model commissioning specialist requirements for L3/L4/L5 activities. Include required specialist role, vendor/OEM, required witness, availability date, test window, system affected, equipment affected, retest risk, and handover impact. Seed UPS OEM Technician unavailable and Generator Vendor limited availability scenarios.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-022: Build Commissioning Labor Risk Tracker (M5, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000105',
  'DCL-022',
  'Build Commissioning Labor Risk Tracker',
  'Create UI and logic to track specialist availability risks for L3 pre-functional, L4 functional, and L5 integrated systems testing.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-08-04', '2026-08-08', 5, 22,
  0, false,
  'Act as a Senior UX/Product Engineer. Build the Commissioning Labor Risk Tracker. Show commissioning activity, required specialist, required vendor, witness requirement, availability status, test window, failed test count, retest risk, affected system, and handover impact. Highlight specialist gaps that threaten critical commissioning activities.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-023: Simulate downstream impact from specialist delay (M5, prompt_ready, p1, 6h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000105',
  'DCL-023',
  'Simulate downstream impact from specialist delay',
  'Create what-if logic to estimate downstream impact if a required specialist or OEM vendor is unavailable.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-08-04', '2026-08-08', 6, 23,
  0, false,
  'Act as a Senior Graph Simulation Engineer. Implement a deterministic what-if simulation for commissioning labor risk. When a required specialist or OEM vendor is unavailable, estimate downstream impact across dependent tests, milestones, critical path, and handover. Return affected nodes, delay estimate, risk increase, and suggested mitigation such as resequence tests, confirm alternate vendor, or split test window.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-024: Visualize commissioning labor risk in Living Graph (M5, prompt_ready, p1, 5h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000105',
  'DCL-024',
  'Visualize commissioning labor risk in Living Graph',
  'Show commissioning specialist risks as graph overlays and explain affected tests, equipment, and handover impact.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-08-04', '2026-08-08', 5, 24,
  0, false,
  'Act as a Senior Living Graph Engineer. Visualize commissioning labor risks inside the Living Graph. Add or map nodes for Commissioning Test, OEM Technician, Commissioning Agent, Owner Witness, Labor Risk, Equipment, and Handover. Add edges such as requires_vendor, requires_witness, blocks, delays, and impacts. The graph should show why missing specialist availability can delay L5 Integrated Systems Testing.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- DCL-025: Run end-to-end Data Center Labor Risk Lab validation (M5, prompt_ready, p1, 4h)
INSERT INTO roadmap_tasks (
  organization_id, project_id, milestone_id, external_key, title, description,
  status, priority, sprint_name, start_date, end_date, estimate_hours,
  order_index, progress, is_blocked, prompt_body, prompt_context, acceptance_criteria
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'dc100000-0000-4000-8000-000000000105',
  'DCL-025',
  'Run end-to-end Data Center Labor Risk Lab validation',
  'Use the lab data to validate labor shortage, workface readiness, productivity variance, commissioning labor risk, and Living Graph explanations.',
  'prompt_ready', 'p1', 'DC Lab',
  '2026-08-04', '2026-08-08', 4, 25,
  0, false,
  'Act as a Senior QA Engineer and Product Manager. Run an end-to-end validation of the Data Center Labor Risk Intelligence Lab. Verify five scenarios: electrical labor shortage, crew assigned to not-ready work, fiber productivity variance, UPS OEM technician unavailable, and Living Graph downstream impact. Document results, bugs, missing data, UI friction, and next recommended improvements. The test passes only if the system produces clear labor risk explanations without blaming crews.',
  'Execute the task prompt, implement the feature incrementally, test it, and update the task status in ProjectOps360°.',
  '1) Implementation is incremental and does not break existing ProjectOps360° functionality. 2) The feature is connected to the Data Center Labor Risk Intelligence Lab project. 3) The task can be tested with seeded lab data. 4) The UI or output uses process-centered language and avoids blaming crews.'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
  priority=EXCLUDED.priority, milestone_id=EXCLUDED.milestone_id,
  estimate_hours=EXCLUDED.estimate_hours, prompt_body=EXCLUDED.prompt_body,
  prompt_context=EXCLUDED.prompt_context, acceptance_criteria=EXCLUDED.acceptance_criteria,
  start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
  progress=EXCLUDED.progress, is_blocked=EXCLUDED.is_blocked,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Insert Task Dependencies (finish_to_start chain)
-- Uses task external_keys to resolve UUIDs via SELECT
-- DCL-001 → DCL-002 → DCL-003 → ... → DCL-025
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'dc100000-0000-4000-8000-000000000000', p.id, s.id, 'finish_to_start'
FROM roadmap_tasks p, roadmap_tasks s
WHERE p.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND s.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND p.deleted_at IS NULL AND s.deleted_at IS NULL
  AND (p.external_key, s.external_key) IN (
    ('DCL-001', 'DCL-002'),
    ('DCL-002', 'DCL-003'),
    ('DCL-003', 'DCL-004'),
    ('DCL-004', 'DCL-005'),
    ('DCL-005', 'DCL-006'),
    ('DCL-006', 'DCL-007'),
    ('DCL-007', 'DCL-008'),
    ('DCL-008', 'DCL-009'),
    ('DCL-009', 'DCL-010'),
    ('DCL-010', 'DCL-011'),
    ('DCL-011', 'DCL-012'),
    ('DCL-012', 'DCL-013'),
    ('DCL-013', 'DCL-014'),
    ('DCL-014', 'DCL-015'),
    ('DCL-015', 'DCL-016'),
    ('DCL-016', 'DCL-017'),
    ('DCL-017', 'DCL-018'),
    ('DCL-018', 'DCL-019'),
    ('DCL-019', 'DCL-020'),
    ('DCL-020', 'DCL-021'),
    ('DCL-021', 'DCL-022'),
    ('DCL-022', 'DCL-023'),
    ('DCL-023', 'DCL-024'),
    ('DCL-024', 'DCL-025')
  )
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to verify)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT id, title_i18n, status, start_date, target_end_date
-- FROM projects WHERE id = 'dc100000-0000-4000-8000-000000000000';
-- Expected: 1 row

-- SELECT count(*) as milestone_count FROM milestones
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND deleted_at IS NULL;
-- Expected: 5

-- SELECT count(*) as task_count FROM roadmap_tasks
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND external_key LIKE 'DCL-%' AND deleted_at IS NULL;
-- Expected: 25

-- SELECT count(*) as dep_count FROM task_dependencies
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000';
-- Expected: 24