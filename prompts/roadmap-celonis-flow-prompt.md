# Prompt: Build Celonis-Style Process Flow Roadmap View

## Objective

Replace the current `VisualRoadmapTimeline` component (vertical timeline) with a **horizontal Celonis-style process flow visualization** as a new view mode called `"flow"`. This component renders milestones as glass-morphism cards connected by animated SVG paths with flowing particles, transition labels explaining what happens between milestones, and a right-side insights panel.

## Reference Mockup

The complete HTML mockup is at `mockups/process-improvement-celonis.html` in the Ascendia/NovaWork repo (`C:\Ubuntu\home\efraiprada\novaworkglobal\active\mockups\process-improvement-celonis.html`). **Replicate the visual design, layout, animations, and UX from that mockup exactly** — adapted to this project's branding and data model.

---

## Tech Stack & Conventions

- **Framework:** Next.js 16 (App Router) with `next-intl` for i18n
- **Styling:** Tailwind CSS v4 with CSS custom properties (NO tailwind.config.js — uses `@theme inline` in `globals.css`)
- **Components:** React client components (`"use client"`) with TypeScript
- **Fonts:** Geist Sans / Geist Mono (via `next/font/google`)
- **Icons:** `lucide-react`
- **Data:** Props passed from server page — NO client-side fetching
- **File convention:** kebab-case filenames, components in `src/components/roadmap/`

## Brand Tokens (from `globals.css`)

```css
/* Use these CSS variables — do NOT hardcode hex values */
--brand-50: #ecfdf5;    --brand-100: #d1fae5;   --brand-200: #a7f3d0;
--brand-300: #6ee7b7;   --brand-400: #34d399;   --brand-500: #10b981;
--brand-600: #059669;   --brand-700: #047857;   --brand-800: #065f46;
--brand-900: #064e3b;   --brand-950: #022c22;

--background: #ffffff (light) / #020617 (dark);
--foreground: #0f172a (light) / #f8fafc (dark);
--card: #ffffff (light) / #0f172a (dark);
--border: #e2e8f0 (light) / #1e293b (dark);
--muted: #f1f5f9 (light) / #1e293b (dark);
--muted-foreground: #64748b (light) / #94a3b8 (dark);
--destructive: #ef4444;
--ring: var(--brand-500);
```

Tailwind classes available: `bg-brand-50` through `bg-brand-950`, `text-brand-*`, `border-brand-*`, etc.

## Data Model (existing types from `src/types/database.ts`)

```typescript
type MilestoneStatus = "planned" | "in_progress" | "completed" | "blocked" | "deferred";

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  start_date: string | null;   // ISO date
  target_date: string | null;  // ISO date
  progress_percent: number;    // 0–100
  order_index: number;
  icon_key: string | null;     // "setup" | "shield_database" | "users" | "notebook" | "link" | "sparkles" | "chart" | "loop" | "check_circle" | "rocket"
  color_key: string | null;
}

type TaskStatus = "not_started" | "prompt_ready" | "sent_to_ai" | "in_progress" | "implemented" | "tested" | "done" | "blocked" | "deferred";
type TaskPriority = "p1" | "p2" | "p3";

interface RoadmapTask {
  id: string;
  milestone_id: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimate_hours: number | null;
  actual_hours: number | null;
}

// Progress computed server-side:
interface RoadmapProgress {
  overallPercent: number;           // 0–100
  blockersCount: number;
  currentMilestoneId: string | null;
  nextMilestoneId: string | null;
  milestones: Record<string, {
    milestoneId: string;
    progressPercent: number;
    totalTasks: number;
    doneTasks: number;
  }>;
}
```

## Existing Icon Map (reuse from `visual-roadmap-timeline.tsx`)

```typescript
import { Settings, Shield, Users, BookOpen, Link2, Sparkles, BarChart3, RotateCcw, CheckCircle, Rocket } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  setup: <Settings />, shield_database: <Shield />, users: <Users />,
  notebook: <BookOpen />, link: <Link2 />, sparkles: <Sparkles />,
  chart: <BarChart3 />, loop: <RotateCcw />,
  check_circle: <CheckCircle />, rocket: <Rocket />,
};
```

---

## What to Build

### 1. New Component: `src/components/roadmap/flow-roadmap.tsx`

