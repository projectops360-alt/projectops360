# QA Checklist — Sprint 11: AI-Assisted Execution Controls

**Fecha:** 2026-06-08  
**Ambiente:** Local dev (localhost:3000) + Supabase  
**Organización:** ProjectOps360  
**Proyecto:** ProjectOps360 Degree

---

## 4.1 — AI-Assisted Task Execution Statuses

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1 | Create a new task, open status dropdown | 9 statuses visible: not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred | ✅ |
| 2 | Set task status to `prompt_ready` | Badge shows purple with FileText icon | ✅ |
| 3 | Set task status to `sent_to_ai` | Badge shows indigo with Send icon | ✅ |
| 4 | Set task status to `implemented` | Badge shows cyan with Code icon | ✅ |
| 5 | Set task status to `tested` | Badge shows emerald with ShieldCheck icon | ✅ |
| 6 | Set task to `blocked` | Badge shows red with Ban icon | ✅ |
| 7 | Progress calculation | Only `done` tasks count toward completion % | ✅ |
| 8 | Build passes | `npx next build` completes without errors | ✅ |

## 4.2 — Prompt Storage Fields

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 9 | Edit task, expand AI Prompt section | Collapsible section with Sparkles icon | ✅ |
| 10 | Fill prompt_body (textarea, monospace) | Text saves and displays correctly | ✅ |
| 11 | Select ai_tool_target (claude/codex/copilot/cursor/other) | Value persists on save | ✅ |
| 12 | Fill prompt_context, implementation_notes, test_notes | All fields save correctly | ✅ |
| 13 | New task form has prompt fields | Collapsible AI Prompt section present | ✅ |

## 4.3 — Copy-Prompt Action

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 14 | Task with prompt_body shows purple prompt card | Card displays with Sparkles header, Copy Prompt button | ✅ |
| 15 | Click "Copy Prompt" | Prompt text copied to clipboard, "Copied!" feedback | ✅ |
| 16 | Task status `prompt_ready` shows "Copy & mark sent" button | Purple button visible only when status is prompt_ready | ✅ |
| 17 | Click "Copy & mark sent" | Status changes from prompt_ready to sent_to_ai, last_prompt_sent_at updated | ✅ |
| 18 | Secrets warning visible | "Never include secrets..." amber warning in prompt card | ✅ |
| 19 | prompt_context and last_prompt_sent_at display | Show in footer of prompt card when present | ✅ |

## 4.4 — Execution Status Filters

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 20 | Quick filter "Prompt Ready" button visible | Purple button with count, clickable | ✅ |
| 21 | Quick filter "Blocked" button visible | Red button with count, clickable | ✅ |
| 22 | All 9 status pills show counts | Each pill shows task count | ✅ |
| 23 | Click status pill filters correctly | Only tasks with that status shown | ✅ |
| 24 | Click "All" resets filter | All tasks shown again | ✅ |
| 25 | Blocked task has red left border | Visual emphasis on blocked tasks | ✅ |
| 26 | Prompt_ready task has purple left border | Visual emphasis on prompt-ready tasks | ✅ |

## 4.5 — Recommended Next Step

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 27 | Next step panel visible on roadmap page | Shows recommendation above view toggle | ✅ |
| 28 | Blocked P1 task → "Resolve blocker" | Red card with Ban icon, task title, reason | ✅ |
| 29 | prompt_ready task → "Run prompt" | Purple card with FileText icon, "Copy & mark sent" button | ✅ |
| 30 | sent_to_ai task → "Implement output" | Indigo card with Send icon | ✅ |
| 31 | implemented task → "Test implementation" | Cyan card with Code icon | ✅ |
| 32 | tested task → "Mark completed" | Emerald card with ShieldCheck, "Mark completed" button | ✅ |
| 33 | All done → "Roadmap is on track" | Green card with CheckCircle2 | ✅ |
| 34 | "View task" button scrolls to task | Click scrolls task into view, highlights with ring | ✅ |

## 4.6 — Dependency Visibility

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 35 | Task with dependency_notes "Depends on 3.1" shows warning | Amber AlertCircle badge with count | ✅ |
| 36 | Dependency list shows ref, title, status | Each dep shows icon + ref + title + Done/Pending badge | ✅ |
| 37 | Completed dependency shows "Done" green badge | Matches if status is done/tested | ✅ |
| 38 | Incomplete dependency shows status badge | Uses current status badge colors | ✅ |
| 39 | Task without dependency_notes shows nothing | No warning, no dependency section | ✅ |

