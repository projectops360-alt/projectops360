-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 0 Sync — Idempotent upsert of all 18 Phase 0 tasks + milestone + deps
-- Usage: node scripts/sync-phase0.js
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constants ─────────────────────────────────────────────────────────────────
-- Org & Project IDs must match existing scripts (seed-sprint12, update-sprint11)
-- DO NOT change these unless the org/project changes.

-- ── STEP 1: Upsert Milestone ──────────────────────────────────────────────────

INSERT INTO public.milestones (
  id, organization_id, project_id, title, description,
  status, order_index, created_at, updated_at
)
VALUES (
  'a1b2c3d4-0000-4000-8000-000000000001',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  'Phase 0 — Foundation & Setup',
  'Project foundation: planning, dev environment, i18n, Supabase, security, AI baseline, and core UI.',
  'in_progress',
  0,
  now(), now()
)
ON CONFLICT (organization_id, project_id, title) WHERE deleted_at IS NULL
DO UPDATE SET
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = now();

-- ── STEP 2: Upsert Tasks ──────────────────────────────────────────────────────
-- Key transformations from phase0-tasks.ts:
--   id "0.X"         → external_key "0.X"
--   defaultStatus    → status ("pending" → "not_started", "done" → "done", etc.)
--   priority "P1"    → priority "p1" (lowercase)
--   goal             → description (+ appended deliverable/verification info)
--   prompt           → prompt_body
--   category         → prompt_context
--   dependencies[]   → dependency_notes (comma-joined)
--   acceptanceCriteria[] → acceptance_criteria (newline-joined)
--   done tasks       → completed_at = now(), progress = 100

-- Task 0.1 — Planning & Scope: Confirm solo-builder scope
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.1',
  'Confirm solo-builder scope',
  'Freeze Phase 0 + MVP-0 scope around Project Memory & Decision Traceability.' || E'\n\n' || 'Deliverable: Approved MVP-0 scope statement' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 0', 2.00,
  '', 'Approved MVP-0 scope statement documented' || E'\n' || 'Scope avoids expanding into full PMO',
  'Help me write a concise MVP-0 scope statement for ProjectOps360°, a solo-builder SaaS platform focused on Project Memory and Decision Traceability. Keep it practical and avoid scope creep into full PMO features.',
  'Planning & Scope',
  1, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  sprint_name = EXCLUDED.sprint_name,
  estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body,
  prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id,
  progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at,
  updated_at = now();

