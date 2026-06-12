# ProjectOps360° MVP-0 — Dogfooding Feedback Log

**Generated:** 2026-06-07
**Sprint:** Sprint 2 (Self-Use Validation)
**Reviewer:** Efrain Prada (Solo Founder)
**Data context:** 10 communications, 10 decisions, 10 documents, 10 links, 8 stakeholders, 0 meetings

---

## Findings (Prioritized by Severity)

### F-01: Dead sidebar navigation links
- **Category:** Confusing screens
- **Severity:** 🔴 Critical
- **Impact:** Users clicking Dashboard (`/dashboard`), Team (`/team`), Reports (`/reports`), Language (`/locale`), or Settings (`/settings`) hit 404 or dead ends. 5 of 7 sidebar items are broken.
- **Suggested improvement:** Remove unimplemented nav items from sidebar config. Only show links to pages that exist. Add a "Coming soon" badge for planned routes.
- **Fix:** 🟢 Now (Sprint 3)
- **Related:** `src/config/navigation.ts`, sidebar component

### F-02: Missing i18n keys for decision sourceRecordId
- **Category:** i18n text gaps
- **Severity:** 🔴 Critical
- **Impact:** `decisions.form.sourceRecordId` and `decisions.form.sourceRecordIdPlaceholder` are referenced in code but don't exist in en.json or es.json. The raw key path renders as visible label text in both locales — users see `decisions.form.sourceRecordId` instead of a human-readable label.
- **Suggested improvement:** Add the missing keys to both locale files with proper EN/ES translations. Consider removing the sourceRecordId field entirely from the dialog — it's validated as UUID server-side but there's no picker, making it unusable for humans.
- **Fix:** 🟢 Now (Sprint 3)
- **Related:** `messages/en.json`, `messages/es.json`, `src/components/decisions/create-decision-dialog.tsx`, `src/components/decisions/edit-decision-dialog.tsx`

### F-03: No Action Items management UI
- **Category:** Missing fields
- **Severity:** 🟠 High
- **Impact:** Action items exist in the DB, appear on the dashboard widget, and can be AI-extracted — but there's no way for users to manually create, edit, or view a full list. This breaks the "manage all project records" value proposition.
- **Suggested improvement:** Create `/projects/[projectId]/action-items` page with list + create/edit dialogs. At minimum, add a manual create action item button.
- **Fix:** 🟡 Soon (Sprint 3-4)
- **Related:** Action Items entity, dashboard widget, AI extraction flows

### F-04: 7 of 10 decisions have no document evidence linked
- **Category:** Traceability gaps
- **Severity:** 🟠 High
- **Impact:** The dashboard can't answer "where is the evidence?" for 70% of decisions. This undermines the core MVP wedge (decision traceability). Missing: product name, i18n, AI transversal, dogfooding, manual-first, deferred scope, and human-in-the-loop decisions.
- **Suggested improvement:** Add links from these decisions to their supporting evidence (Master Product Document, Ingeniería de Detalles, Functional Engineering Doc). Also add a "Decisions without evidence" alert widget to the dashboard.
- **Fix:** 🟢 Now (data fix), 🟡 Soon (dashboard widget)
- **Related:** `traceability_links`, dashboard-client.tsx

### F-05: 3 communications have zero traceability links
- **Category:** Traceability gaps
- **Severity:** 🟠 High
- **Impact:** Initial Product Vision Discussion, Communication Plan & Document Control Discussion, and Supabase Setup Discussion are orphan records. No decision or evidence can be traced back to these foundational conversations.
- **Suggested improvement:** Link "Initial Product Vision Discussion" → "Use ProjectOps360° as the product name" decision + Master Product Document. Link "Communication Plan & Document Control Discussion" → i18n decision + Functional Engineering Document. Link "Supabase Setup Discussion" → tech stack decision + Database Schema Document.
- **Fix:** 🟢 Now (data fix)
- **Related:** `traceability_links`

### F-06: Create Project dialog missing Start Date and Target End Date
- **Category:** Missing fields
- **Severity:** 🟡 Medium
- **Impact:** New projects can't set dates during creation. Users must create the project, then immediately edit it to add dates — two steps where one should suffice. The Edit dialog has these fields; the Create dialog doesn't.
- **Suggested improvement:** Add `startDate` and `targetEndDate` datetime-local inputs to the Create Project dialog, matching the Edit dialog.
- **Fix:** 🟡 Soon (Sprint 3)
- **Related:** `src/components/projects/create-project-dialog.tsx`

