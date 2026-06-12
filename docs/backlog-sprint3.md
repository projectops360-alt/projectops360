# ProjectOps360° MVP-0 — Updated Backlog (Post-Dogfooding)

**Generated:** 2026-06-07
**Source:** Dogfooding Feedback Log (Task 2.8) — 16 findings
**Filter rules applied:**
1. Critical blockers first
2. Confusing screens affecting core workflow
3. Missing fields only if they support Project Memory & Decision Traceability
4. Dashboard improvements around useful real questions
5. Traceability workflow friction
6. AI only where it reduces friction
7. Defer non-MVP scope

---

## Sprint 3 — Core Stability & Traceability Closure

*Focus: Remove all blockers, close traceability gaps, make the product usable for real daily work.*

### 3.1 Remove dead sidebar navigation links
- **Reason:** F-01 — 5 of 7 sidebar items lead to 404. This is the first thing a user sees and it's broken. Blocks trust.
- **Priority:** 🔴 P0 — Critical blocker
- **Estimate:** S (30 min)
- **Source finding:** F-01
- **Acceptance criteria:**
  - Sidebar only shows links to pages that exist
  - Dashboard link points to `/` or `/projects` (not `/dashboard`)
  - Team, Reports, Settings, Language links removed or hidden
  - No 404 from any sidebar click

### 3.2 Fix React Hook violation + all 5 statuses in Create Project dialog
- **Reason:** F-08 — `useTranslations()` called inside JSX `<option>` violates React Hook Rules. F-07 — only 2 of 5 statuses shown. Both issues are in the same dialog. Bundle the fix.
- **Priority:** 🔴 P0 — Critical (hook violation) + 🟡 Medium (statuses)
- **Estimate:** S (45 min)
- **Source findings:** F-08, F-07
- **Acceptance criteria:**
  - `useTranslations` called at component level, not inside JSX
  - All 5 status options visible in Create Project dialog
  - Default status remains `planning`
  - Build passes with no React Hook lint warnings

### 3.3 Fix hardcoded locale strings + add missing i18n keys
- **Reason:** F-09 — 3 hardcoded ternaries in project detail bypass i18n. F-02 — `sourceRecordId` keys missing in both locales. Both are i18n integrity issues. Fix together.
- **Priority:** 🔴 P0 — Critical (both break the i18n contract)
- **Estimate:** S (45 min)
- **Source findings:** F-02, F-09
- **Acceptance criteria:**
  - Zero hardcoded locale ternaries in `page.tsx`
  - All 3 metadata labels use `t()` with proper keys in en.json/es.json
  - `sourceRecordId` keys added to both locales (or field removed — see 3.4)
  - `next build` passes with no missing key warnings

### 3.4 Remove sourceRecordId field from decision dialogs
- **Reason:** F-02 + F-14 — The field is unusable: validated as UUID server-side, presented as plain text, no picker, missing labels. Even with i18n keys added (3.3), users can't type UUIDs from memory. Removing it eliminates friction and the i18n gap together. Server action already has `sourceType` + `sourceRecordId` as optional — removing from UI only.
- **Priority:** 🟡 Medium — Usability friction
- **Estimate:** S (30 min)
- **Source findings:** F-02, F-14
- **Acceptance criteria:**
  - `sourceRecordId` input removed from Create Decision dialog
  - `sourceRecordId` input removed from Edit Decision dialog
  - Server action still accepts the field (for AI extraction) but it's optional
  - No broken layout or orphan labels
  - If 3.3 already added i18n keys, remove them since field is gone

### 3.5 Close traceability gaps — data fix
- **Reason:** F-04 + F-05 — 7 decisions without evidence, 3 communications without links. This is the core MVP wedge: being able to trace every decision to its origin. Without these links, the dashboard can't answer Q4 and Q5.
- **Priority:** 🟠 P1 — High (core value prop)
- **Estimate:** S (30 min — direct DB inserts)
- **Source findings:** F-04, F-05
- **Acceptance criteria:**
  - All 10 decisions have at least 1 traceability link
  - All 10 communications have at least 1 traceability link
  - Traceability health ≥ 80% (currently 60%)
  - Dashboard Missing Links widget shows ≤ 5 entities (currently 12)

**Links to create:**
| Source | → | Target | Link Type |
|--------|---|--------|-----------|
| D: Use ProjectOps360° as product name | → | C: Initial Product Vision Discussion | derived_from |
| D: Use ProjectOps360° as product name | → | E: Master Product Document | derived_from |
| D: Use i18n Spanish/English | → | E: Functional Engineering Document | derived_from |
| D: AI Super Project Manager must be transversal | → | E: Ingeniería de Detalles | derived_from |
| D: Use ProjectOps360° to manage own dev | → | E: Master Product Document | derived_from |
| D: Start with manual comms/evidence | → | E: Functional Engineering Document | derived_from |
| D: Defer BPM/materials/ERP | → | E: Master Product Document | derived_from |
| D: Use human-in-the-loop for AI | → | E: Ingeniería de Detalles | derived_from |
| C: Initial Product Vision Discussion | → | D: Use React/Next.js+Supabase | related_to |
| C: Communication Plan & Doc Control | → | D: Use i18n Spanish/English | derived_from |
| C: Communication Plan & Doc Control | → | E: Functional Engineering Document | derived_from |
| C: Supabase Setup Discussion | → | D: Use React/Next.js+Supabase | derived_from |
| C: Supabase Setup Discussion | → | E: Database Schema Document | derived_from |