-- Task 0.2 — Planning & Scope: Create single source of truth folder
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.2',
  'Create single source of truth folder',
  'Create official documentation folder structure and archive duplicate/old docs.' || E'\n\n' || 'Deliverable: Source of truth folder' || E'\n' || 'Verification: not required',
  'done', 'p1', 'Sprint 0', 2.00,
  '0.1', 'Source of truth folder created with current docs only' || E'\n' || 'Duplicate/old docs archived or removed',
  'Help me organize a single source of truth documentation folder for ProjectOps360°. Structure it for a solo builder with: scope, architecture, database schema, WBS, and decisions log.',
  'Planning & Scope',
  2, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.3 — Planning & Scope: Define Definition of Done
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.3',
  'Define Definition of Done',
  'Write DoD for Phase 0 and MVP-0 including manual QA, RLS checks, and demo criteria.' || E'\n\n' || 'Deliverable: Definition of Done doc' || E'\n' || 'Verification: required',
  'not_started', 'p1', 'Sprint 0', 3.00,
  '0.1', 'DoD document covers manual QA steps' || E'\n' || 'DoD includes RLS verification criteria' || E'\n' || 'DoD defines demo readiness criteria' || E'\n' || 'Practical for solo builder',
  'Write a Definition of Done document for Phase 0 and MVP-0 of ProjectOps360°. Include manual QA steps, RLS policy verification, and demo readiness criteria. Keep it practical for a solo developer.',
  'Planning & Scope',
  3, 0, now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.4 — Planning & Scope: Create project repo
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.4',
  'Create project repo',
  'Create GitHub repository, branch strategy, README, and initial project structure.' || E'\n\n' || 'Deliverable: GitHub repo' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 0', 2.00,
  '0.1', 'GitHub repo created with proper README' || E'\n' || 'Branch strategy defined (main/trunk-based)' || E'\n' || 'Initial project structure committed',
  'Create a GitHub repository structure for ProjectOps360° with a clear README, .gitignore for Next.js + Supabase, and trunk-based branch strategy suitable for a solo developer.',
  'Planning & Scope',
  4, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.5 — Dev Environment: Install Next.js + TypeScript app
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.5',
  'Install Next.js + TypeScript app',
  'Create Next.js app with TypeScript, App Router, ESLint, Tailwind.' || E'\n\n' || 'Deliverable: Running frontend scaffold' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 0', 4.00,
  '0.4', 'Next.js dev server starts without errors' || E'\n' || 'pnpm build succeeds with no type errors' || E'\n' || 'TypeScript strict mode enabled',
  'Scaffold a Next.js 16 project with App Router, TypeScript strict mode, and Tailwind CSS v4. Use pnpm as the package manager.',
  'Dev Environment',
  5, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.6 — Dev Environment: Install UI foundation
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.6',
  'Install UI foundation',
  'Install shadcn/ui, Lucide icons, base layout, theme colors, typography.' || E'\n\n' || 'Deliverable: UI foundation' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 0', 5.00,
  '0.5', 'shadcn/ui initialized with base-nova style' || E'\n' || 'Soft green Ascendia-inspired brand palette applied' || E'\n' || 'Sidebar + header + main content layout works' || E'\n' || 'App renders correctly in browser',
  'Set up shadcn/ui with the base-nova style in a Next.js project. Apply a soft green brand palette inspired by Ascendia. Create an AppShell layout with a fixed sidebar, sticky header, and main content area. Install Lucide icons.',
  'Dev Environment',
  6, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.7 — i18n: Install next-intl
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.7',
  'Install next-intl',
  'Configure next-intl with English and Spanish message files.' || E'\n\n' || 'Deliverable: i18n foundation' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 0', 4.00,
  '0.5', 'Navigating to /en and /es renders correct translations' || E'\n' || 'Message files are structured by namespace' || E'\n' || 'i18n routing middleware works correctly',
  'Set up next-intl in a Next.js 16 App Router project. Create the [locale] dynamic route, i18n/request.ts config, routing.ts with locales en and es (default en), and structured message JSON files for both languages.',
  'i18n',
  7, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.8 — i18n: Create language switcher
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.8',
  'Create language switcher',
  'Add simple ES/EN switcher and persist preference in profile later.' || E'\n\n' || 'Deliverable: Language switcher UI' || E'\n' || 'Verification: required',
  'done', 'p2', 'Sprint 0', 3.00,
  '0.7', 'Language switcher visible in sidebar' || E'\n' || 'Toggling EN/ES changes all UI strings without full page reload' || E'\n' || 'Simple dropdown or toggle is acceptable',
  'Create a simple EN/ES language switcher component for a Next.js app using next-intl. Place it in the sidebar. It should toggle between English and Spanish and update all UI strings without a full page reload.',
  'i18n',
  8, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.9 — Supabase: Create Supabase project
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.9',
  'Create Supabase project',
  'Create Supabase project, local env variables, and connection keys.' || E'\n\n' || 'Deliverable: Supabase project' || E'\n' || 'Verification: not required',
  'done', 'p1', 'Sprint 0', 2.00,
  '0.4', 'Supabase project created and linked locally' || E'\n' || 'Browser and server clients connect successfully' || E'\n' || 'Environment variables validated on startup' || E'\n' || 'No secrets committed to git',
  'Create a Supabase project and configure the local development environment. Set up browser and server client factories using @supabase/ssr. Add env var validation. Ensure .env.local is gitignored and .env.example contains only placeholder values.',
  'Supabase',
  9, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.10 — Supabase: Create baseline DB schema
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.10',
  'Create baseline DB schema',
  'Create minimal tables for organizations, profiles, projects, stakeholders, communications, decisions, documents, links, ai_runs.' || E'\n\n' || 'Deliverable: Migration scripts' || E'\n' || 'Verification: required',
  'not_started', 'p1', 'Sprint 1', 10.00,
  '0.9', 'Migration scripts create all MVP-0 tables' || E'\n' || 'Foreign key relationships are correct' || E'\n' || 'Tables include created_at, updated_at timestamps' || E'\n' || 'Schema matches the documented database design',
  'Design and create Supabase migration SQL for ProjectOps360° MVP-0. Tables needed: organizations, profiles, projects, stakeholders, communications, decisions, documents, links, ai_runs. Include proper foreign keys, timestamps (created_at, updated_at), and minimal indexes. Keep it focused on Project Memory and Decision Traceability.',
  'Supabase',
  10, 0, now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.11 — Security: Configure Supabase Auth
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.11',
  'Configure Supabase Auth',
  'Set up email/password auth and protected app routes.' || E'\n\n' || 'Deliverable: Working authentication' || E'\n' || 'Verification: required',
  'not_started', 'p1', 'Sprint 1', 6.00,
  '0.9, 0.5', 'Sign-up and sign-in flow works with email/password' || E'\n' || 'Protected routes redirect unauthenticated users' || E'\n' || 'Auth session persists across page reloads' || E'\n' || 'Magic link support can be added later',
  'Configure Supabase Auth in a Next.js App Router project. Set up email/password sign-up and sign-in. Create protected route middleware that redirects unauthenticated users. Ensure auth sessions persist across page reloads using @supabase/ssr middleware. Magic link can be added later.',
  'Security',
  11, 0, now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.12 — Security: Implement organization membership model
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.12',
  'Implement organization membership model',
  'Create membership table and helpers to retrieve user org context.' || E'\n\n' || 'Deliverable: Org membership logic' || E'\n' || 'Verification: required',
  'not_started', 'p1', 'Sprint 1', 8.00,
  '0.10, 0.11', 'Organization and membership tables exist' || E'\n' || 'User can belong to one organization initially' || E'\n' || 'Helper functions retrieve org context for authenticated user' || E'\n' || 'Single org support is acceptable for MVP',
  'Create an organization membership model in Supabase. Design organization_members table linking users to organizations. Create helper functions (server-side) to retrieve the current user''s organization context. Support single-org per user initially.',
  'Security',
  12, 0, now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.13 — Security: Create initial RLS policies
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.13',
  'Create initial RLS policies',
  'Add RLS for org-scoped access to MVP-0 tables.' || E'\n\n' || 'Deliverable: RLS policies' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 2', 10.00,
  '0.10, 0.12', 'RLS enabled on all MVP-0 tables' || E'\n' || 'Users can only see data from their own organization' || E'\n' || 'Cross-org access is blocked at the database level' || E'\n' || 'Service role can bypass RLS for admin tasks',
  'Create Row Level Security policies for all MVP-0 tables in Supabase. Every policy must scope data to the user''s organization. Block all cross-org access. Allow service role bypass for admin operations. Use a helper function to get the current user''s org_id.',
  'Security',
  13, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.14 — Security: Create RLS smoke tests
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.14',
  'Create RLS smoke tests',
  'Create manual/automated basic tests for org isolation.' || E'\n\n' || 'Deliverable: RLS test checklist' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 2', 6.00,
  '0.13', 'Test cases cover at least: read, write, update, delete across org boundary' || E'\n' || 'Manual SQL test checklist is documented' || E'\n' || 'Automated tests run if time allows, otherwise manual checklist is acceptable',
  'Create a test checklist and SQL scripts to verify RLS policies on ProjectOps360° tables. Test that: (1) users can read/write their own org''s data, (2) users cannot read other orgs'' data, (3) service role bypass works. Provide both manual SQL test scripts and a documented checklist.',
  'Security',
  14, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.15 — AI Foundation: Create AI service abstraction
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.15',
  'Create AI service abstraction',
  'Create backend AI service wrapper with provider abstraction, prompt registry skeleton, and ai_runs logging.' || E'\n\n' || 'Deliverable: AI service baseline' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 2', 8.00,
  '0.10', 'AI service module created with provider abstraction' || E'\n' || 'Prompt registry skeleton with at least one template' || E'\n' || 'All AI calls logged to ai_runs table' || E'\n' || 'No direct model calls from UI — all through server layer',
  'Create an AI service abstraction layer in a Next.js app. Build a server-side module that wraps OpenAI with provider abstraction (so other providers can be added later). Include a prompt registry with at least one template. Log all AI interactions to an ai_runs table in Supabase. Never expose API keys to the client.',
  'AI Foundation',
  15, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.16 — AI Foundation: Configure AI environment variables
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.16',
  'Configure AI environment variables',
  'Add secure model keys, server-only access, and local env documentation.' || E'\n\n' || 'Deliverable: AI env setup' || E'\n' || 'Verification: not required',
  'not_started', 'p1', 'Sprint 2', 2.00,
  '0.15', 'OPENAI_API_KEY added to .env.local (server-side only)' || E'\n' || 'Key is never exposed to browser (no NEXT_PUBLIC_ prefix)' || E'\n' || '.env.example updated with placeholder' || E'\n' || '.env.local is gitignored',
  'Add OPENAI_API_KEY to the environment configuration for ProjectOps360°. It must be server-side only (no NEXT_PUBLIC_ prefix). Update .env.example with a placeholder. Verify .env.local is gitignored. Add the key to the env validation module.',
  'AI Foundation',
  16, 0, now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.17 — Core UI: Create app shell navigation
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.17',
  'Create app shell navigation',
  'Create dashboard layout, sidebar, project area, settings placeholder.' || E'\n\n' || 'Deliverable: App shell' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 3', 6.00,
  '0.6, 0.11', 'Sidebar renders all navigation items' || E'\n' || 'Active route is highlighted' || E'\n' || 'Header is sticky with search and notifications' || E'\n' || 'Main content area scrolls independently' || E'\n' || 'Minimal but clean layout',
  'Create an AppShell navigation layout for ProjectOps360° with a fixed sidebar (Dashboard, Phase 0, Projects, Team, Reports), sticky header with search and notifications, and a main content area. Include responsive design and i18n support for EN/ES.',
  'Core UI',
  17, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- Task 0.18 — Core UI: Create project shell
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, external_key,
  title, description, status, priority, sprint_name, estimate_hours,
  dependency_notes, acceptance_criteria, prompt_body, prompt_context,
  order_index, progress, completed_at, created_at, updated_at
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Phase 0 — Foundation & Setup' AND deleted_at IS NULL),
  '0.18',
  'Create project shell',
  'Allow create/view one project with name, description, status, default language.' || E'\n\n' || 'Deliverable: Project shell UI' || E'\n' || 'Verification: required',
  'done', 'p1', 'Sprint 3', 8.00,
  '0.10, 0.17', 'User can create a project with name, description, status, language' || E'\n' || 'User can view project details' || E'\n' || 'First project can be manually created via UI' || E'\n' || 'Project list page shows created projects',
  'Create a project shell UI for ProjectOps360°. Allow creating a project with name, description, status, and default language (EN/ES). Show a project list page and project detail view. Connect to Supabase for persistence. Keep it minimal for MVP-0.',
  'Core UI',
  18, 100, now(), now(), now()
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status,
  priority = EXCLUDED.priority, sprint_name = EXCLUDED.sprint_name, estimate_hours = EXCLUDED.estimate_hours,
  dependency_notes = EXCLUDED.dependency_notes, acceptance_criteria = EXCLUDED.acceptance_criteria,
  prompt_body = EXCLUDED.prompt_body, prompt_context = EXCLUDED.prompt_context,
  milestone_id = EXCLUDED.milestone_id, progress = EXCLUDED.progress,
  completed_at = EXCLUDED.completed_at, updated_at = now();

