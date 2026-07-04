# Isabella Evidence Contract

**Regression ID:** `ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT` · Phase 5 · Task 1

Companion to [`isabella-process-intelligence-architecture.md`](isabella-process-intelligence-architecture.md).
Defines the one shape future engines exchange and the rules that keep Isabella's
claims honest.

## 1. Evidence packet contract

`IsabellaEvidencePacket` (`process-intelligence/types.ts`) is a **pre-sanitized,
LLM-safe projection** — never a raw DB row or realtime payload. Built ONLY by an
approved server-side retrieval layer (Task 2) after RBAC checks.

Fields: `evidenceId`, `evidenceType`, `sourceKind`, `sourceId` (display-safe),
`projectId`, `organizationId`, `title`, `summary`, `citationLabel`, `citationRef?`,
`occurredAt?`, `updatedAt?`, `confidence`, `visibility` (`project`/`org`/
`restricted`), `claimSupport?`, `allowedClaims?`, `disallowedClaims?`,
`limitations?`.

`evidenceType ∈` task · subtask · milestone · dependency · blocker · risk ·
decision · approval · event_summary · living_graph_node · living_graph_edge ·
milestone_flow_segment · delay_finding · rework_finding · bottleneck_finding ·
status_report · project_memory.

## 2. Claim support rules

`canEvidenceSupportClaim(claimType, packets)` returns `ok` only when there are at
least `minEvidence` packets that (a) are **not** hard-forbidden for the claim, (b)
have an accepted `evidenceType`, and (c) meet `minConfidence`.

| Claim | Any-of evidence | Min | Min confidence | Inference? |
|---|---|---|---|---|
| `factual_project_data` | task/subtask/milestone/status_report | 1 | verified | no |
| `status_summary` | task/subtask/milestone/living_graph_node/status_report | 1 | high | no |
| `dependency_claim` | **dependency / living_graph_edge** | 1 | high | no |
| `blocker_claim` | blocker/dependency/risk/decision | 1 | high | no |
| `risk_claim` | risk/delay_finding/bottleneck_finding | 1 | medium | no |
| `root_cause_claim` | delay/rework/bottleneck/segment/blocker/dependency/event | **2** | medium | **yes** |
| `recommendation_claim` | delay/rework/bottleneck/blocker/risk/segment/status_report | 1 | medium | **yes** |
| `assumption_or_inference` | many | 1 | low | **yes** |

## 3. Allowed / disallowed claims

A packet may carry `disallowedClaims` — a **hard** block that wins over
evidenceType. The canonical case: `makeSyntheticMilestoneChainEvidence(...)`
builds a `living_graph_edge` packet with
`disallowedClaims: ["dependency_claim", "blocker_claim"]`, so a presentation-only
`milestone_chain` sequencing edge (order_index) can **never** back a dependency or
blocker claim — mirroring `LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY`.

`root_cause_claim` must distinguish **confirmed / likely / possible** cause and is
always labeled an inference.

## 4. Citation examples

- Task: sourceLabel "Workboard task status", entityType `task`, entityTitle "Zoning review".
- Milestone: entityType `milestone`, entityTitle "Phase 5 — Isabella Process Intelligence".
- Flow finding: sourceLabel "Milestone Process Flow finding: decision delay", entityType `delay_finding`.
- Graph: sourceLabel "Living Graph node", entityType `living_graph_node`.

Never expose raw DB ids (unless an existing UI convention makes them safe) or JSON.

## 5. Safety / privacy notes

- Evidence packets are **pre-sanitized**: no raw payloads, no secrets, no
  cross-tenant fields; `visibility` never widens beyond the caller.
- Retrieval is server-side authorized (`resolveIsabellaAccess`, deny-by-default);
  denials never disclose whether an entity exists.
- The contract is **read-only**: it never mutates canonical truth,
  `project_event_log`, `process_nodes`, or `process_edges`, and imports no DB
  client (enforced by an import-boundary test).