### 3.6 Add Start Date and Target End Date to Create Project dialog
- **Reason:** F-06 — Dates exist in DB and Edit dialog but not Create. Forces two-step flow (create → edit) for every project. Not directly part of decision traceability, but project dates are fundamental metadata shown on the dashboard.
- **Priority:** 🟡 P2 — Medium
- **Estimate:** S (30 min)
- **Source finding:** F-06
- **Acceptance criteria:**
  - `startDate` and `targetEndDate` datetime-local inputs appear in Create Project dialog
  - Fields are optional (matching Edit dialog)
  - Server action `createProjectAction` accepts and persists both dates
  - Created project shows dates on dashboard immediately

### 3.7 Add "Decisions without evidence" severity tier to dashboard
- **Reason:** F-13 — The Missing Links widget doesn't distinguish severity. A decision without evidence is critical; a document without a link is informational. The dashboard should help users prioritize which gaps to close first. This directly answers Q4 ("Which decisions have no evidence?") and Q5.
- **Priority:** 🟡 P2 — Medium (improves dashboard utility for real questions)
- **Estimate:** M (2-3 hours)
- **Source finding:** F-13
- **Acceptance criteria:**
  - Missing Links widget shows 3 severity tiers:
    - 🔴 Decisions without evidence (links to decision list filtered to unlinked)
    - 🟠 Decisions/communications without any links (general traceability gap)
    - 🟡 Documents/action items without links (informational)
  - Each tier shows entity count and expandable list
  - Zero items in a tier shows green checkmark
  - Traceability health bar still works

---

## Sprint 3 Total Estimate: ~6-7 hours (solo builder)

---

## Sprint 4 — Action Items & Workflow Completion

*Focus: Complete the entity lifecycle so every record type can be fully managed.*

### 4.1 Create Action Items management page + dialogs
- **Reason:** F-03 — Action items exist in DB, dashboard widget, and AI extraction, but there's no way to manually create, edit, or view a full list. This is the only entity type without a CRUD interface. Supports decision traceability because action items can be linked to decisions via traceability_links.
- **Priority:** 🟠 P1 — High (completes the entity model)
- **Estimate:** L (6-8 hours) — page, list, create dialog, edit dialog, server actions, i18n
- **Source finding:** F-03
- **Acceptance criteria:**
  - `/projects/[projectId]/action-items` page with filterable list
  - Create Action Item dialog: title, description, priority, assignee, due date, status, linked stakeholders
  - Edit Action Item dialog with same fields
  - Server actions: `createActionItemAction`, `updateActionItemAction`, `archiveActionItemAction` (with `logAudit`)
  - Dashboard stat card links to action items page
  - Full i18n coverage (EN + ES)

### 4.2 Add dashboard navigation card for Action Items
- **Reason:** Currently dashboard has 7 nav cards (Search, Stakeholders, Communications, Meetings, Decisions, Documents, Audit) but no Action Items card.
- **Priority:** 🟡 P2 — Medium
- **Estimate:** S (20 min)
- **Source finding:** F-03 (implicit)
- **Acceptance criteria:**
  - Action Items card appears in dashboard navigation grid
  - Links to `/projects/[projectId]/action-items`
  - i18n labels in both locales

---

## Sprint 4 Total Estimate: ~7-9 hours

---

## Parking Lot — Deferred (Non-MVP or Low Priority)

| ID | Item | Reason for deferral | Revisit |
|----|------|---------------------|---------|
| P-01 | Stakeholder org/company + phone fields (F-10) | Not required for Project Memory & Decision Traceability | Sprint 5+ |
| P-02 | Meeting attendees multi-select picker (F-11) | Free-text works for MVP; stakeholder picker is UX polish | Sprint 5+ |
| P-03 | Log initial planning meetings (F-12) | Optional dogfooding data; meetings feature already works | Sprint 4+ |
| P-04 | AI auto-suggest traceability links (F-15) | AI opportunity; manual linking works; reduces friction but not critical | Sprint 5+ |
| P-05 | AI meeting summary + extraction (F-16) | AI opportunity; extends existing flow to new entity | Sprint 5+ |
| P-06 | Team management page | No team in solo-builder model; non-MVP scope | Phase 1+ |
| P-07 | Reports page | No reporting requirements in MVP-0 scope | Phase 1+ |
| P-08 | Settings page | No configurable settings in MVP-0 | Phase 1+ |

---

## Backlog Rules Compliance Check

| Rule | Status | Evidence |
|------|--------|----------|
| 1. Critical blockers first | ✅ | 3.1, 3.2, 3.3 are P0 and first in Sprint 3 |
| 2. Confusing screens affecting core workflow | ✅ | 3.1 (dead nav), 3.7 (dashboard severity tiers) |
| 3. Missing fields only if supporting traceability | ✅ | Action Items (4.1) supports traceability; stakeholder org/phone (P-01) deferred |
| 4. Dashboard improvements around real questions | ✅ | 3.7 directly answers Q4/Q5 |
| 5. Traceability workflow friction | ✅ | 3.4 (remove unusable sourceRecordId), 3.5 (close data gaps) |
| 6. AI only where it reduces friction | ✅ | F-15/F-16 deferred to P-04/P-05 |
| 7. Defer non-MVP scope | ✅ | Team, Reports, Settings parked (P-06/P-07/P-08); stakeholder fields deferred (P-01) |

---

## Summary

- **Sprint 3:** 7 items, ~6-7h — Stability + traceability closure
- **Sprint 4:** 2 items, ~7-9h — Action Items CRUD completion
- **Parking Lot:** 8 items — All non-critical, non-MVP
- **Total open backlog:** 9 actionable items (down from 16 raw findings)
- **Scope remains MVP-0 focused:** ✅ Every Sprint 3-4 item directly supports Project Memory & Decision Traceability or removes blockers to using the product