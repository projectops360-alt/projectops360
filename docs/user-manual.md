# ProjectOps360° User Manual — from Login to the Closeout Report

A step-by-step user guide that walks through the complete lifecycle of a project within the platform: from your first sign-in to generating the project closeout document.

> The app is live in production at **projectops360.vercel.app** and is bilingual (English / Español). You can switch the language with the selector in the sidebar. This manual is in English; button names are shown in English, with the Spanish equivalent in parentheses when it differs.

---

## Table of contents

1. [Create an account and sign in](#1-create-an-account-and-sign-in)
2. [Get to know the main interface](#2-get-to-know-the-main-interface)
3. [Create or import a project](#3-create-or-import-a-project)
4. [Charter & Governance — the project foundation](#4-charter--governance--the-project-foundation)
5. [Delivery Framework — how it will be executed](#5-delivery-framework--how-it-will-be-executed)
6. [Team & Roles and Stakeholders](#6-team--roles-and-stakeholders)
7. [Execution Map — the execution map](#7-execution-map--the-execution-map)
8. [Workboard — execute the work](#8-workboard--execute-the-work)
9. [Rhythm Center — meetings and cadence](#9-rhythm-center--meetings-and-cadence)
10. [Communications, Decisions, Documents and Memory](#10-communications-decisions-documents-and-memory)
11. [Budget, BIM and Labor Capacity](#11-budget-bim-and-labor-capacity)
12. [Status Report](#12-status-report)
13. [Closeout — the Project Closeout Report](#13-closeout--the-project-closeout-report)
14. [Quick checklist of the full cycle](#14-quick-checklist-of-the-full-cycle)

---

## 1. Create an account and sign in

### Sign in
1. Go to **projectops360.vercel.app**. If you're not authenticated, the app sends you to `/login`.
2. Enter your **email** and **password** (minimum 6 characters).
3. Click **Sign in** (*Iniciar sesión*).
4. If your credentials are correct, you land in the **Command Center**.

> Authentication is **email and password** based (via Supabase). If your email isn't confirmed, you'll see a message indicating so; if the credentials are invalid, you'll see "Invalid login credentials".

### Create a new account
1. From `/login`, click **Don't have an account? Create one** (*¿No tienes cuenta? Crea una*) → takes you to `/signup`.
2. Fill in: **Display name**, **email**, **password** and **confirm password** (they must match and be ≥ 6 characters).
3. Click **Create account** (*Crear cuenta*).
4. The **"Check your email"** screen appears. We sent a confirmation link to your email.
5. Open that link in your inbox. Once confirmed, the app exchanges the session and takes you to the Command Center.

> There is no automatic sign-in after registration: you must confirm your email first. If the confirmation link fails, go back to `/login` and try again.

### Sign out
Click your avatar (top right) → **Sign out** (*Cerrar sesión*).

---

## 2. Get to know the main interface

Once inside, the app has three areas:

- **Left sidebar** (collapsible): global navigation.
- **Top bar** (*header*): organization name, **global search** (open it with `⌘K` / `Ctrl+K`) which searches across projects, tasks, milestones, risks, materials, RFIs, resources, decisions and budgets; notifications (bell); and your user menu.
- **Center area**: the content of each module.

### Sidebar navigation (in order)

**Global (always visible):**
1. **Command Center** — `/` → overall summary of your organization.
2. **Projects** — `/projects` → list and management of projects.
3. **AI Operator** — `/ai-operator` → AI hub (includes Import project and BIM).
4. **Reports** — `/reports`.
5. **Team** — `/team`.

**Inside a project (appear only when you're navigating a project):**
6. **Execution Map**.
7. **Workboard**.
8. **Project Memory**.

**At the bottom:**
9. **Billing & Plan** — `/organization/billing`.
10. **Settings** — `/settings`.

> When you enter a project, a **project tab bar** (*ProjectTabs*) also appears above the content with all the project's modules: Command Center, Charter & Governance, Delivery Framework, Team & Roles, Workboard, Execution Map, Labor Capacity, BIM, Memory, Rhythm, Status and Settings. Additional modules (Communications, Decisions, Documents, Budget, Stakeholders, Closeout, Audit, Search) are reached from links in the project dashboard or by direct URL.

---

## 3. Create or import a project

### Create a project from scratch
1. Go to **Projects** (`/projects`) and click **New project** (*Nuevo proyecto*).
2. In the dialog, fill in:
   - **Project name** (required, max 200 characters).
   - **Description** (optional).
   - **Status** (*Planning* or *Active* — defaults to *Planning*).
   - **Project type**: General, Software Development, Data Center Construction, Residential Construction, Commercial Construction, Infrastructure, Industrial.
   - **Start from a template** (checkbox): if you check it, placeholder phases, tasks, dependencies, resources, budget and risks are instantiated.
   - **Default language** of the project (English/Español).
3. Click **Create project**.

The project is created and you're taken automatically to the **Charter** with an onboarding banner (*"Start by defining the project foundation…"*). That's the official first stop: defining the charter.

> The **delivery framework** (Predictive / Agile / Scrum / Kanban / Hybrid / XP) is **not** chosen here. It's configured later, in the **Delivery Framework** module.

### Import an existing project
If you already have a project documented in a file, you can import it:
1. From the *New project* dialog, click **"Or import an existing project file…"** → takes you to `/import` (also reachable from **AI Operator**).
2. Upload your file. Supported formats: **Excel (.xlsx/.xlsm), CSV, JSON, Word (.docx), PDF, TXT, Markdown (.md)** — up to 25 MB.
3. Choose the mode: **Create new project** or **Merge into existing project** (in this case, choose the target project).
4. Click **Analyze file**. The AI extracts tasks, milestones, dependencies, resources, materials, budget and risks.
5. In the **review** phase, you'll see the count of everything detected and the detected project type (editable). Review tab by tab (*Summary, Tasks, Milestones, Dependencies, Resources, Materials, Budget, Risks, Warnings, Raw*) and check/uncheck what you want to import. Each row shows its confidence level (*Valid, Needs review, Invalid, Duplicate, Missing data*).
6. Click **Approve & import**. When done, **Open project** takes you to the Execution Map with the onboarding spotlight.

---

## 4. Charter & Governance — the project foundation

The Charter is the living document that defines **why** the project exists, **what** it delivers, **how** it's governed and **who** approves. It's the foundation that guides all execution and reporting. It's the first stop after creating the project.

### Charter status flow
`draft → under_review → pending_approval → approved/active` (locked). Until it's approved, the project is considered to have no formal foundation.

### Sections to complete
Work through these tabs in order:

1. **Charter summary** — executive summary, background, **business case** (required), business drivers. Defines *why*.
2. **Scope and objectives** — **goal** (req), **objectives** (req), **in/out of scope** (req), assumptions, constraints, limitations, dependencies. Defines *what* and the boundaries.
3. **Deliverables and success criteria** — **main deliverables** (req), acceptance criteria, **success criteria** (req), knowledge transfer. Defines *what's delivered and how it's measured*.
4. **Governance rules** — **governance model** (req), decision-making, **escalation process** (req), **reporting cadence** (req), incident/change/risk/quality/communication management.
5. **Roles** — table of roles (Sponsor, PM, Steering, PMO…), person, responsibility and **authority level** (Final decision / Approve / Recommend / Review / Consulted / Execute / Informed). Reuses people from the Team Center.
6. **Approval matrix** — rules by area (scope change, budget, schedule, risk acceptance, escalation, vendor change, milestone acceptance, project closure): *who approves what*.
7. **Governance rules** (extra) — rules by type (incidents, changes, risks, quality, communication, status reporting, stakeholder review, budget/schedule control).
8. **Sign-Off** — record of charter approval signatures.
9. **AI and Control** — AI tools: **Gap Analysis** (gaps vs. PMO standard), **Scope Creep Check**, **Stakeholder Summary** (explanation in business language), **Charter Q&A** and **Generate Governance with AI**.

### AI assistance
- **"Generate with AI"** button in the header: fills in the charter's empty fields.
- Each field has its own **AI** button to generate that specific field.

### Approve the charter
- To submit for approval you need: **100% of required fields** + **Roles** + **Approval matrix** + **Sign-Off** with content (governance rules are recommended, not blocking).
- Click **Submit for approval** → then **Approve / Reject**. On approval, the charter is *locked* and a version is created in the history.
- Editing an approved charter opens a new revision (history isn't lost).

### Additional views
- **Charter summary** (`/charter/summary`): read-only view oriented to stakeholders.
- **Print / PDF** (`/charter/print`): printable version of the full charter. *Print/PDF* button in the header.
- **"Delivery framework"** button: the bridge that takes you to `/delivery?setup=true` after approval.

> While the charter isn't approved, you'll see a notice in the dashboard: *"Complete and approve the charter before real execution"*. Once approved it changes to *"Charter is approved. Project foundation is set."*

---

## 5. Delivery Framework — how it will be executed

Here you diagnose the project's context and choose the **delivery model** (Predictive/Agile/Scrum/Kanban/Hybrid/XP), manage the backlog, cycles/sprints and the framework's health. It's the natural bridge after approving the charter.

### Diagnostic wizard
1. Go to **Delivery Framework** (`/delivery`) and open the **Wizard / Diagnostic**.
2. Answer 8 context selectors: project type, uncertainty, governance, documentation, change control, feedback frequency, vendor dependency, cadence.
3. Click **Recommend framework**. The AI returns the recommended method + confidence level + reasoning + suggested columns.
4. You can **override** the method if you prefer and click **Save configuration**.

### Module tabs
- **Overview**: adaptive metrics by method (Kanban → WIP/blocked/queue/delivered; Predictive → progress/milestones/pending; Scrum/Agile → active cycles/backlog/in progress/completed), context cards, **execution board with editable WIP limits** (turns red if you exceed the limit) and **suggested meeting rhythm** with a *"Schedule in Rhythm Center"* button (creates weekly meetings without duplicates). **"Activate execution"** action.
- **Backlog**: backbone of **milestones** (project phases) with a *"Generate milestones with AI"* button from the charter; backlog items aligned to goal/milestone/risk, with priority and type; list or by-milestone views; *"Prioritize with AI"* and *"Generate with AI"* buttons; **selective or bulk promotion to the Workboard**.
- **Cycles**: create sprints/cycles with goal and dates; add backlog items; states `planned → active → completed`; promote items *"To Workboard"*; *"Lessons learned with AI"* button per cycle.
- **AI & Health**: **scope creep detection** (alerts convertible to *change request* or resolved/dismissed), **stakeholder summary** and **framework health** (recommends adjustments if the project drifts).

> The method you choose here **adapts the Workboard labels** (columns are renamed based on the framework) and defines the **meeting rhythm** suggested in the Rhythm Center.

---

## 6. Team & Roles and Stakeholders

### Team & Roles Center (`/team`)
Here you compose the team, assign roles and permissions, define RACI responsibilities and grant read-only access to stakeholders. Three tabs:

- **Members and roles**: add people from the **organization directory**, a full **company team**, an **external contact** (vendor), by **email invitation**, or a **manual role** without a person. Each member has project role / delivery role / governance role and permission level. Quick access **flags**: approve changes, view budget, access memory, manage tasks. **"Recommend roles with AI"** button (suggests roles based on the charter). *Note: stakeholders and observers don't consume a billable seat.*
- **RACI**: assign **R/A/C/I** (Responsible/Accountable/Consulted/Informed) on milestones and deliverables to each member, grouped by entity. **"Draft RACI with AI"** button.
- **Stakeholder access**: grant lightweight/free access to observers, executives and external approvers, with access level and *comment* and *approve* permissions. Doesn't consume a seat.

> The module shows a **team completeness score** and warns if a critical role is missing (e.g. PM) or approval governance is missing.

### Stakeholders (`/stakeholders`)
Register the project's stakeholder map with their **influence** and **interest** level (high/medium/low) — the classic stakeholder management matrix. You can create and archive stakeholders. This catalog feeds the Team Center (access) and the Charter (stakeholder summary).

---

## 7. Execution Map — the execution map

The Execution Map (`/execution-map`) is the project's map of milestones and tasks, with dependencies and topological ordering. It has **7 internal tabs + Living Graph**:

1. **Overview**: the *Roadmap Hero* (current phase, current milestone, next milestone, overall progress, blockers), the **next step** panel (recommended next action) and the execution dashboard (counts by status, current sprint, recent changes).
2. **Timeline**: visual chronology of the roadmap.
3. **Tasks**: list of tasks grouped by milestone, with dependency management (predecessors, cycle validation).
4. **Flow**: live process flow with KPIs, conformance, milestone distribution and blockers.
5. **Gantt**: visual date editing.
6. **Critical Path**: coming soon.
7. **Dependencies**: add and edit dependencies with FS/SS/SF/FF types and date updates.
8. **Living Graph**: additional button that opens the graph view at `/execution-map/living-graph`.

### Create milestones and tasks
- In the Execution Map header: **Create task** and **Create milestone** buttons.
- **Milestone form**: title, description, status, priority, sprint, estimated hours, acceptance criteria, dependency/execution notes, block reason, scheduling with dates/progress/duration, and an **AI prompt section** (body, context, AI tool target), implementation and test notes.
- When arriving from import with `?onboard=true`, you'll see an **onboarding spotlight** inviting you to create your first milestone.

> The task order respects dependencies (topological ordering) and is **consistent between Workboard and Timeline**.

---

## 8. Workboard — execute the work

The Workboard (`/workboard`) is the single execution board. Here you move tasks across status columns with **drag and drop**, respecting dependencies and WIP limits.

- **Columns adapted to the delivery method**: labels change based on the framework chosen in Delivery, but task states are always: `not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred`.
- **Status change**: when you move a task, a dialog asks for a **mandatory note** based on the destination (e.g. when marking *done* or *blocked*).
- **Filters**: by sprint and by milestone.
- **Dependency blocking**: you can't advance a task if its predecessor isn't met (you'll see *"dependency not met"*).

> Tasks and dependencies are the same as in the Execution Map: here you **execute** them, there you **plan and visualize** them.

---

## 9. Rhythm Center — meetings and cadence

The Rhythm Center (`/rhythm`) manages the project's calendar and meetings. Each meeting is created from a **template** that auto-fills title, objective, outcome and agenda.

### Meeting types (templates)
`kickoff`, `status_update`, `stakeholder_review`, `project_review`, `closing`, `other`. Each one brings an **agenda with ordered sections** (e.g. *kickoff* has 8 sections; *closing* has 8: deliverables acceptance, final schedule/budget, pending items, risk closure, lessons, resource release, recognition, archive).

### Create a meeting
1. Click **Create meeting**, choose the **type** → the agenda auto-fills from the template.
2. Fill in date, priority, link and attendees.
3. Save.

### During the meeting (Meeting Drawer)
Open the meeting in the side drawer: edit the agenda, mark attendance, capture **decisions** and **action items** live, take notes and generate the **AI summary**.

### Complete the meeting
Click **"Complete meeting"**. This:
1. Generates the **AI summary** of the meeting.
2. Syncs the meeting to **Project Memory**.
3. Marks meeting and event as `completed`.
4. **If it was a `closing` type meeting** → triggers the full project closure flow (see [section 13](#13-closeout--the-project-closeout-report)).

> The Rhythm Center has **List** and **Calendar** views, filters by type/status/date and an *upcoming events* panel. You can schedule the suggested rhythm directly from the Delivery Framework Overview.

---

## 10. Communications, Decisions, Documents and Memory

These modules (reachable from links in the project dashboard or by direct URL) are the project's **operational memory**.

### Communications (`/communications`)
Register and categorize all communications (email, meeting, phone, Teams, Slack, in-person, document, manual note) with date, status (draft/logged) and a **follow-up flag**. Communications with pending follow-up feed the Closeout gate.

### Decisions (`/decisions`)
Decision log with status (`proposed/accepted/rejected/deferred/revoked`) and **impact area** (scope/schedule/budget/risk/quality/communication/document/other). Unresolved `proposed` decisions are a Closeout criterion. They can be linked to Rhythm Center meetings.

### Documents (`/documents`)
Document management by **status** (draft/review/approved/archived) and **type** (evidence/contract/specification/report/presentation/other), via upload or external URL. Per-document detail view.

### Project Memory (`/memory`)
The project's "living memory": knowledge items with authorship, participants, importance, sentiment, tags, **AI classification** and **traceability links** to tasks, milestones, risks, stakeholders, decisions, documents, communications and meetings. It automatically receives the summary of each completed meeting and, at closure, the **Project Closeout Report**.

---

## 11. Budget, BIM and Labor Capacity

### Budget (`/budget`)
Review and edit the budget estimate grouped by category, with subtotals and total. **Quantities and unit costs are editable inline**; subtotals and total recalculate live and persist when you leave the field. **Print / PDF** button. Data comes from `material_requirements` (fed by the BIM takeoff).

### Drawing Intelligence / BIM (`/drawing-intelligence`)
Upload drawings/plans (manual or via Autodesk/Procore/Google Drive connectors), process them with AI (OCR + interpretation) and extract **takeoff, insights, risks, RFIs and versions**. Processing modes: *quick_scan / standard_analysis / deep_analysis*. Tabs: upload, library, extractions, risks, rfis, submittals, takeoff, versions, schedule, cost, actions, evidence, logs. Insights can be converted to draft RFI, submittal, inspection, schedule constraint or cost impact. The **takeoff feeds the Budget** (materials).

### Labor Capacity (`/labor-capacity`)
Plan and monitor labor capacity (module that appears based on project type):
- **Matrix**: capacity by trade/week/zone with required/available/gap hours, % utilization, risk and critical path.
- **Lookahead**: 3- and 6-week window with readiness (ready/at_risk/not_ready/blocked), explanatory narrative and **idle crew risk** with recommended actions (reassign/stagger/expedite prerequisite/confirm vendor/monitor).
- **Workface**: per-activity view with weeks, % readiness, missing prerequisites, block types and idle risk.

---

## 12. Status Report

The Status Report (`/status`) generates a **status report** in plain, visual language, oriented to a non-technical reader, with everything **auto-calculated** from the project's live data. It's **read-only**: you don't edit it, you generate and export it.

It includes:
- **Header** with logo, project type, generation date, planning window and the **project goal** (pulled from the Charter).
- **Blockers banner** if there are tasks on hold.
- **Progress ring** with % and a natural-language headline, plus stats (done/in progress/on hold/to do).
- **"What to do now"** — daily plan grouped by responsible person, with actions (unblock/do now/start/assign) and indication of tasks waiting on a predecessor.
- **The journey** — phase-by-phase walkthrough with status and progress bar.
- **Done / Right now / What's coming**.
- Other items to review and **materials**.
- **"Download PDF"** button.

---

## 13. Closeout — the Project Closeout Report

Closeout (`/closeout`) is the final phase. It shows the **closeout readiness gate** and, on completing the Closing meeting, the **auto-generated closeout report** with metrics and an AI narrative, printable to PDF.

### The readiness gate (traffic light)
Before closing, review 10 criteria:

- **Blocking** (if they fail, you can't close): activities closed (0 open tasks), no blocked tasks, risks resolved, RFIs answered, action items closed.
- **Non-blocking** (only warn): milestones completed, follow-ups resolved, submittals resolved, decisions made, budget reconciled.

The panel shows a traffic light, score % and each check with detail.

### How the project closure is triggered

> Closure is **not** an isolated "close project" button. The trigger is **completing the Closing meeting in the Rhythm Center**.

Full flow:
1. **Schedule a `closing` type meeting** from the Rhythm Center. The *closing* template defines the agenda (deliverables acceptance, final schedule/budget, pending items, risk closure, lessons, resource release, recognition, archive).
2. **During the meeting**, in the Meeting Drawer, capture decisions, action items and notes.
3. Click **"Complete meeting"**. This generates the AI summary, syncs to Project Memory and, being a `closing` meeting, runs `generateCloseoutReport`:
   - Saves the report to the meeting (field `ai_summary.closeout`).
   - Inserts an item into **Project Memory** titled *"Project Closeout Report"* (source: rhythm_center, high importance, type closeout_report).
4. **Open the Closeout module** (`/closeout`): the page reads the auto-generated report and displays it.

### What the Closeout Report contains
- **Header** with logo, "Project Closeout Report", date and **status stamp** (Ready/Pending).
- **AI executive summary** (if not generated, it warns it's produced on completing the Closing meeting).
- **KPIs**: % tasks completed, schedule variance, budget variance, % risks resolved.
- **Key achievements**, **milestone duration table** and performance cards (schedule / budget / risks & incidents / governance & participation).
- **Lessons learned** (what went well / challenges and how they were handled), **open issues** and **next steps** — all part of the AI narrative generated at closure.
- **Resources and project archive**.
- **"Download PDF"** button (filename `CLS…`).

> The report is built from **all the accumulated data** of the project: charter, tasks, risks, RFIs, submittals, decisions, budget and meetings. That's why it's important to have kept each module up to date throughout the cycle.

---

## 14. Quick checklist of the full cycle

Recap of the ideal journey of a project from start to finish:

1. **Create account / sign in** → land in the Command Center.
2. **Create project** (or **import** an existing one) → the Charter opens.
3. **Charter**: complete summary, scope, deliverables, governance, roles, approval matrix and sign-off → **approve the charter**.
4. **Delivery Framework**: diagnose and choose the delivery method → activate execution → schedule the rhythm in the Rhythm Center.
5. **Team & Roles**: compose the team, assign RACI and grant stakeholder access. **Stakeholders**: register the influence map.
6. **Execution Map**: create milestones and tasks with dependencies → define the plan.
7. **Workboard**: execute tasks (drag and drop), respecting dependencies.
8. **Rhythm**: meeting cadence (kickoff → status → reviews…).
9. **Communications / Decisions / Documents / Memory**: keep registering everything during execution.
10. **Budget / BIM / Labor Capacity** (by project type): control cost, drawings and capacity.
11. **Status**: generate and download the status report whenever needed.
12. **Rhythm → `closing` meeting**: complete the Closing meeting → triggers the report.
13. **Closeout**: review the readiness gate, download the **Project Closeout Report** as PDF.

With that, the project is formally closed and its memory preserved for future projects.