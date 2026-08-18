# Friction Radar v1 — Aurora validation

Validation date: 2026-08-18

Project: `a40a7436-c63f-4e3b-94cd-041447ee54d4`

Supabase mode: metadata and `SELECT` only.

## Manual validation cases

| Task | Current facts | Event/work evidence | Engine result | Confidence |
|---|---|---|---|---|
| `b0ca5ded-efdc-455d-abf7-671eb3fd8670` | `status=done`, `is_blocked=true`, 8 planned and 8 logged hours | `TaskCompleted` `5c172027-1ca5-429b-b752-637cdee317e7` followed by `TaskReopened` `44909854-4a9a-44a3-b23a-45668abbcb91`, `done → blocked`; explicit resource-availability blocker | confirmed `completed_then_reopened`, `process_interruption`, and `resource_interruption`; snapshot/event inconsistency remains separate | high |
| `93dff1de-c356-403e-9701-a1d184d5105e` | `status=done`, 56 planned and 56 logged hours | no `TaskStarted`; current entries span 2026-02-12–2026-02-20; direct completion `ed21c0c3-038d-44c1-8f03-1a89a641864e` | observed start is 2026-02-12 from the current entry; no waiting/queue signal; event-to-entry duration is rejected because the clocks conflict | high |
| `dd29a954-0d12-4ee0-a750-b4a73c0cdb75` | `status=done`, 228 planned and 200 logged hours | current entries start on planned date 2026-01-12; direct Aug sequence `baec76b3… → 8ba9d373… → 4b3d3e49… → c6709a26…` | no queue signal; August capture interval is not accepted as execution duration because current operational work dates are Jan–Feb | high |
| `8f0f1e7e-a629-4be0-8abc-24bd1b6b2c2f` | `status=done`, 32 planned and 32 logged hours | current entries start on planned date 2026-02-25; direct start `ffa6eb3d-208f-4507-ac7b-3db1bbafe52d` and completion `2cd2c6a7-386d-401b-87ef-4ed2f17e39a4` are in August | no queue signal; active-cycle duration is `INSUFFICIENT_EVIDENCE` because the clocks conflict | high |
| `aa28bbb1-5e90-4210-adc1-eb6c05ad7957` | `status=done`, 28 planned and 28 logged hours | current entries start on planned date 2026-01-13; direct August start/implemented/completed sequence | no queue signal; capture-time duration rejected | high |
| `997c8d29-04de-4add-9620-764f6e71246a` | current `status=in_progress`, not blocked, 48 planned hours, no entries | direct start `4cffa807-36fa-4d8c-971e-c08b48e3d40d` on 2026-08-07; no completion | queue candidate versus planned date and stagnation candidate after seven days; never labelled waiting and never called completed/long-running | high for state/sequence; candidate for friction |

The resource blocker text is used to classify the interruption but is not copied
into the user-facing signal value. The signal keeps a traceable reference to
`roadmap_tasks.blocker_reason` to avoid propagating sensitive health detail.

## Other actual lifecycle findings

- `66fb0611-8e71-446b-90bc-7c9a1585fdd1` has direct event
  `01ab6a5b-582f-4262-b38d-4fe2674a668f`, an explicit
  `in_progress → not_started` transition. The engine reports one confirmed
  backward transition.
- Aurora has no task with more than one `TaskCompleted` event in the audited
  snapshot, so `repeated_completion` is implemented but not detected.
- Aurora has no demonstrated `TaskTested → rework` sequence in the audited
  snapshot, so `tested_to_rework` is implemented but not detected.

## Signal/data matrix after FR-01–FR-08

