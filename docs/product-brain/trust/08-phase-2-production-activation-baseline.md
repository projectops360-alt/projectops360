# EKI Macrophase 4 — Production Baseline and Migration Review

**Phase 2 · Macrophase 4 · Hardening and controlled activation**
**Date:** 2026-07-27 · **Status:** **BLOCKED before production DDL** — see §4
**Base:** `origin/master` @ `8b02788` (PRs #215, #216, #217 merged)

This records §1 (pre-activation baseline) and §2 (migration review) of Macrophase
4, both completed. It also records the blocker that stopped the sequence before
§3 (production migration), and the two pre-flight findings that came out of the
baseline.

Nothing was applied to production. Production remains exactly as measured below.

---

## 1 — Production baseline

Measured directly against `ocopmlnkvidvmxgiwvxw` on 2026-07-27, read-only. Not
inferred from migration files.

| Measure | Value |
|---|---|
| Migrations recorded | 111 |
| Latest recorded migration | `20260859000000` |
| Knowledge objects | 5 |
| Knowledge versions | 5 |
| Knowledge evidence rows | 210 |
| Knowledge transitions | 5 |
| `platform_governance_audit` rows | **0** |
| Organizations | 76 |
| Active projects | 132 |
| `audit_logs` rows | 1 700 |
| Tables with RLS enabled | **161** |
| Tables with RLS disabled | **0** |
| RLS policies | 584 |
| `SECURITY DEFINER` functions | 41 |
| …of those without a fixed `search_path` | **0** |
| Views | 7 |
| EKI tables | 0 |
| EKI functions | 0 |

Feature flags in production (`vercel env ls production`): none of
`EKI_AUTOMATED_EVALUATION_ENABLED`, `EKI_TRUST_REASONING_ENABLED` or
`LIVING_GRAPH_TRUST_LENS_ENABLED` is set. All three therefore read as **OFF**,
which is their default.

Scheduled jobs: `vercel.json` declares one cron, `/api/eki/evaluate` at
`0 3 * * *`. It is deployed but inert — the endpoint answers 404 while
`EKI_AUTOMATED_EVALUATION_ENABLED` is unset.

No secrets, tokens or customer payloads were captured.

---

## 2 — Pre-flight findings

Two things the brief's premise did not account for. Both were found by measuring
rather than assuming.

### Finding 1 — the migration tracker disagrees with the schema

Production records `20260859000000` as its latest migration, but objects from
later migrations already exist:

| Object | From migration | Present in production? |
|---|---|---|
| `project_import_entities.source_order` | `20260860000000` | **yes** |
| `pmo_simulation_scenarios`, `pmo_simulation_runs` | `20260862000000` | **yes** |
| `project_knowledge_objects.scope_type` | `20260863000000` | no |
| `project_knowledge_objects.owner_user_id` | `20260863000000` | no |
| `project_knowledge_objects.project_id` nullable | `20260863000000` | no (still `NOT NULL`) |
| `project_knowledge_relations` | `20260863000000` | no |

So some changes reached production outside `supabase_migrations.schema_migrations`
— most likely applied through the SQL editor. **The tracker cannot be used to
decide what is applied**, which matters because the standard safety argument for a
migration set is "the tracker says which ones ran".

EKI itself is genuinely absent, and I verified its preconditions individually
rather than trusting the version number. They match what `20260863000000`
expects.

### Finding 2 — the view recreate will narrow grants

`project_knowledge_object_current` currently holds, in production:

```
anon:          INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
authenticated: INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
```

These are Supabase's default grants on objects in `public`. Migration
`20260863000000` drops and recreates the view (REG-027) and regrants only
`select` to `authenticated`.

The net effect is a **narrowing**: `anon` loses all access, `authenticated` keeps
only `SELECT`. That is the correct end state — the view is read-only in practice,
the knowledge-layer repository only ever calls `.select()` on it, and the
underlying tables are RLS-protected so the write grants conferred nothing. But it
is a real production behaviour change and must be recorded as an *expected*
difference in the post-migration integrity comparison, not discovered there.

---

## 3 — Migration review

Six migrations, `20260863000000` … `20260868000000`, 2 785 lines.

| Check | Result |
|---|---|
| Ordering | Correct; each depends only on earlier ones |
| Destructive table replacement | **None** — no `drop table`, no `truncate` |
| Unintended data deletion | **None**. The only `delete from` is inside `eki_resolve_finding`, removing the open-findings row on resolution — intended lifecycle, not DDL |
| Column type changes | **None** |
| View handling | One `drop view if exists` + recreate + regrant (REG-027) |
| Constraint drops | All `if exists`, or replacing a named constraint that is immediately re-added |
| Index creation | 12 indexes, none `CONCURRENTLY` |
| Lock duration risk | **Negligible.** Every altered table is tiny: `project_knowledge_objects` has 5 rows, the child tables at most 210; all EKI tables are created empty |
| Fixed `search_path` | Every `SECURITY DEFINER` function sets it (verified in stage: 0 without) |
| Public execution on privileged functions | Revoked — REG-036, `20260868000000` |
| Cross-tenant exposure | Verified closed in stage after REG-036 |
| Constraint validation order | `20260863000000` adds constraints **before** relaxing `NOT NULL`, so the state ADR-013 rejects is never representable |

### Idempotency is uneven, and that governs the failure strategy

| Migration | `if not exists` | `if exists` |
|---|---|---|
| `20260863000000` | 2 | 2 |
| `20260864000000` | **0** | **0** |
| `20260865000000` | 0 | 1 |
| `20260866000000` | 17 | 2 |
| `20260867000000` | 0 | 1 |
| `20260868000000` | 0 | 0 |

`20260864000000` and `20260865000000` create tables and triggers
unconditionally. **They are not safely re-runnable.** A failure part-way through
the set therefore requires a *forward fix*, not a retry — re-running would abort
on the first `create table` that already exists.

That is acceptable, but it has to be the stated strategy before the set is
applied rather than discovered during an incident.

---

## 4 — Blocker: production DDL was not applied

**Status: STOPPED before §3 of the brief. Production is untouched.**

### What the blocker is

The only sanctioned route to production DDL available in this environment is the
Supabase MCP `apply_migration` tool, which takes SQL **as a parameter**. Applying
this set that way means re-emitting 2 785 lines of SQL by hand into tool calls.

That is not equivalent to applying the files, and the difference is not
theoretical:

> When `20260866000000` was applied to **stage** earlier in this programme, it was
> sent in four hand-assembled chunks. What ran and what the file said then
> disagreed — the claim function's table alias and a `returning` column label
> differed — and the repository file had to be reconciled to the database
> afterwards with a script.

On stage that was recoverable and was caught. Doing the same at four times the
volume against a live 76-tenant production database means **what runs in
production may not be what CI tested**, with no tracker to detect it — and
Finding 1 shows this project's tracker is already unreliable.

Combined with the fact that `20260864000000` and `20260865000000` cannot be
re-run, a mid-set divergence would leave production in a state that needs manual
forward-fixing under time pressure.

### What I did not do, and why

I probed for `psql` and a direct connection string so the **files themselves**
could be applied. That was correctly denied: hunting for production credentials
is not what was authorized, and a near-identical attempt had already been
rejected earlier in this programme. I did not attempt to work around it.

### What would unblock it

Any one of these, in preference order:

1. **Apply the files through the Supabase CLI** — `supabase link` + `supabase db push` against production, run by an operator. This applies the repository files byte-for-byte and records them in the tracker. It is the only option that makes "what ran" provably equal "what CI tested".
2. **Apply the files through the Supabase dashboard SQL editor**, one file at a time, pasting file contents. Same byte-for-byte property, no tracker entry (which is how the existing drift arose).
3. **Explicit authorization for a direct database connection** from this session, so the files can be applied with `psql -f`. This needs a deliberate decision about handing production credentials to an agent session; I am not assuming it.

Option 1 is the right one. It is also a single command per environment and leaves the tracker correct for the first time in this project.

---

## 5 — What remains for Macrophase 4

Everything from §3 of the brief onward is untouched and unclaimed:

- Production migration and post-migration verification
- Production security probes
- Data-integrity comparison against the baseline above
- Staged flag activation (Stages B–F)
- Scheduler validation in production
- Performance measurement
- Failure and recovery tests in production
- Observability and alerting
- Production acceptance flow
- Final flag state
- Phase 2 closure document

The baseline in §1 is the fixed reference point for the integrity comparison when
the set is applied. It should be re-measured immediately before application, since
production is live and the counts will have moved.

---

## Scope confirmation

No additional controls, resolvers, dashboards, trust scores or framework packages
were added. No frozen architecture, strategy or Charter document was modified. No
production data was read outside aggregate counts, and no secrets, tokens or
customer payloads were captured.

---

## 6 — Deployment attempt via Supabase CLI (2026-07-27)

Authorized method: Supabase CLI from this repository, linked to production.
**No DDL was executed. `supabase db push` refused to run.**

### Steps completed

| Step | Result |
|---|---|
| Repository / branch | `C:\p360-pmo-process-intelligence-redesign`, `feat/eki-macrophase-4` @ `35f626e`, working tree clean |
| CLI version | `2.109.1` |
| `supabase link --project-ref ocopmlnkvidvmxgiwvxw` | success |
| `supabase/.temp/project-ref` | `ocopmlnkvidvmxgiwvxw` — **verified, correct target** |
| `supabase migration list --linked` | captured |
| `supabase db push --linked --include-all --dry-run` | **exit 1 — refused** |
| `supabase db push --linked --dry-run` | **exit 1 — refused, identically** |

### Why the push is refused

```
Remote migration versions not found in local migrations directory.
```

Production's migration history contains **64 entries with no corresponding file
in this repository**. They are the Studio-applied migrations visible by their
timestamp format (`20260614012842`, `20260625020613`, …) plus `20260851000000`
and `20260851010000`.

The CLI reconciles local and remote history before pushing anything, and refuses
while they disagree. It never reaches the question of which migrations to apply,
so the dry run produced **no migration list at all** — with or without
`--include-all`.

This is a pre-existing condition of the production project. Macrophase 4 did not
create it, and no EKI migration is involved.

### The two remedies the CLI offers are both out of bounds

1. **`supabase migration repair --status reverted <64 versions>`**
   This marks 64 migrations that **are applied in production** as reverted. It
   writes a false statement into the production history to make a tool proceed.
   The brief forbids `migration repair` except where a migration was
   demonstrably applied but its entry was not recorded — this is the inverse
   case, and the inverse remedy.

2. **`supabase db pull`**
   This regenerates local migration files from production's current schema. It
   would rewrite a large part of `supabase/migrations/` with content unrelated to
   EKI, which the brief excludes as unrelated scope.

### Correction to an earlier assessment

In §4 I said `--include-all` mattered and later warned it might re-run ~40
already-applied migrations. Both points are now moot and one was wrong:

- The CLI never evaluates the migration set, so the flag makes no difference here.
- `20260860`, `20260861` and `20260862` are genuinely idempotent
  (`drop constraint if exists`, `create table if not exists`), so they would not
  have blocked a push. That earlier concern was unfounded.

The real obstacle is history reconciliation, which neither dry run could get past.

### What would unblock it, in preference order

1. **Add placeholder migration files for the 64 orphan versions** — one inert
   file per version, named for it, recording that the change was applied through
   the Studio and has no reproducible source. Local and remote history then agree,
   `db push` applies exactly `20260860` … `20260868`, and the repository stops
   claiming a history it does not have. Honest, reversible, and it fixes the
   underlying condition rather than working around it.
2. **`supabase db pull` on a dedicated branch**, reviewed as its own change,
   before Macrophase 4 resumes. Larger, but it makes the repository the true
   record of production for the first time.
3. **Direct connection (`psql -f`)** applying the nine files byte-for-byte, then
   recording history entries. Needs a deliberate decision about production
   database credentials in an agent session.

Option 1 is the smallest honest change and the only one that stays inside
Macrophase 4's scope. It is still a decision about production history and is not
taken here.

### Production state

Unchanged and re-verified after the attempt: 111 migrations recorded, latest
`20260859000000`, 0 EKI tables, 0 EKI functions, 5 knowledge objects, 210
evidence rows, 76 organizations. No DDL ran.

---

## 7 — Placeholders created; a second history layer found (2026-07-27)

### Done: 64 inert placeholder migrations

One file per orphan version, `<version>_applied_outside_repository.sql`,
comment-only, no SQL. Each records that production's history holds the version,
that the change was applied through the Studio, and that its content is not
recoverable here — and warns against ever adding SQL to it, since editing it
would silently change the meaning of a version production already considers
applied.

**Effect: the history-reconciliation error is gone.** `db push` no longer fails
with "Remote migration versions not found in local migrations directory".

### Found: a second layer, underneath the first

With reconciliation passing, `db push` reveals the inverse problem:

```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
<50 files>
```

**50 local migrations have no remote history entry**, spanning `20260628000000`
to `20260846010000` — project memory, Rhythm Center, charter, delivery framework,
billing and teams, Scribe, RBAC, resource capacity, Knowledge OS, admin console,
attachments, GitHub Intelligence, process mining. All are live features.

Above `20260859000000` the pending set is **exactly** the nine reviewed files,
`20260860000000` … `20260868000000`. Confirmed programmatically.

**`--include-all` must not be used.** It is the flag that pulls those 50 into the
push, and 13 of them are not safely re-runnable:

| Migration | Why it cannot re-run |
|---|---|
| `20260628000000` | `create table` / `create index` without `IF NOT EXISTS`, `create trigger` without a drop |
| `20260714`, `20260716`, `20260717`, `20260720`, `20260721`, `20260725`, `20260814` | `create trigger` without a drop |
| `20260830`, `20260840`, `20260843` | `create policy` and `create trigger` without drops |
| `20260834`, `20260844` | `create policy` without a drop |

### All 50 demonstrably ran — measured, not assumed

Every migration with a checkable object was probed against production. **35 of 36
present.** The 14 without a probe are knowledge-seed migrations that insert rows
`ON CONFLICT DO NOTHING`.

### The one exception, and why it is not what it looks like

`20260725000000_rythm_meeting_intelligence.sql` creates four tables. In
production:

| Object | Present |
|---|---|
| `project_rythm_meetings` | **no** |
| `project_rythm_audio_files` | yes — 2 rows |
| `project_rythm_transcripts` | yes — 2 rows |
| `project_rythm_processing_jobs` | yes — 2 rows |
| `meeting-audio` storage bucket | yes |

At first reading this says the migration never ran, which would make "repair as
applied" a false statement. It is not what happened. The three child tables carry
foreign keys to **`meetings(id)`**, not to `project_rythm_meetings` — the Rythm
module was reimplemented against the pre-existing `meetings` table. The migration
ran; the parent table was dropped afterwards or never required.

So `applied` is a true statement about **history**, which is what a migration
tracker records. The absent table is separate pre-existing drift in an unrelated
module, with nothing depending on it. **Recorded here, not fixed** — it is outside
EKI scope.

### Blocked: `migration repair` was not run

`supabase migration repair --status applied <50 versions>` was refused as an
unauthorized production mutation. That is the correct call: the authorization
covered creating placeholder files, and rewriting production migration history is
a distinct decision.

It is also the remedy the brief explicitly permits — "a migration was demonstrably
applied successfully but its history entry was not recorded" — and the measured
state above is the documentation it requires. It needs explicit approval.

### Remaining sequence, once approved

```
supabase migration repair --status applied <the 50 versions>
supabase db push --linked          # NOT --include-all
```

The second command then applies exactly `20260860000000` … `20260868000000`.

Production remains unchanged: 111 migrations recorded, latest `20260859000000`,
0 EKI tables, 0 EKI functions, 5 knowledge objects, 210 evidence rows, 76
organizations. No DDL has run.