A `"use client"` component that renders the full Celonis-style flow view.

#### Props Interface:

```typescript
interface FlowRoadmapProps {
  milestones: Milestone[];
  tasks: RoadmapTask[];
  progress: RoadmapProgress;
  tasksByMilestone: Record<string, RoadmapTask[]>;
  taskCounts: Record<string, { total: number; done: number; inProgress: number }>;
  locale: Locale;
  translations: FlowRoadmapTranslations;
}
```

#### Layout (exactly like the mockup):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  KPI Bar (6 cards across the top)                                                │
├──────────────────────────────────────────────────────────┬───────────────────────┤
│                                                          │                       │
│  Process Flow Panel (scrollable canvas)                  │  Insights Panel       │
│                                                          │                       │
│  Row 1: M1 → M2 → M3 → M4 → M5  (left to right)       │  - Bottleneck Analysis│
│                                    ↓ (curve down)        │  - Conformance Check  │
│  Row 2: M10 ← M9 ← M8 ← M7 ← M6 (right to left)      │  - Task Variants      │
│                                                          │  - AI Recommendations │
│  With: SVG paths, animated particles, transition labels  │                       │
│                                                          │                       │
├──────────────────────────────────────────────────────────┴───────────────────────┤
│  Legend                                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Visual Elements (match mockup exactly)

#### A. KPI Bar (top row, 6 cards)
Compute from `progress` and `tasks` data:
1. **Milestones Completed** — count milestones with status `completed` (green top border)
2. **Overall Progress** — `progress.overallPercent` (blue top border)
3. **Tasks Completed** — count tasks with status `done` (purple top border)
4. **In Progress** — count tasks with `in_progress` status (green top border)
5. **Blockers** — `progress.blockersCount` (amber or red top border depending on count)
6. **Remaining Effort** — sum of `estimate_hours` for non-done tasks (purple top border)

Each card has: colored top border (2px), label (uppercase 10px), big value (28px bold), subtitle with context.

#### B. Process Flow Canvas

**Background:** Dark theme ONLY for this canvas area — `bg-slate-950` or `bg-[#0a0e1a]` with subtle radial gradient overlays (like the mockup). This dark background is scoped to the flow panel only, not the full page.

**Milestone Nodes** — Glass-morphism cards:
- `backdrop-filter: blur(20px)`, semi-transparent background
- Top border colored by status:
  - `completed` → `--brand-400` (emerald green)
  - `in_progress` → blue/indigo (`#818cf8`)
  - `planned` → dark gray (`#1e293b`)
  - `blocked` → `--destructive` (red) with pulsing glow animation
- Content: icon (from `ICON_MAP`), milestone title, date range, circular SVG progress ring, task count
- Status dot (top-right): green=healthy, amber=warning, red=critical/blocked, with glow
- If `in_progress`: show "CURRENT PHASE" floating label above

**SVG Paths** connecting milestones:
- Curved bezier paths (using `<path>` with C command)
- Path color by health:
  - `completed → completed`: green stroke (`--brand-400`)
  - involves `in_progress`: blue/indigo stroke
  - involves `planned`: dashed gray stroke
  - involves `blocked`: red stroke
- Glow layer: same path but thicker, lower opacity, with blur filter
- **Animated particles**: small circles (`r="3"`) that travel along each path using `<animateMotion>` with `<mpath>`. Green particles for healthy paths, amber for warning, red for blocked. Duration 1.5–2.5s, `repeatCount="indefinite"`. Some paths get 2 particles staggered with `begin` offset.

**Transition Labels** (floating between nodes):
- Positioned absolutely between each pair of connected milestones
- Dark glass background (`bg-slate-950/90 backdrop-blur-xl`)
- Content: throughput (task count for that milestone), avg time (computed from dates), short description from milestone description or auto-generated
- Hover: scale up slightly, brighter border, deeper shadow

**Serpentine Layout:**
- Row 1: milestones 1–5 positioned left-to-right
- Vertical curve connector from milestone 5 down to milestone 6
- Row 2: milestones 6–10 positioned right-to-left
- If < 10 milestones: fill what exists, adapt layout (if ≤5, single row)
- If > 10 milestones: extend with additional rows in serpentine pattern