## 4.7 — Gantt / Timeline View

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 40 | "Gantt" tab visible in view toggle | Calendar icon + "Gantt" / "Cronograma" | ✅ |
| 41 | Click Gantt tab shows schedule view | Milestone bars across date range | ✅ |
| 42 | Month headers display correctly | Short month + year labels | ✅ |
| 43 | Today marker (red line) shows | Red vertical line at current date | ✅ |
| 44 | Tasks shown as dots under milestones | Colored dots at milestone position | ✅ |
| 45 | No-date milestones show empty message | Calendar icon + "Add dates to milestones" message | ✅ |
| 46 | Status colors match other views | Same color scheme as task list | ✅ |

## 4.8 — Task Status Audit Trail

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 47 | Change task status from not_started → in_progress | Audit record created with action `task_status_changed` | ✅ |
| 48 | Change task status to `blocked` | Audit record with action `task_blocked` | ✅ |
| 49 | Change task status to `done` | Audit record with action `task_completed` | ✅ |
| 50 | Change from `blocked` → `in_progress` | Audit record with action `task_unblocked` | ✅ |
| 51 | Copy prompt → `prompt_copied` audit | Audit record with action `prompt_copied` | ✅ |
| 52 | Copy & mark sent → `prompt_sent_to_ai` audit | Audit record with action `prompt_sent_to_ai` | ✅ |
| 53 | Audit trail visible in task detail | Expandable "Audit trail" section with History icon | ✅ |
| 54 | Audit entries show date + action + status transition | "Jun 8 · Status changed · in_progress → blocked" | ✅ |
| 55 | No secrets in audit metadata | prompt_body not stored in audit metadata | ✅ |

## 4.9 — Execution Dashboard

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 56 | Dashboard visible above view toggle | "Execution status" heading with 7 cards | ✅ |
| 57 | Each status card shows correct count | Blocked, Prompt Ready, Sent to AI, etc. | ✅ |
| 58 | Sprint indicator shows current sprint | "Sprint: Sprint 11" badge | ✅ |
| 59 | Blocked alert bar shows when blocked > 0 | Red bar with "2 blocked tasks" + "View blocked" link | ✅ |
| 60 | Click on status card filters task list | Switches to Tasks view with that status filter | ✅ |
| 61 | i18n works in both locales | Labels in English and Spanish | ✅ |
| 62 | Build passes | `npx next build` completes without errors | ✅ |

## Cross-Project Isolation

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 63 | Log in as different org user | No Sprint 11 tasks visible | ✅ (RLS scoped by organization_id) |
| 64 | Audit logs scoped to org | No cross-org audit entries visible | ✅ (RLS on audit_logs) |

---

## Results Summary

| Category | Tests | Pass | Fail |
|----------|-------|------|------|
| 4.1 AI Statuses | 8 | 8 | 0 |
| 4.2 Prompt Fields | 5 | 5 | 0 |
| 4.3 Copy-Prompt | 6 | 6 | 0 |
| 4.4 Status Filters | 6 | 6 | 0 |
| 4.5 Next Step | 8 | 8 | 0 |
| 4.6 Dependencies | 5 | 5 | 0 |
| 4.7 Gantt | 7 | 7 | 0 |
| 4.8 Audit Trail | 9 | 9 | 0 |
| 4.9 Dashboard | 7 | 7 | 0 |
| Cross-Project | 2 | 2 | 0 |
| **Total** | **63** | **63** | **0** |

## Bugs / Improvements

No bugs found. All features working as specified.

## Workflow Validation: prompt_ready → done

1. ✅ Set task 4.3 to `prompt_ready` → Badge turns purple, Next Step shows "Run prompt"
2. ✅ Click "Copy & mark sent" → Status changes to `sent_to_ai`, audit logged as `prompt_sent_to_ai`
3. ✅ Set task 4.3 to `implemented` → Badge turns cyan, Next Step updates to "Test implementation"
4. ✅ Set task 4.3 to `tested` → Badge turns emerald, Next Step shows "Mark completed"
5. ✅ Set task 4.3 to `done` → Badge turns green, progress updates
6. ✅ Audit trail shows: prompt_copied → prompt_sent_to_ai → task_status_changed (implemented) → task_status_changed (tested) → task_completed
7. ✅ Blocked task (set 4.8 to blocked) → Red left border, blocked alert in dashboard, Next Step shows "Resolve blocker"
8. ✅ No cross-project data visible — RLS properly scoped