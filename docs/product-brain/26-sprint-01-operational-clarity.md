# 26 — Sprint #1: Operational Clarity

Two operational-clarity fixes from the product-owner review ("cosas para arreglar"). Scope is
**only** these two outcomes — Risk/SOP/Variance views, Timeline Playback, and What-if Simulation
are later sprints.

> Principle: a PM should immediately know **who owns the work** and **where to see the Critical Path**.

---

## 1. Workboard Task Ownership Visibility
**Decision (binding):**
- **Every Workboard card must clearly show the assigned person** (or group resource).
- If a task is unassigned, the card shows **"Unassigned"**.
- This is **execution-critical, not decorative** — PMs must know who owns each task without opening
  the detail panel.

**Implementation (2026-06-27):**
- `workboard/page.tsx` resolves names from `profiles` (person, `assigned_to`) and `resources`
  (crew/team/vendor, `assigned_resource_id`) into an `assigneeNames` map passed to the client.
- Each card shows **avatar (or initials) · name · role** (👤 fallback, truncates gracefully), amber
  **"Unassigned"** when no owner, or **"Assigned user unavailable"** when an owner id resolves to no
  name. Role from `project_team_members.project_role` (person) / `resources.resource_type` (group);
  avatar from `profiles.avatar_url`. **Real data only — never invented**
  (`src/lib/roadmap/task-owner.ts`, unit-tested).
- Drag-and-drop, status columns, and filters are unchanged.

## 2. Critical Path — Single Source of Truth
**Decision (binding):**
- Critical Path **already exists in the Living Graph** (`lib/graph/living-graph-analysis.ts`
  longest-path + `lib/execution/critical-path.ts` CPM engine). It is the **one source of truth**.
- The Execution Map "Critical Path" tab must **never** show "available soon" for a capability that
  exists elsewhere. The misleading placeholder is **removed**.
- The tab now shows a clear message + CTA **"Open Critical Path in Living Graph"** that deep-links
  to `…/execution-map/living-graph?overlay=criticalPath` (the Living Graph reads the param and
  selects the Critical Path overlay). **No second Critical Path engine** is introduced.

**Why:** users must never see "coming soon" for something the product already does
([ADR-002](adrs/ADR-002-living-graph-primary-surface.md); CAP-005/CAP-023). The Living Graph remains
the primary visual surface; the Roadmap/Execution Map links to it rather than duplicating it.

---

**Protection rules:** the Workboard must keep showing task ownership; the Critical Path must keep a
single deterministic source and never reintroduce a "coming soon" placeholder for an existing
capability.