**Rework Loops** (if blocked tasks exist):
- Dashed amber SVG arcs curving back from a blocked milestone to an earlier one
- Small label showing "↺ X blocked tasks — rework needed"

#### C. Right Insights Panel (320px wide)

Four stacked glass cards:

1. **Milestone Status Distribution**
   - List of all milestones ranked by completion
   - Each row: rank badge, name, progress bar, percentage
   - Color-coded by status

2. **Conformance / Progress Ring**
   - Large SVG ring showing overall progress
   - Breakdown: completed %, in_progress %, planned %, blocked %

3. **Task Distribution by Priority**
   - Horizontal bars showing P1/P2/P3 distribution
   - Each bar: label, filled bar, percentage

4. **Blockers & Recommendations**
   - If blockers exist: list blocked milestones/tasks with red indicator
   - Show which milestone is affected and suggest unblocking
   - Border-left color: red for critical, amber for warning

#### D. Legend Bar (bottom)
Small horizontal bar with dots/lines explaining: Completed, In Progress, Planned, Blocked, Active flow, Pending path.

### 3. Integration into `roadmap-client.tsx`

Add `"flow"` to the `ViewMode` type and add a fourth tab button with the `Network` or `GitBranch` icon from lucide-react. When selected, render `<FlowRoadmap>` instead of the other views.

### 4. Animations & Interactions

- **Particles:** SVG `<animateMotion>` along each path — green dots for healthy, amber for warning, red for critical. Stagger multiple particles per path.
- **Node hover:** translateY(-3px), brighter background, deeper shadow
- **Transition label hover:** scale(1.05), brighter border
- **Blocked milestone:** `animation: pulse 3s ease-in-out infinite` on box-shadow (red glow)
- **Status dot blink:** `animation: blink 2s infinite` for in_progress or blocked nodes
- **Horizontal scroll:** the flow canvas should be horizontally scrollable with custom styled scrollbar (thin, themed)

### 5. Responsive Behavior

- On smaller screens (< 1024px): hide the right insights panel, show flow canvas full-width
- Flow canvas has `overflow-x: auto` with `min-width` to maintain readability
- KPI cards: 6 columns on desktop, 3 columns on tablet, 2 on mobile

### 6. Dark-Mode Scoping

The flow canvas area uses a forced dark theme regardless of the page theme (the dark background is essential for the glass-morphism and glow effects to work). The KPI bar and insights panel should respect the page's light/dark mode.

Approach: wrap the flow canvas in a container with class `dark` and use `dark:` variants, OR use inline CSS variables scoped to that container.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/roadmap/flow-roadmap.tsx` | **CREATE** — main component |
| `src/app/[locale]/(app)/projects/[projectId]/roadmap/roadmap-client.tsx` | **MODIFY** — add "flow" view mode, import & render FlowRoadmap |
| `src/messages/en.json` (roadmap section) | **MODIFY** — add flow view translations if needed |
| `src/messages/es.json` (roadmap section) | **MODIFY** — add flow view translations if needed |

## DO NOT

- Do NOT create separate CSS files — use Tailwind classes + inline styles for SVG animations
- Do NOT use any external charting library — SVG paths and animations are hand-crafted
- Do NOT fetch data client-side — all data comes via props from the server page
- Do NOT modify the data model or database schema
- Do NOT change the existing Timeline, Board, or Tasks views
- Do NOT use emojis for icons — use lucide-react icons from the existing ICON_MAP
- Do NOT hardcode milestone titles or descriptions — everything comes from the data

## Quality Checklist

- [ ] Flow canvas renders correctly with 1–10+ milestones
- [ ] SVG paths connect each consecutive milestone pair
- [ ] Animated particles flow along every active path
- [ ] Transition labels appear between nodes with computed data
- [ ] Glass-morphism effect works on the dark canvas background
- [ ] Progress rings show correct percentages from `taskCounts`
- [ ] Blocked milestones pulse red and show in the insights panel
- [ ] Horizontal scroll works smoothly on the canvas
- [ ] Right panel shows real data from props
- [ ] KPI bar computes values from `progress`, `milestones`, and `tasks`
- [ ] "flow" tab appears in the view mode toggle and switches correctly
- [ ] No TypeScript errors
- [ ] Responsive layout (hides insights panel on small screens)