### F-07: Create Project dialog limits status to 2 of 5 options
- **Category:** Missing fields
- **Severity:** 🟡 Medium
- **Impact:** New projects can only be `planning` or `active`. Cannot create a project directly as `on_hold`, `completed`, or `cancelled`. While rare, it's an unnecessary limitation since the Edit dialog supports all 5.
- **Suggested improvement:** Show all 5 status options in the Create dialog, defaulting to `planning`.
- **Fix:** 🟡 Soon (Sprint 3)
- **Related:** `src/components/projects/create-project-dialog.tsx`

### F-08: React Hook rules violation in Create Project dialog
- **Category:** Confusing screens
- **Severity:** 🟡 Medium
- **Impact:** `useTranslations("projects")` is called inline inside `<option>` JSX elements (lines 132-133). This violates React's rules of hooks and could cause runtime errors or stale translations in edge cases.
- **Suggested improvement:** Move the `useTranslations` call to the component level (outside JSX) and use a variable reference.
- **Fix:** 🟢 Now (Sprint 3)
- **Related:** `src/components/projects/create-project-dialog.tsx`

### F-09: 3 hardcoded locale strings bypass i18n
- **Category:** i18n text gaps
- **Severity:** 🟡 Medium
- **Impact:** In the project detail page, "Start date", "Target end date", and "Created" are rendered via inline ternary (`locale === "es" ? "..." : "..."`) instead of `t()`. This breaks if a third locale is added and doesn't respect the i18n system.
- **Suggested improvement:** Replace inline ternaries with proper `t()` calls using `projects.metadata.startDate`, `projects.metadata.targetEndDate`, `projects.metadata.created`.
- **Fix:** 🟢 Now (Sprint 3)
- **Related:** `src/app/[locale]/(app)/projects/[projectId]/page.tsx` lines 457, 473, 487

### F-10: Stakeholders lack organization/company and phone fields
- **Category:** Missing fields
- **Severity:** 🟢 Low
- **Impact:** Stakeholder records can't store company affiliation or phone number. The name field placeholder says "Full name or organization" — cramping two data points into one field.
- **Suggested improvement:** Add `organization` (text, optional) and `phone` (text, optional) fields to the stakeholder schema and dialog.
- **Fix:** 🔵 Later (Sprint 4+)
- **Related:** `src/components/stakeholders/create-stakeholder-dialog.tsx`, `stakeholders` table

### F-11: Meeting attendees is free-text instead of structured multi-select
- **Category:** Data entry friction
- **Severity:** 🟢 Low
- **Impact:** Attendees are a comma-separated text string with no validation. There's also a separate "linked stakeholders" checkbox list — creating ambiguity about which field to use for tracking who was present. Typos in names can't be detected.
- **Suggested improvement:** Replace free-text attendees with a multi-select picker that references existing stakeholders. Keep linked_stakeholders for formal traceability links.
- **Fix:** 🔵 Later (Sprint 4+)
- **Related:** `src/components/meetings/create-meeting-dialog.tsx`

### F-12: No meetings registered in the project
- **Category:** Traceability gaps
- **Severity:** 🟢 Low
- **Impact:** The dashboard shows 0 meetings, making the stat card and widget empty. While no formal meetings were held (solo builder with AI chats), the initial planning sessions could be logged as meetings to validate the feature.
- **Suggested improvement:** Consider logging 2-3 planning sessions as meetings to validate the meeting workflow end-to-end.
- **Fix:** 🔵 Later (optional dogfooding)
- **Related:** Meetings entity, dashboard

### F-13: Dashboard doesn't distinguish "decisions without evidence" from other missing links
- **Category:** Confusing screens
- **Severity:** 🟡 Medium
- **Impact:** The "Missing Links" widget groups all entity types together. But a decision without evidence (Q4) is much more critical than a communication without a link. Users can't prioritize which gaps to close first.
- **Suggested improvement:** Split "Missing Links" into severity tiers: (1) Decisions without evidence = 🔴, (2) Decisions/communications without any links = 🟠, (3) Documents without links = 🟡. Show counts by tier.
- **Fix:** 🟡 Soon (Sprint 3-4)
- **Related:** `src/app/[locale]/(app)/projects/[projectId]/dashboard-client.tsx`

