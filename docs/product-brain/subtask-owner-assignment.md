# Subtask Owner Assignment

**Regression ID:** `SUBTASK-OWNER-ASSIGNMENT-PERSISTENCE` · **Status:** protected

## Why this exists

When creating a subtask, the Owner dropdown showed **only "Unassigned"** — no
project team member could be selected. Execution accountability was impossible at
the subtask level.

## Root cause

The Task Execution Map page (`…/tasks/[taskId]/page.tsx`) built the assignable
`owners` list **exclusively from `project_team_members`** (filtered by
`project_id`). Projects that never explicitly added rows to `project_team_members`
(common — most projects rely on org membership) produced an **empty** list, so the
dropdown fell back to "Unassigned" only. The **normal task** assignee dropdown, by
contrast, sources people from `getTaskFormOptionsAction`, whose person list is the
org's **workspace users** (`profiles`, org-scoped) plus the project team — never
empty. The subtask page simply used a narrower source.

## Fix

A subtask **owner is a person** (an auth user / `profiles` id) — never an external
contact or stakeholder. So the owner source now mirrors the normal-task person
source:

- **`getAssignableProjectOwners(projectId)`** (`src/lib/people/service.ts`,
  server-only) returns the person-only assignable list = org **workspace users**
  (`profiles` scoped by `organization_id`) ∪ this project's **team members** that
  resolve to a real user (`project_team_members.user_id`, scoped by
  `organization_id` + `project_id`, `status != removed`).
- **`mergeAssignableOwners(...)`** (`src/lib/people/directory.ts`, PURE) merges the
  two sources, de-duplicates by the person's id (a profile name wins over a team
  name), keeps a nameless-but-valid person assignable under a short-id label
  (never silently dropped), excludes team rows with no `user_id` (role
  placeholders), and sorts case-insensitively by name.
- The page unions the assignable list with the **currently-assigned** owner ids so
  a subtask's real owner always appears even if that person later left the team.

Persistence, write-side RBAC, and display were already correct and are unchanged:
`owner_id` is validated by the subtask create/update schemas, written by
`createSubtaskAction`/`updateSubtaskAction` (which enforce `authorize(...)`), and
displayed in the Subtask Map node/card + detail panel via `ownerNames`.

## Data source

| Group | Table | Scope |
|---|---|---|
| Workspace users | `profiles` | `organization_id` (caller org) |
| Project team | `project_team_members` (with `user_id`) | `organization_id` + `project_id`, `status != removed` |

Owner name display resolves through `profiles` (org-scoped) as before.

## RBAC / project / org scope

- Org + role come from the **trusted session** (`getOrgContext`); the client
  projectId is only a lookup key.
- Profiles are **org-scoped** → users from another org never appear.
- Team members are **org + project-scoped** → no cross-project leakage.
- Assigning an owner still goes through the RBAC-guarded subtask update action
  (`authorize`), so an unauthorized assignment is denied server-side regardless of
  what the dropdown offered.

## Empty team behavior

With no explicit team rows the dropdown still lists the org's workspace users; with
no people at all it cleanly shows **"Unassigned" only** (the intentional
`unassignedLabel`, not an error).

## Known limitations

- The dropdown lists org workspace users (the existing normal-task convention), not
  a strictly project-membership-filtered set — consistent with normal tasks by
  design. A future project-scoped membership model would narrow both surfaces
  together.
- Owners are people only; assigning a subtask to a crew/vendor **resource** (as
  full tasks allow) is out of scope for this fix.
