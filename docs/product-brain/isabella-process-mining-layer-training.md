# Isabella - Process Mining Layer training contract

> **Status:** Implemented in P2-T3.
> **Scope:** governed read-only interpretation of the Process Mining Layer.
> **Rule:** Isabella consumes truth; she never becomes a new owner of project facts.

## 1. Purpose

Isabella must interpret the Process Mining Layer with enough precision to answer three different
kinds of questions without mixing their sources:

1. **What is true in this project now?** Use deterministic, RBAC-scoped project reads and approved
   read-only projections over canonical tables and the Project Event Graph.
2. **How does this capability work?** Use the curated, bilingual Product Brain corpus retrieved by
   lexical and vector search.
3. **What am I looking at on this screen?** Use deterministic screen/program context derived from
   the implemented routes and components.

These sources complement one another. Product documentation cannot replace current project data,
screen layout cannot become business truth, and a raw database row or event payload must never be
sent to the model.

## 2. Source contract

### A. Deterministic project and event data

- Canonical owners remain the source of business state: `roadmap_tasks`, `milestones`, dependencies,
  and their approved resolvers.
- The Project Event Graph is read through an authenticated, organization-and-project-scoped
  projection. Isabella receives sanitized event summaries, integrity status, counts, timestamps and
  safe evidence references - never raw `payload` values.
- Task events use one case per task (`case_id = task_id`); milestone events use one case per
  milestone (`case_id = milestone_id`). Dependency events belong to the successor task case and
  preserve predecessor/relation object references.
- Milestone Process Flow is a deterministic, read-only derived engine. Its transitions and findings
  are evidence-backed intelligence, not a second event store.

### B. Vectorized Product Brain knowledge

- The Product Brain defines vocabulary, meaning, boundaries and verification paths.
- Curated bilingual packages are indexed through Knowledge OS lexical and vector retrieval.
- Product Brain answers how the system works; it does not supply live project counts, status, owners
  or dates.
- When the corpus does not define a behavior, Isabella states the gap rather than guessing.

### C. Screen and program context

- `src/lib/knowledge-os/screens.ts` maps implemented routes to the visible workflow and components.
- `src/lib/isabella/screen-help/screen-help.ts` gives deterministic explanations for the current
  Process Mining screen without a model or database call.
- The context covers Living Graph, Task cases, Process, Full audit, Milestone Flow, Variants,
  Statistical Root Cause and KPI views.
- Screen position, saved layout, visual proximity and synthetic presentation edges are never
  canonical evidence.

## 3. Reading the Process Mining Layer

| View | Meaning | Safe claim boundary |
|---|---|---|
| Task cases | One chronology per task case | Sequence is observed order, not cause |
| Process | Aggregated activities and directly-following connections | Coverage and frequency describe observation, not a mandated path |
| Full audit | Read-only canonical event projection | Only recorded `caused_by` is causal |
| Milestone Flow | Milestone-to-milestone transitions, segments and health | Delay/rework/bottleneck findings are derived and require corroboration |
| Variants | Groups cases by observed activity sequence | Outcome comparison requires sufficient outcome data |
| Root Cause Miner | Statistical associations with influence, lift, sample and confidence | Association is not confirmed causation |
| KPI | Catalog and sandboxed custom metrics over the approved dataset | Missing data is `not computable`, never a fabricated zero |

## 4. Integrity Isabella may report

The P2-T3 integrity report checks the complete project event window for organization/project
isolation, unique monotonic sequence, hash linkage, traceability, case framing and OCEL object
references. Mining categories are validated inside the complete canonical chain so unrelated event
categories may be legitimately interleaved without creating a false broken-chain warning.

Data-quality flags and truncation are disclosed as limitations. A valid chain proves ledger
continuity; it does not prove that temporal neighbors caused one another.

## 5. Response policy

- State whether a fact is **canonical**, **deterministically derived**, **statistical**, or
  **screen/product guidance**.
- Cite safe event, task, milestone or flow references when project-specific claims are made.
- Never expose raw event payloads, arbitrary SQL, secrets or cross-tenant records.
- Never convert a delay, rework pattern or bottleneck candidate into a confirmed root cause without
  corroborating evidence.
- Recommendations remain advisory, require human approval and are never auto-executed.

## 6. Verification

- Open a project -> Execution Map -> Living Graph and ask Isabella to explain the screen.
- Ask the difference between Task cases, Process and Full audit.
- Ask "¿Cuántos eventos canónicos, casos y transiciones tiene este proyecto?"; Isabella must answer
  from the direct aggregate source, report integrity and avoid RAG-generated counts.
- Ask what a Milestone Flow delay or bottleneck candidate proves; the answer must disclose that it is
  derived and not causal proof.
- Ask for current project attention; the direct source may include event-backed process findings and
  safe references, but no raw payload.
- Run the Product Brain corpus tests and the P2-T3 event-integrity suite.
