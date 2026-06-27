# 01 — Product Vision

## One sentence

**ProjectOps360° is an AI-first Project Execution Operating System** that turns the
scattered reality of a project — tasks, people, resources, capacity, risks, decisions,
documents, drawings, meetings, and money — into a single, living, explainable model that
a project leader can understand and act on, with an AI workforce (Isabella) that explains
*why* and recommends *what next*.

## What it is NOT

- It is **not** a task manager. (See [`ADR-001`](adrs/ADR-001-ai-first-execution-os.md).)
- The Living Graph is **not** a decorative visualization. (See [`ADR-002`](adrs/ADR-002-living-graph-primary-surface.md).)
- It is **not** a thin GPT wrapper. The AI is grounded in a curated knowledge substrate
  and the project's real execution data.

## Who it is for

Project Managers, PMOs, and execution leaders across domains that share the same execution
DNA but use different vocabulary:
- **Construction / data centers** (crews, trades, drawings, RFIs, submittals, permits)
- **Software / digital delivery** (sprints, backlog, story points)
- **Generic project delivery** (predictive, agile, hybrid)

The **Universal Execution Model** (migration `20260708`) is what lets one engine serve all
of them: a missing API key and a missing HVAC unit are both "material" blockers; an
unstaffed task is an "assignment" blocker.

## The core promise

> Every state shown to the user must accurately represent reality and be **explainable by
> Isabella using deterministic business rules.** ProjectOps360° must think like a real
> Project Management Operating System, not a task manager.

## Why a Product Brain exists

The product has accumulated powerful concepts faster than they could be consolidated.
Important ideas (Resource Capacity Intelligence, the Living Graph as the primary surface,
the Execution Status Engine, the distinction between Blocked vs Waiting-on-Dependency)
have been **lost or overwritten** across branches and AI-assisted refactors — most
concretely when work on `feat/rythm` never reached `master`
(see [10-regression-log.md](10-regression-log.md), `REG-004`/`REG-005`).

The Product Brain is the cure: a durable, versioned source of truth that survives any
single conversation, branch, or model.
