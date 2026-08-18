# Friction Radar v1 — Aurora event taxonomy

Source: `public.project_event_log`, project `a40a7436-c63f-4e3b-94cd-041447ee54d4`, read on 2026-08-17 using `SELECT` only.

| Event type | Count | Friction meaning | Observed start? | Duration quality |
|---|---:|---|---|---|
| `TaskAssigned` | 274 | assignment context | no | imported time excluded |
| `TaskCreated` | 274 | lifecycle creation only | no | imported time excluded |
| `TaskDependencyAdded` | 155 | explicit dependency | no | imported time excluded |
| `TaskCompleted` | 54 | explicit completion / quality boundary | no by itself | direct time eligible only when operational dates agree |
| `TimeLogged` | 43 | historical effort event | only through current entry | event timestamp not used when current entry exists |
| `TimeEntryUpdated` | 17 | audit restatement | no | never summed as effort |
| `MilestoneCreated` | 16 | milestone creation | no | imported time excluded |
| `TaskStarted` | 8 | explicit work start | yes | direct time eligible |
| `ParentTaskProgressRecalculated` | 6 | derived parent projection | no | not lifecycle work evidence |
| `SubtaskCreated` | 4 | subtask context | no | not work evidence |
| `TaskImplemented` | 4 | forward lifecycle work | yes | direct time eligible |
| `MilestoneAchieved` | 3 | milestone completion | no | milestone evidence only |
| `TaskTested` | 3 | quality boundary | yes | direct time eligible |
| `SubtaskCompleted` | 2 | verified child work | yes | requires verified parent task mapping |
| `TaskStatusChanged` | 2 | explicit state transition | active target only | low-confidence mappings do not qualify durations |
| `MilestoneStarted` | 1 | milestone start | no | milestone evidence only |
| `SubtaskProgressChanged` | 1 | verified child work | yes | requires verified parent task mapping |
| `TaskMoved` | 1 | milestone/schedule context | no | not work start |
| `TaskReopened` | 1 | explicit rework/interruption | no | sequence remains valid even if elapsed time conflicts |

Rules enforced in code:

1. Missing `TaskStarted` never means waiting.
2. Current `subtask_time_entries.work_date` supersedes a stale `TimeLogged` payload.
3. `TimeEntryUpdated` restates an entry and never adds effort.
4. Imported/backfilled timestamps preserve sequence but do not prove business duration.
5. Missing Implemented/Tested events do not prove skipped workflow states because no mandatory project workflow is configured.
6. Backward transitions require explicit `from_state` and `to_state`.
7. Causality requires explicit `caused_by`; temporal proximity is not cause.