-- ── STEP 3: Insert Task Dependencies ──────────────────────────────────────────
-- Uses subqueries by external_key to resolve UUIDs; ON CONFLICT DO NOTHING for idempotency.

-- 0.2 depends on 0.1
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.1' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.2' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.3 depends on 0.1
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.1' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.3' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.4 depends on 0.1
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.1' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.4' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.5 depends on 0.4
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.4' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.5' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.6 depends on 0.5
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.5' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.6' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.7 depends on 0.5
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.5' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.7' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.8 depends on 0.7
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.7' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.8' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.9 depends on 0.4
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.4' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.9' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.10 depends on 0.9
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.9' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.10' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.11 depends on 0.9, 0.5
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.9' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.11' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.5' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.11' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.12 depends on 0.10, 0.11
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.10' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.12' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.11' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.12' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.13 depends on 0.10, 0.12
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.10' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.13' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.12' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.13' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.14 depends on 0.13
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.13' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.14' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.15 depends on 0.10
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.10' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.15' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.16 depends on 0.15
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.15' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.16' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.17 depends on 0.6, 0.11
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.6' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.17' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.11' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.17' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

-- 0.18 depends on 0.10, 0.17
INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.10' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.18' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;

INSERT INTO public.task_dependencies (organization_id, project_id, predecessor_id, successor_id, dependency_type)
SELECT '4f00f16b-96d8-4fd6-9375-20e2b11564a6', 'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  p.id, s.id, 'finish_to_start'
FROM public.roadmap_tasks p, public.roadmap_tasks s
WHERE p.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND p.external_key = '0.17' AND p.deleted_at IS NULL
  AND s.project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND s.external_key = '0.18' AND s.deleted_at IS NULL
ON CONFLICT (predecessor_id, successor_id, dependency_type) DO NOTHING;