| Signal | Existing data / engine | Output | Category | Confidence | Gap |
|---|---|---|---|---|---|
| Queue friction | baseline start + qualified observed start | candidate or unknown/not detected per task | Process | high only from current entry or qualified direct event | planned dates have day granularity; same-day activity is treated as on time |
| Active cycle | qualified lifecycle boundaries + temporal consistency | task-level metric or `INSUFFICIENT_EVIDENCE` | Process | high only when clocks agree | no overrun signal until a comparable business-calendar baseline exists |
| Stagnation | active/blocked snapshot + last meaningful activity + analysis time | candidate after transparent seven-day threshold | Process | high when last activity is traceable | runtime result depends on analysis timestamp |
| Completed → reopened | explicit ordered events | confirmed signal | Quality | high | none for the validated Aurora case |
| Process interruption | reopened target is explicitly blocked | confirmed signal | Process | high | none for the validated Aurora case |
| Resource interruption | explicit blocker classification + task evidence reference | confirmed signal with sensitive text redacted | Resource | high | capacity/overload still unavailable |
| Backward transition | explicit `from_state` and `to_state` ranks | confirmed signal | Process | high/medium by provenance | unknown states are not ranked |
| Repeated completion | count of explicit completions | confirmed or not detected | Quality | high | no actual Aurora instance |
| Tested → rework | explicit tested event followed by explicit regression | confirmed or not detected | Quality | high | no actual Aurora instance |
| Skipped expected states | event sequence | `UNKNOWN` | Process | unknown | mandatory workflow policy is not configured |
| Dependency topology | 155 validated dependency rows | fan-in/out, lag, upstream incomplete, downstream impact | Dependency | high | wait duration and propagation score are not yet implemented |
| Effort variance | baseline hours + 43 current time entries | logged hours and variance by task | Cost | high for available entries | absence of entries is not proof of zero actual effort |
| Resource overload | assignments, profiles, allocations, workload snapshots and availability exceptions | `INSUFFICIENT_EVIDENCE` | Resource | unknown | all project capacity/workload sources are empty and 19 project users have no resource profiles |
| Schedule/critical exposure | task baselines + current dates + critical snapshot | task fields loaded | Schedule | high | schedule signal rules remain for the next block |
| Risk friction | 10 open project risks | source loaded, no task signal | Risk | medium at project level | no task or milestone links |
| Decision friction | decisions | `INSUFFICIENT_EVIDENCE` | Decision | unknown | Aurora has zero decision rows; approvals are not invented |
| Cost/EVM | budget, cost actuals, financial snapshots and financial cockpit | `INSUFFICIENT_EVIDENCE` | Cost | unknown | cockpit says `insufficient_inputs`; approved baseline, EAC, CPI and SPI are null |

## False positives prevented

1. `first_started_at IS NULL = WAITING` is prohibited and covered by a real-case regression test.
2. `Created → Started` capture latency is not queue time.
3. A same-day start is not late merely because the planned field is a date at midnight.
4. `TimeEntryUpdated` never adds a second effort contribution.
5. August lifecycle capture times are not mixed with Jan–Mar operational work dates.
6. Missing Implemented/Tested events do not prove that a required state was skipped.
7. Empty decision, cost, capacity, or issue sources do not become zero friction.

## Transparent signal-level scoring

No global or category score is produced in this block. Each emitted task signal
stores its independent 0–100 score in `metadata.signalScore` and its normalized
value in `magnitude`.

| Signal | Rule |
|---|---|
| Queue | after the full planned calendar day, 8 hours of additional delay = 25 points; linear to 100 |
| Stagnation | seven inactive days = 35 points; linear to 100 |
| Backward transition | 45 for the first explicit transition, +20 per additional transition, capped at 100 |
| Repeated completion | 60 for two explicit completions, +20 for each additional completion, capped at 100 |
| Tested → rework | 80 when the explicit sequence is present |
| Completed → reopened | 100 when the explicit sequence is present |
| Completed → blocked interruption | 100 when the explicit sequence is present |
| Resource interruption | 100 when current blocked state and an explicit resource-availability reason agree |

Active-cycle duration is retained as evidence but is not converted to an
overrun score: `duration_days` is a business-day measure, while event elapsed
time is wall-clock time. Comparing them would create an unsupported score.

## Block completion

| Task | Result |
|---|---|
| FR-01 | build/test baseline validated |
| FR-02 | production schema audit documented |
| FR-03 | actual Aurora event taxonomy encoded and documented |
| FR-04 | authenticated, RLS-scoped, read-only operational loader implemented |
| FR-05 | corrected task-level evidence dataset implemented |
| FR-06 | observed-start, temporal consistency, dependency/resource and lifecycle evidence implemented |
| FR-07 | deterministic cross-engine merge/deduplication implemented |
| FR-08 | initial queue, stagnation, rework, interruption, regression and backward-transition detectors implemented |

## FR-09–FR-16 continuation

The dependency, schedule, effort/cost, resource, risk and decision detectors,
the blocking evidence contract, independent score field, deterministic Top 20
and non-binding category aggregation proposal are implemented and validated.
See [`FR-09-16_IMPLEMENTATION.md`](FR-09-16_IMPLEMENTATION.md) for the frozen
task contract, rules, actual Aurora outputs, Top 20 and remaining gaps.