### F-14: Decision sourceRecordId field is unusable
- **Category:** Data entry friction
- **Severity:** 🟡 Medium
- **Impact:** The `sourceRecordId` field in decision create/edit dialogs expects a UUID but is presented as a plain text input with no picker, no autocomplete, and missing i18n labels. Users can't realistically type a UUID from memory. The field serves no purpose in its current form.
- **Suggested improvement:** Either (a) remove the field from dialogs entirely, or (b) replace with an entity picker dropdown that lists existing meetings/communications/documents from the same project.
- **Fix:** 🟡 Soon (Sprint 3)
- **Related:** `src/components/decisions/create-decision-dialog.tsx`, `src/components/decisions/edit-decision-dialog.tsx`

### F-15: AI opportunity — auto-suggest traceability links
- **Category:** AI opportunities
- **Severity:** 🟢 Low
- **Impact:** After creating a decision, the AI could suggest "This decision might be derived from Communication X" or "This decision lacks evidence — link Document Y?". Currently, all links must be manually created.
- **Suggested improvement:** After creating a decision, trigger an AI suggestion flow that scans recent communications and documents for potential traceability links. User reviews and approves.
- **Fix:** 🔵 Later (Sprint 5+)
- **Related:** AI service, traceability_links, decisions

### F-16: AI opportunity — auto-generate meeting summary
- **Category:** AI opportunities
- **Severity:** 🟢 Low
- **Impact:** Meeting notes are manually typed. AI could auto-summarize the notes, extract action items, and suggest decisions — similar to what already exists for communications.
- **Suggested improvement:** Extend the existing AI extraction flow to work on meeting notes, not just communications.
- **Fix:** 🔵 Later (Sprint 5+)
- **Related:** AI service, meetings

---

## Helpful Dashboard Insights (Positive Findings)

1. **Recent communications widget works well** — Shows source type badges, dates, and follow-up flags. Easy to see what happened.

2. **Decision impact areas are visible** — The `scope`/`communication`/`quality`/`budget` labels help quickly understand decision categories.

3. **Traceability health bar at 60%** — Immediately shows there's work to do. The progress bar is a strong visual cue.

4. **Stat cards are clickable** — Each stat card links to its list page, making navigation natural.

5. **Missing links widget identifies orphans** — Even though it needs severity tiers, it successfully surfaced 12 unlinked entities.

6. **Bilingual data works** — All i18n fields render correctly in both EN and ES. The i18n JSONB approach is validated.

---

## Sprint Backlog Recommendations

### Sprint 3 — Fix Now (Critical + High)
| # | Finding | Action |
|---|---------|--------|
| F-01 | Dead sidebar links | Remove or hide unimplemented nav items |
| F-02 | Missing i18n keys | Add sourceRecordId keys or remove the field |
| F-08 | React Hook violation | Fix useTranslations call in Create Project dialog |
| F-09 | Hardcoded locale strings | Replace ternaries with `t()` calls |
| F-04 | Decisions without evidence (data) | Create 7 missing evidence links |
| F-05 | Communications without links (data) | Create 3 missing communication links |

### Sprint 3-4 — Fix Soon (Medium)
| # | Finding | Action |
|---|---------|--------|
| F-03 | No Action Items UI | Create action-items page + dialogs |
| F-06 | Create Project missing dates | Add startDate/targetEndDate to Create dialog |
| F-07 | Create Project limited statuses | Show all 5 status options |
| F-13 | Missing links needs severity tiers | Redesign widget with priority levels |
| F-14 | sourceRecordId unusable | Remove field or add entity picker |

### Sprint 4+ — Later (Low)
| # | Finding | Action |
|---|---------|--------|
| F-10 | Stakeholder missing org/phone | Add fields to schema and dialog |
| F-11 | Meeting attendees free-text | Replace with stakeholder picker |
| F-12 | No meetings logged | Optional dogfooding data |
| F-15 | AI auto-suggest links | AI suggestion flow for links |
| F-16 | AI meeting summary | Extend AI extraction to meetings |