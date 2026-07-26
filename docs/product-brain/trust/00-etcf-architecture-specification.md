# Enterprise Trust & Compliance Framework (ETCF)

**Architecture & Governance Specification · v1.0**
**Status:** Draft for executive review · **Date:** 2026-07-26
**Classification:** Internal — shareable with prospective enterprise customers under NDA
**Scope:** Architecture and governance only. No code, no schema, no implementation.

---

## Reading note on evidence

Every quantitative claim in Sections 2 and 3 was **measured against the live
production database and the committed source tree**, not inferred from design
documents or migration files.

This matters. A first-pass static reading of the migration history produced the
finding *"58 tenant-scoped tables have no RLS."* Queried directly, production
returns **155 of 155 multi-tenant tables with RLS enabled and 0 without**. The
static reading had failed to correlate later hardening migrations with the
tables they retro-fitted.

That error is instructive and is why the methodology is stated up front: an
assessment that cannot be re-run is an opinion. Each figure below is
reproducible with a single query, and the ETCF's first structural commitment is
that **compliance posture must be queryable, not asserted**.

---

# 1. Executive Summary

## 1.1 Why this framework exists

ProjectOps360 sells into an enterprise buying centre where the security review
arrives before the product evaluation. Today the platform can pass a technical
review on its merits — the controls are unusually strong for a product at this
stage — but it cannot *demonstrate* that quickly, because the evidence lives in
the database rather than in a form an auditor accepts.

The gap is not security. The gap is **provability**.

ETCF closes it by treating compliance as a projection over facts the platform
already produces, rather than as a parallel body of work that has to be
maintained alongside the product.

## 1.2 The strategic insight

ProjectOps360 is already an event-sourced system with an append-only, hash-chained
event log, a closed event vocabulary of 100+ types, and — critically — a
**retention classification already attached to every event type**
(`OPERATIONAL | AUDIT | COMPLIANCE | LEARNING | EPHEMERAL_EXCLUDED`).

Most SaaS companies approaching SOC 2 must build an evidence pipeline from
nothing. ProjectOps360 must **connect one that already exists**. The event spine
built for Process Intelligence is, structurally, an audit evidence engine that
happens to be pointed at project execution.

This is the single highest-leverage fact in this document. It converts a
12–18 month compliance programme into a 6–9 month one, and it means the
compliance capability improves as the product improves rather than competing
with it.

## 1.3 Business value

| Outcome | Mechanism |
|---|---|
| **Shorter enterprise sales cycles** | A Trust Centre and a completed SOC 2 Type II report remove the two longest-pole items in security review — typically 6–14 weeks each |
| **Access to regulated buyers** | Construction, energy, healthcare and public-sector programme offices frequently cannot contract without an attestation, regardless of product fit |
| **Higher contract value** | Compliance posture is a recognised gate for enterprise-tier pricing, not merely a cost |
| **Lower deal risk** | Security questionnaires answered from a live control inventory rather than reconstructed per deal |
| **Valuation** | Diligence-ready governance materially reduces the discount applied for "compliance debt" in fundraising and M&A |

## 1.4 Competitive positioning

Category incumbents treat compliance as a document set maintained beside the
product. ProjectOps360 can make a stronger and genuinely defensible claim:

> *The same evidence engine that shows you why your project slipped shows your
> auditor why your controls held.*

That is not a marketing line — it is a consequence of the event architecture.
The Living Graph, Process Intelligence and the compliance posture read the same
canonical event log. A competitor without event sourcing cannot make this claim
without rebuilding their platform.

## 1.5 Roadmap in one line

**Foundation** (governance spine wired) → **Evidence** (automated collection) →
**Assessment** (readiness) → **Observation window** (Type II) → **Framework
extension** (ISO 27001, NIST CSF). Detail in Section 10.

---

# 2. Current Architecture Assessment

## 2.1 Measured posture

| Dimension | Measured value | Interpretation |
|---|---|---|
| Tables in `public` | 161 | — |
| Multi-tenant tables (carry `organization_id` or `project_id`) | 155 | — |
| **With RLS enabled** | **155 (100%)** | Strong. No unguarded tenant table |
| With RLS enabled but zero policies | 0 | No accidental lockout or silent bypass |
| Total RLS policies | 584 | — |
| Policies anchored to a tenant predicate | 346 | `is_org_member` / `can_access_project` / `is_platform_admin` / `auth.uid()` |
| `service_role` escape-hatch policies | 132 | Expected: server-side jobs |
| **Permissive `USING (true)` policies** | **2** | `plans`, `plan_entitlements` — the global plan catalogue |
| `SECURITY DEFINER` functions | 41 | — |
| **…without `SET search_path`** | **0** | Excellent. This is the classic privilege-escalation vector and it is fully closed |
| Events in `project_event_log` | 1,133 | Live and accumulating |
| Rows in `audit_logs` | 1,658 | Live |
| **Rows in `platform_governance_audit`** | **0** | **Built and never wired** — see 2.4 |

## 2.2 Strengths — verified, not claimed

**Tenancy isolation is layered, and each layer is independently sufficient.**
Application code derives `organization_id` exclusively from the session
(`getOrgContext`); no server action accepts a caller-supplied tenant id. RLS
enforces the same boundary again in the database. Several modules add a third
layer — database triggers that reject a cross-organization reference outright.
The PMO simulation guard was verified *functionally* in production during this
assessment: an attempt to scope a scenario to a foreign project was rejected by
the database.

**`SECURITY DEFINER` hygiene is complete.** All 41 definer functions pin
`search_path`. This is the most commonly missed Postgres hardening step and the
most commonly exploited; finding zero exceptions across 98 migrations indicates
a deliberate standard rather than luck.

**Immutability is enforced by the database, not by convention.**
`project_event_log` and `platform_governance_audit` carry triggers that raise on
UPDATE and DELETE. Corrections are expressed as compensating events. This is the
property auditors probe hardest and it is already structural.

**Tamper-evidence exists.** Both audit structures carry hash-chain columns
(`previous_event_hash` / `record_hash`), with a chain-validation routine that
detects sequence gaps, broken linkage and cross-organization chain violations.

**Secrets never reach the client.** Public and server-only environment variables
are separated with validation on both sides; 35 modules carry `server-only`
guards; the service-role key is confined to one module. The Isabella voice
endpoint mints a short-lived client secret and provably never returns the
long-lived provider key.

**Encryption of integration credentials is real.** GitHub App secrets use
AES-256-GCM envelope encryption with a versioned prefix, random IV per operation
and fail-closed decryption — not base64 wearing the word "encrypted".

**The event vocabulary is closed and classified.** Event types are registered,
not free-form, and each carries importance, retention class, lifecycle class and
required payload keys. HIGH/CRITICAL events require evidence.

## 2.3 Weaknesses

| # | Weakness | Evidence |
|---|---|---|
| W1 | **No MFA.** Authentication is single-factor (password + email verification) | No MFA/TOTP/WebAuthn implementation exists |
| W2 | **Authentication events produce no durable record.** Login, logout, failed attempts, password reset and session revocation are delegated to the identity provider and never mirrored into an application-owned store | The auth actions call the provider directly with no audit call |
| W3 | **Data exports are unaudited.** Report, budget, charter and closeout exports — including the simulation export added this week — leave no record of who exported what | No export path invokes the audit helper |
| W4 | **Hard deletes are unaudited.** Soft deletes are captured; permanent deletions (e.g. import rollback) are not | Rollback deletes execute with no audit call |
| W5 | **Permission changes record the result, not the transition.** A role change stores the new value without the previous one | No before/after delta in audit metadata |
| W6 | **No SAST, dependency scanning, secret scanning or licence checking in CI** | CI runs typecheck, tests and build only |
| W7 | **One dependency is installed from a vendor CDN rather than the registry** (`xlsx`) | Supply-chain provenance weaker for that package |
| W8 | **One webhook authenticates by shared-secret string comparison** rather than HMAC with timing-safe comparison, unlike the GitHub webhook which does it correctly | Inconsistent standard across two endpoints |
| W9 | **No documented key rotation.** Envelope encryption supports rotation structurally; no process, key versioning or rotation runbook exists | — |
| W10 | **No formal data retention or deletion policy.** Retention *classes* exist in the event registry; no enforcement, TTL or subject-erasure path | Required for GDPR Art. 17 and SOC 2 confidentiality criteria |
| W11 | **No centralised error tracking or metrics backend.** Diagnostics are prefixed console output captured by the hosting platform | No APM integration |
| W12 | **Two hardcoded administrative identities** remain as anti-lockout fallbacks, including a personal email address | Acceptable for the current stage; not acceptable at attestation |

## 2.4 The most consequential finding

**`platform_governance_audit` has 0 rows.**

The table exists. It has a constrained event vocabulary, actor typing, decision
recording, reason codes, evidence references, a hash chain, immutability
triggers, and a CHECK constraint that *prevents secrets or transcripts from ever
being written into its metadata*. A chain-validation function exists. It is, on
inspection, the best-designed control surface in the platform.

Nothing writes to it.

This is not a criticism of the design — it is the highest-leverage finding in
the assessment. The most expensive part of an evidence framework is deciding
what a trustworthy record looks like and enforcing it. That work is done. What
remains is instrumentation.

It also names the failure mode this platform has demonstrated repeatedly at a
smaller scale: **capability built, path from the surface never connected**. The
regression log records the same shape three times (REG-024, REG-025). ETCF must
treat *wired and producing records* as the definition of done for every control,
never *implemented*.

## 2.5 Component-level notes

| Component | Compliance-relevant posture |
|---|---|
| **Living Graph** | Read-only projection over canonical tables. Saved layouts are presentation-only and provably never mutate operational data. Low compliance risk; useful as an *evidence visualisation* surface |
| **Process Intelligence / Event Log** | The evidence spine. Append-only, hash-chained, immutable, classified by retention. Highest strategic value to ETCF |
| **Knowledge Engine** | Vector corpus with curated packages. Needs a data-classification decision: what may enter the corpus, and whether customer content is ever embedded |
| **Snapshots / Bindings** | Deterministic projections. Reproducibility is itself an audit property — a snapshot can be recomputed and compared |
| **RBAC** | Four roles (`owner`, `admin`, `member`, `viewer`) plus a separate platform-admin plane with table-driven grants. Route gates and action gates are correctly independent |
| **RLS** | 100% coverage of tenant tables. Two documented permissive exceptions on the global plan catalogue |
| **Isabella AI** | Runs are recorded to `ai_runs` on a best-effort basis with redacted payloads; the voice bridge re-derives identity from the session rather than trusting the request. **Gap:** no durable link from an AI-derived entity back to the specific run that produced it |
| **Decision Intelligence / Provenance** | A provenance service already traces AI-derived entities to their source and flags traceability gaps. Strong foundation for AI governance evidence |
| **Risk Engine** | Risk lifecycle events are captured atomically with idempotency fingerprints and hash chaining — the strongest domain in the event model |

---

# 3. SOC 2 Readiness Assessment

Assessed against the AICPA Trust Services Criteria. **Status** reflects measured
reality, not intent.

## 3.1 Security (Common Criteria) — the mandatory category

| Ref | Control area | Status | Missing | Priority | Complexity | Risk |
|---|---|---|---|---|---|---|
| CC1 | Control environment, org structure, accountability | ✗ Absent | Security policy set, defined ownership, workforce agreements | **P0** | Low | High |
| CC2 | Communication of objectives and responsibilities | ✗ Absent | Internal policy communication, external Trust Centre | P1 | Low | Medium |
| CC3 | Risk assessment process | ◐ Partial | Product risk engine exists; **no enterprise risk register or annual assessment** | **P0** | Low | High |
| CC4 | Monitoring of controls | ✗ Absent | Control testing cadence, deficiency tracking | P1 | Medium | High |
| CC5 | Control activities | ◐ Partial | Technical controls strong; not mapped to stated objectives | P1 | Low | Medium |
| CC6.1 | Logical access — authorization | ● Strong | — | — | — | Low |
| CC6.2 | Registration and credential issuance | ◐ Partial | **MFA absent**; no access-review cadence | **P0** | Medium | **High** |
| CC6.3 | Access modification and removal | ◐ Partial | Changes audited without before/after state; no periodic recertification | P1 | Low | High |
| CC6.6 | Boundary protection | ● Strong | Security headers, private buckets, path-scoped storage RLS | — | Low | Low |
| CC6.7 | Transmission and disposal of data | ◐ Partial | TLS in transit; **no disposal/retention policy** | P1 | Medium | Medium |
| CC6.8 | Malicious software / unauthorized code | ◐ Partial | **No SAST, dependency or secret scanning**; one CDN dependency | **P0** | Low | High |
| CC7.1 | Infrastructure vulnerability detection | ✗ Absent | Vulnerability management process and SLA | **P0** | Low | High |
| CC7.2 | Anomaly monitoring | ✗ Absent | No security monitoring, alerting or SIEM | **P0** | Medium | **High** |
| CC7.3 | Incident evaluation | ✗ Absent | Incident response plan, severity model | **P0** | Low | **High** |
| CC7.4 | Incident response | ✗ Absent | Runbooks, comms plan, breach notification path | **P0** | Medium | **High** |
| CC7.5 | Recovery from incidents | ✗ Absent | Tested recovery procedures | P1 | Medium | High |
| CC8.1 | Change management | ◐ Partial | **CI gate + branch protection + PR review are real and enforced**; not documented as a control, no emergency-change path | P1 | Low | Medium |
| CC9.1 | Business disruption mitigation | ✗ Absent | BCP, RTO/RPO targets | P1 | Medium | High |
| CC9.2 | Vendor management | ✗ Absent | Subprocessor inventory, vendor risk reviews, DPAs | **P0** | Low | High |

**Security verdict:** the *technical* controls are materially ahead of the
*organizational* ones. Every P0 above except MFA and scanning is a governance
artefact rather than an engineering effort — which is favourable, because those
are the fastest to close.

## 3.2 Availability

| Control area | Status | Missing | Priority | Complexity | Risk |
|---|---|---|---|---|---|
| Capacity monitoring | ✗ Absent | Utilisation baselines and thresholds | P2 | Medium | Medium |
| Backup | ◐ Inherited | Provider-managed backups **never restore-tested by us** | **P0** | Low | **High** |
| Disaster recovery | ✗ Absent | RTO/RPO definition, DR runbook, annual test | P1 | Medium | High |
| Availability monitoring | ✗ Absent | Uptime measurement, status page, alerting | P1 | Low | Medium |
| SLA commitments | ✗ Absent | Published targets | P2 | Low | Low |

**An untested backup is a hypothesis.** This is the single cheapest high-value
control in the entire programme.

## 3.3 Processing Integrity

| Control area | Status | Notes |
|---|---|---|
| Input validation | ● Strong | Zod schemas, typed contracts, defensive parsers that drop rather than coerce |
| Processing accuracy | ● **Exceptional** | Pure deterministic engines; 3,147 executable tests; guard-named regressions that fail the build if a behaviour returns |
| Completeness and provenance | ● Strong | Every derived figure states its provenance; unknowable values render "Data unavailable" and never zero |
| Error handling | ◐ Partial | Structurally sound; **no centralised error aggregation** |
| Output accuracy | ● Strong | Exports preserve provenance and never emit an empty cell for a missing value |

**This is the platform's strongest category and its most defensible market
claim.** The engineering discipline already in place — determinism, unit
separation, provenance on every number, refusal to fabricate a value — maps
almost one-to-one onto Processing Integrity. Most SaaS vendors decline this
category because they cannot evidence it. ProjectOps360 should **elect it
deliberately** and use it as a differentiator.

## 3.4 Confidentiality

| Control area | Status | Missing | Priority |
|---|---|---|---|
| Data classification | ◐ Partial | Sensitivity model exists in the governance layer; **not applied to the data estate** | P1 |
| Encryption at rest | ◐ Partial | Provider-level; envelope encryption for integration secrets; **PII columns unencrypted at column level** | P1 |
| Encryption in transit | ● Strong | TLS throughout | — |
| Access restriction | ● Strong | RLS + RBAC + tenant derivation from session | — |
| **Disposal** | ✗ Absent | No retention enforcement, no hard-delete path, no erasure workflow | **P0** |
| Confidentiality commitments | ✗ Absent | DPA template, subprocessor list, customer-facing commitments | **P0** |

## 3.5 Privacy

| Control area | Status | Priority |
|---|---|---|
| Notice and consent | ✗ Absent | P1 |
| Choice and collection limitation | ✗ Absent | P2 |
| **Data subject access / erasure** | ✗ Absent | **P0 if GDPR is in scope** |
| Retention and disposal | ✗ Absent | **P0** |
| Third-party disclosure | ✗ Absent | P1 |

**Recommendation:** exclude Privacy from the initial Type II scope. Include
**Security, Availability, Processing Integrity and Confidentiality**. Privacy
requires operational processes (subject requests, consent management) that do not
yet exist, and its inclusion would delay attestation by two quarters for limited
commercial return at this stage. Add it in the second observation window.

---

# 4. Security Architecture

## 4.1 Identity management

Design targets, expressed as properties the architecture must hold:

- **One identity per human, one lifecycle.** Provisioning, modification and
  deprovisioning are auditable events with before/after state.
- **Enterprise identity federation** (SAML 2.0 / OIDC) with SCIM provisioning.
  This is a *sales* requirement as much as a security one: above a certain
  contract size, "does it federate with our IdP" is a gating question.
- **Separation of the tenant plane from the platform plane.** Platform
  administration must never be reachable by escalating a tenant role. This
  property already holds; it must be documented and tested, and the hardcoded
  anti-lockout identities must be replaced by a break-glass procedure with
  time-boxed credentials and mandatory post-use review.

## 4.2 Authentication

- **MFA required for privileged roles** (`owner`, `admin`, platform admin) and
  available to all users; TOTP first, WebAuthn/passkeys second.
- **Every authentication event becomes a durable record** — success, failure,
  MFA challenge, password reset, session revocation. This is Weakness W2 and is
  the largest single evidence gap.
- **Credential policy** stated explicitly: minimum length, breach-corpus
  checking, no forced rotation absent evidence of compromise (aligned with
  NIST SP 800-63B rather than legacy rotation habits).
- **Rate limiting and lockout** on authentication endpoints, with the decision
  recorded rather than silently applied.

## 4.3 Authorization and least privilege

The existing model is sound. ETCF formalises it:

- **Deny by default.** Already the pattern in the permission modules; state it as
  a platform standard and test it per module.
- **Route gates and action gates remain independent.** A server action reachable
  from a client bundle is a second door into the same data. This is already
  honoured and must be an explicit, tested standard.
- **Periodic access recertification.** Quarterly review of platform admins and
  organization owners, recorded as governance events.
- **Purpose binding for privileged reads.** The governance layer already models
  `purpose` and rejects access without one — wire it (Section 8).

## 4.4 Secrets and key management

- **Inventory every secret**: name, owner, storage location, rotation interval,
  blast radius on compromise.
- **Key versioning.** Envelope encryption already carries a version prefix; add
  a key id so that rotation can proceed without a rewrite of stored ciphertext.
- **Rotation runbooks** per secret class, with rotation itself producing a
  governance event.
- **Move toward a managed KMS** for the master key rather than an environment
  variable. Envelope encryption makes this a substitution, not a redesign.

## 4.5 Encryption

- In transit: TLS 1.2+ everywhere, HSTS.
- At rest: provider-level for the estate; **column-level for identified
  sensitive fields** once the data classification exists (billing contact,
  transcript payloads, integration credentials — the last already done).
- **Classification must precede encryption.** Encrypting without a
  classification produces cost without a defensible statement about coverage.

## 4.6 Session management

Explicit lifetime, idle timeout, absolute timeout, revocation on credential
change and privilege change, and enumerable active sessions per user. Each
lifecycle transition is an evidence event.

## 4.7 API security

- **One authentication standard per endpoint class.** Webhooks verify HMAC
  signatures with timing-safe comparison — the GitHub webhook already does this
  correctly and is the reference implementation; the drawings webhook must be
  brought to it (W8).
- Request size limits, content-type enforcement and schema validation are
  already present and become stated standards.
- Rate limiting per principal.

## 4.8 Supply chain

- **Dependency scanning in CI with a documented severity threshold and SLA.**
- **Secret scanning** on push and in history.
- **SAST** on pull requests.
- **Provenance for every dependency.** The CDN-sourced package (W7) must either
  move to the registry with an integrity hash or be recorded as an accepted
  exception with a documented compensating control.
- **SBOM generation per release**, retained as evidence.
- Build integrity: the CI gate (typecheck → tests → build, no deploy step) is
  already a genuine control. Document it as one, including branch protection
  configuration, which currently exists only as an assumption in a comment.

---

# 5. Governance Architecture

## 5.1 The document hierarchy

```
Policy      — what we commit to, and why          (executive-approved, annual review)
  └─ Standard  — the specific rule that satisfies it   (architecture-owned)
      └─ Procedure — how it is executed                (team-owned, versioned)
          └─ Control   — the testable assertion            (mapped to evidence)
              └─ Evidence  — the artefact that proves it       (automated)
```

Only the top layer needs executive sign-off. Everything below is maintained by
the teams that operate it. A policy set that requires executive review to change
a procedure will be abandoned within two quarters.

## 5.2 Minimum policy set

Information Security · Access Control · Change Management · Incident Response ·
Business Continuity & DR · Data Classification & Handling · Data Retention &
Disposal · Vendor & Subprocessor Management · Secure Development · Acceptable Use ·
Risk Management · **AI Governance** (see 5.7).

## 5.3 Control framework

Controls are **framework-neutral internally** and mapped outward. The control is
"privileged access requires MFA"; SOC 2 CC6.2, ISO 27001 A.5.17 and NIST
PR.AA-03 are *mappings*, not separate controls. This is what makes Section 7
possible without re-architecting.

Each control carries: id, statement, owner, frequency, automation status,
evidence query, framework mappings, and current state.

## 5.4 Risk register

An enterprise risk register distinct from the product's project-risk feature.
Fields: risk, category, inherent likelihood/impact, existing controls, residual
rating, owner, treatment (accept / mitigate / transfer / avoid), review date.

Accepted risks require named executive acceptance with an expiry — an acceptance
without an expiry is an abandonment.

## 5.5 Exception process

Every exception: requester, justification, scope, compensating control, expiry,
approver. **Exceptions expire by default.** The two permissive RLS policies on
the plan catalogue are the first entries — they appear correct (a global product
catalogue is intentionally readable) but "appears correct" is not a control
statement; they need a recorded decision.

## 5.6 Change, vendor and asset management

- **Change:** the PR + CI + branch-protection path is the control. Document it,
  define the emergency path, and require post-hoc review for emergency changes.
- **Vendor:** inventory every subprocessor (hosting, database/auth, AI providers,
  transcription, email, analytics) with data categories, region, DPA status and
  review date. **This is a P0 — it is also a GDPR Art. 28 obligation and the
  first thing an enterprise buyer's counsel asks for.**
- **Asset:** environments, domains, repositories, storage buckets, service
  accounts, keys — each with an owner.

## 5.7 AI governance — the differentiating chapter

Standard frameworks have little to say here yet; enterprise buyers ask anyway,
and increasingly it is the *hardest* question in the review. ProjectOps360 can
answer it better than almost anyone because the properties already hold:

- **AI never mutates without human approval.** Already modelled in the
  governance layer's denial reasons (`ai_mutation_forbidden`,
  `human_approval_required`).
- **AI never sees raw payloads it should not.** Already modelled
  (`ai_raw_payload_forbidden`).
- **Every AI-derived entity is traceable to its source and its approver.** A
  provenance service already does this and flags gaps rather than inferring.
- **AI answers are grounded and refuse rather than fabricate.** This is an
  engineering norm throughout the product and is testable.
- **Model and prompt versions are recorded** with each run.

Formalising this into an AI Governance Policy is low cost and high differentiation:
it is defensible because it is already true, and it will be a contract
requirement across the industry within 18 months.

---

# 6. Operational Security

## 6.1 Incident response

Severity model (SEV1–SEV4) with explicit criteria; declared roles (incident
commander, communications, scribe); breach-notification decision tree with
regulatory clocks (GDPR 72 hours); mandatory blameless post-incident review with
tracked corrective actions.

**Every incident produces a governance event.** Incident records are themselves
audit evidence.

## 6.2 Business continuity and disaster recovery

Define **RTO and RPO explicitly** — the absence of a stated target is itself the
finding. Document dependency failure modes (hosting, database/auth, AI providers)
and the degraded-mode behaviour for each. **Test recovery annually and retain the
test as evidence.**

## 6.3 Backup

Provider-managed backups are inherited, not owned. ETCF requires: documented
schedule and retention, **restore testing on a fixed cadence with recorded
outcome**, and a stated position on cross-region durability.

## 6.4 Monitoring, alerting and logging

- **Centralised structured logging** with correlation ids. Today's prefixed
  console output is serviceable for debugging and insufficient for evidence.
- **Security-relevant alerting**: repeated authentication failure, privilege
  escalation, cross-tenant access denial, anomalous export volume, RLS policy
  change, admin access outside business hours.
- **Log retention** meeting the audit window (12 months, 3 months hot).
- Separate **application logs** (debugging, short retention) from **audit
  records** (evidence, long retention, immutable). Conflating them makes the
  second unusable.

## 6.5 Threat detection and security reviews

Threat models per trust boundary — tenant isolation, AI data access, integration
ingress, storage access, admin plane. Annual penetration test with tracked
remediation. Architecture review as a gate for changes crossing a trust boundary.

---

# 7. Compliance Engine

## 7.1 Principle

**One control inventory, many framework projections.**

A control is authored once against the platform's own risk model. Framework
alignment is expressed as mappings. Adding ISO 27001 becomes an exercise in
mapping and gap-filling, not re-implementation.

This mirrors the architectural principle the product already follows: compose
one source of truth and project it, rather than maintaining parallel truths that
drift.

## 7.2 Conceptual model

```
Framework ──< Requirement ──< ControlMapping >── Control ──< EvidenceBinding >── EvidenceSource
                                                    │
                                                    └──< Assessment ──< Finding ──< Remediation
```

| Concept | Purpose |
|---|---|
| **Framework** | SOC 2, ISO 27001, NIST CSF, CIS, GDPR, HIPAA — versioned |
| **Requirement** | A single criterion within a framework |
| **Control** | Our own testable assertion. Framework-neutral |
| **ControlMapping** | Requirement ↔ Control, with coverage strength (full / partial / compensating) |
| **EvidenceBinding** | How a control is proven: a query, an event type, an artefact, or an attestation |
| **Assessment** | A point-in-time evaluation producing findings |
| **Finding** | A gap, with severity, owner and due date |

## 7.3 Evidence sufficiency

Every binding declares its **strength**, because auditors weigh evidence
differently and the distinction should be explicit rather than discovered during
fieldwork:

| Strength | Nature | Example |
|---|---|---|
| **Automated-continuous** | System-generated, tamper-evident | Immutable access-decision events |
| **Automated-periodic** | Generated on a schedule | Weekly access review export |
| **Artefact** | A document under version control | Approved policy |
| **Attestation** | A human assertion | Annual DR test sign-off |

Prefer automated-continuous. It is the only class that survives an observation
window without operational effort — and effort that must be sustained for twelve
months is effort that will lapse in month four.

## 7.4 Framework extension without re-architecture

| Framework | Additional need beyond SOC 2 |
|---|---|
| **ISO 27001** | ISMS scope, Statement of Applicability, management review, internal audit programme |
| **NIST CSF 2.0** | Govern function mapping; profile definition |
| **CIS Controls** | Implementation-group selection; configuration baselines |
| **GDPR** | Lawful basis, DPIA, subject-rights workflows, transfer mechanisms, subprocessor register |
| **HIPAA** | BAAs, PHI classification, minimum-necessary enforcement — only if healthcare is pursued; it changes the data model's obligations |

---

# 8. Evidence Collection Framework

## 8.1 The three tiers

**Tier 1 — Canonical events.** Extend the existing event registry with a
`governance` category. Governance events flow through the same append-only,
hash-chained, retention-classified spine the product already runs. **This is the
core architectural decision of ETCF: do not build a second evidence pipeline.**

**Tier 2 — Derived attestations.** Scheduled projections over Tier 1 — access
review reports, control coverage summaries, exception expiry reports.

**Tier 3 — Artefacts.** Policies, test results, penetration test reports,
vendor assessments. Version-controlled, ownership-tracked, review-dated.

## 8.2 Required evidence events

Ordered by the size of the gap they close.

| Domain | Events | Current state |
|---|---|---|
| **Authentication** | login success/failure, MFA challenge/result, password reset, session created/revoked, lockout | **None captured (W2)** |
| **Authorization** | access allowed/denied with purpose and reason codes | Modelled, **not wired** (2.4) |
| **Privilege** | role granted/revoked/changed **with before and after**, platform admin granted/revoked, access review completed | Partial; no delta (W5) |
| **Data lifecycle** | export requested/completed, hard delete, retention purge, subject erasure | **None captured (W3, W4)** |
| **Configuration** | feature flag changed, plan entitlement changed, policy changed, RLS policy changed | Partial, no delta |
| **Change** | PR merged, CI result, deployment, emergency change, rollback | External to the platform |
| **AI** | run executed, tool invoked, recommendation generated, human approved/rejected, override recorded | Partial; **no entity → run link** |
| **Vendor** | subprocessor added, reviewed, removed | None |
| **Incident** | declared, escalated, contained, resolved, post-review completed | None |
| **Continuity** | backup completed, restore tested, DR exercise completed | None |

## 8.3 Non-negotiable properties

1. **Evidence collection never blocks the operation it observes.** Audit failure
   must not fail a user action — but a failure to record must itself be alerted,
   or the control silently degrades to nothing.
2. **Evidence never contains what it is protecting.** The governance audit's
   existing CHECK constraint rejecting tokens, passwords, payloads and
   transcripts is the correct pattern and should be the platform standard.
3. **Evidence is immutable and chained.** Already true where implemented.
4. **Evidence is tenant-scoped**, with a platform-plane view for operators.
5. **A control with no evidence binding is not a control.** It is an intention.

## 8.4 Definition of done for a control

Given Section 2.4 — a perfectly designed audit surface with zero rows — the
programme adopts one rule:

> A control is complete when a query returns its evidence.
> Not when the table exists. Not when the function is written.
> When the rows are there.

---

# 9. Enterprise Trust Dashboard

Capabilities only, as specified. No screen design.

## 9.1 Capabilities

| Capability | Question answered | Source |
|---|---|---|
| **Compliance score** | How ready are we, per framework? | Control coverage × evidence completeness |
| **Security score** | How strong is the technical posture? | Measured control state |
| **Risk score** | What is our residual risk? | Risk register, weighted |
| **Audit readiness** | Could we start fieldwork today? | Evidence completeness across the observation window |
| **Control coverage** | Which requirements have no control? | Framework mapping gaps |
| **Evidence completeness** | Which controls have no proof? | Binding freshness and continuity |
| **Open findings** | What is broken, who owns it, when is it due? | Findings with ageing |
| **Critical risks** | What needs executive attention? | Residual rating above threshold |
| **Policy status** | What is approved, current, overdue for review? | Artefact metadata |

## 9.2 Design principles

**Scores must be explainable and decomposable.** A compliance score that cannot
be opened to the specific unmet control is a vanity metric. This mirrors the
product's own standard: every number states its provenance.

**Missing evidence reads "not collected", never zero.** The same rule the
simulation module enforces — an absent value is not a low value. A control with
no evidence must be visibly distinct from a control that failed.

**Gaps are as prominent as strengths.** A trust dashboard that only shows green
is a liability in an audit.

**Trend matters more than level.** Type II attests to operation *over time*.

**Two audiences, one substrate.** Internal (full detail, findings, owners) and
external (Trust Centre — posture, certifications, subprocessors, no findings).

---

# 10. Architecture Roadmap

Complexity is engineering effort. Enterprise value is commercial impact. Risk
reduction is exposure removed.

### M1 — Governance Foundation

**Objectives:** establish the control environment that every other milestone
depends on.
**Dependencies:** executive sponsorship, named security owner.
**Deliverables:** policy set (12 policies), control inventory with SOC 2
mappings, enterprise risk register, exception process, subprocessor inventory,
data classification.
**Complexity:** Low (documentation) · **Value:** High · **Risk reduction:** High
*Closes: CC1, CC2, CC3, CC9.2 — the largest cluster of P0 gaps, at the lowest
engineering cost.*

### M2 — Evidence Spine

**Objectives:** wire `platform_governance_audit` and extend the event registry
with the governance category.
**Dependencies:** M1 (controls must exist before evidence can bind to them).
**Deliverables:** governance events flowing for authorization decisions, privilege
changes with before/after state, exports, hard deletes and configuration changes;
evidence binding model; chain validation running continuously.
**Complexity:** Medium · **Value:** Very High · **Risk reduction:** Very High
*This is the milestone that converts a well-built platform into a provable one.*

### M3 — Identity Hardening

**Objectives:** close the authentication gaps.
**Dependencies:** M2 (so that authentication events land somewhere durable).
**Deliverables:** MFA for privileged roles, authentication event capture, session
lifecycle events, rate limiting and lockout, break-glass procedure replacing
hardcoded identities, quarterly access recertification.
**Complexity:** Medium · **Value:** High · **Risk reduction:** Very High
*Closes CC6.2, the highest-risk technical gap.*

### M4 — Supply Chain & Change Assurance

**Objectives:** make the build pipeline an evidenced control.
**Dependencies:** none — can run parallel to M2/M3.
**Deliverables:** dependency, secret and static analysis scanning in CI with
thresholds and SLAs; SBOM per release; CDN dependency resolved or excepted;
webhook authentication standardised on HMAC; branch protection documented as
configuration.
**Complexity:** Low · **Value:** Medium · **Risk reduction:** High
*Closes CC6.8, CC7.1, CC8.1. The lowest-effort milestone in the programme.*

### M5 — Operational Resilience

**Objectives:** be able to respond and recover, and prove both.
**Dependencies:** M1.
**Deliverables:** incident response plan with severity model and runbooks; BCP
with stated RTO/RPO; **restore testing with recorded outcomes**; centralised
structured logging with correlation ids; security alerting.
**Complexity:** Medium · **Value:** High · **Risk reduction:** Very High
*Closes CC7.2–7.5, CC9.1, and the entire Availability category.*

### M6 — Data Lifecycle & Confidentiality

**Objectives:** state and enforce what happens to data over time.
**Dependencies:** M1 (classification), M2 (evidence).
**Deliverables:** retention schedule per class with enforcement; deletion and
erasure workflows; column-level encryption for classified fields; key rotation
runbooks and key versioning; DPA template and customer commitments.
**Complexity:** Medium–High · **Value:** High · **Risk reduction:** High
*Closes the Confidentiality category and prepares GDPR.*

### M7 — Trust Dashboard & Readiness Assessment

**Objectives:** know the answer before the auditor asks.
**Dependencies:** M1–M6.
**Deliverables:** internal trust dashboard; gap assessment against SOC 2;
remediation plan; auditor selection; external Trust Centre.
**Complexity:** Medium · **Value:** Very High · **Risk reduction:** Medium

### M8 — Type I, then the Type II observation window

**Objectives:** attestation.
**Dependencies:** M1–M7.
**Deliverables:** Type I report (design of controls at a point in time), then a
6–12 month observation window, then Type II (operating effectiveness).
**Complexity:** Low engineering, high operational discipline · **Value:** Very High

**Type I is worth taking first.** It is achievable months earlier, unblocks a
meaningful share of enterprise deals on its own, and de-risks the Type II window
by exposing design flaws before the clock starts.

### M9 — Framework Extension

ISO 27001 and NIST CSF via mapping and gap-filling. Complexity is low **only
because** M1–M8 built framework-neutral controls. Had controls been authored
against SOC 2 language directly, this milestone would be a rewrite.

---

# 11. Documentation Structure

Proposed layout inside the Product Brain. The Product Brain is already the
governing source of truth and overrides chat and prompts (ADR-007); ETCF inherits
that authority rather than creating a parallel one.

```
docs/product-brain/trust/
├── 00-etcf-architecture-specification.md   ← this document
├── README.md                                  entry point, ownership, review cadence
│
├── policies/                                  WHAT we commit to (executive-approved)
│   ├── POL-001-information-security.md
│   ├── POL-002-access-control.md
│   ├── POL-003-change-management.md
│   ├── POL-004-incident-response.md
│   ├── POL-005-business-continuity.md
│   ├── POL-006-data-classification.md
│   ├── POL-007-data-retention-and-disposal.md
│   ├── POL-008-vendor-management.md
│   ├── POL-009-secure-development.md
│   ├── POL-010-acceptable-use.md
│   ├── POL-011-risk-management.md
│   └── POL-012-ai-governance.md
│
├── standards/                                 THE RULE that satisfies a policy
│   ├── STD-001-authentication.md
│   ├── STD-002-encryption.md
│   ├── STD-003-logging-and-monitoring.md
│   ├── STD-004-api-security.md
│   ├── STD-005-secrets-and-key-management.md
│   └── STD-006-tenant-isolation.md
│
├── controls/                                  THE TESTABLE ASSERTION
│   ├── control-inventory.md                   the single register
│   ├── mappings/
│   │   ├── soc2-trust-services-criteria.md
│   │   ├── iso-27001-annex-a.md
│   │   ├── nist-csf-2.0.md
│   │   └── gdpr-articles.md
│   └── evidence-bindings.md                   control → how it is proven
│
├── architecture/
│   ├── ARCH-001-trust-boundaries.md
│   ├── ARCH-002-identity-architecture.md
│   ├── ARCH-003-evidence-pipeline.md
│   ├── ARCH-004-compliance-engine.md
│   └── ARCH-005-data-flow-and-residency.md
│
├── threat-models/                             one per trust boundary
│   ├── TM-001-tenant-isolation.md
│   ├── TM-002-ai-data-access.md
│   ├── TM-003-integration-ingress.md
│   ├── TM-004-storage-access.md
│   └── TM-005-admin-plane.md
│
├── risk/
│   ├── enterprise-risk-register.md
│   ├── exceptions-register.md                 every exception has an expiry
│   └── risk-acceptance-log.md                 named executive, expiry date
│
├── operations/
│   ├── OPS-001-incident-response-runbook.md
│   ├── OPS-002-disaster-recovery-runbook.md
│   ├── OPS-003-backup-and-restore-testing.md
│   ├── OPS-004-access-review-procedure.md
│   └── OPS-005-break-glass-procedure.md
│
├── vendors/
│   ├── subprocessor-inventory.md
│   └── assessments/
│
├── assessments/
│   ├── readiness/
│   ├── penetration-tests/
│   └── internal-audits/
│
├── adr/                                       decisions with consequences
│   ├── ADR-T001-evidence-uses-the-existing-event-spine.md
│   ├── ADR-T002-controls-are-framework-neutral.md
│   ├── ADR-T003-privacy-excluded-from-initial-type-ii-scope.md
│   └── ADR-T004-type-i-precedes-type-ii.md
│
└── evidence/
    ├── evidence-catalog.md
    └── retention-schedule.md
```

**Conventions.** Every document carries owner, approver, effective date, review
date and version. Review dates are enforced by the dashboard, not by memory —
an unreviewed policy past its date is a finding, and it should surface as one
automatically.

**Integration with the existing Product Brain.** The four ADRs above go in the
main ADR index (`07-adr-index.md`); ETCF appears in the capability registry;
security-relevant regressions continue to use the existing regression log and
the executable `regression-test-map.md`. ETCF does not fork the governance model
— it extends it.

---

# 12. Final Recommendations

## 12.1 Why this investment matters now

Three reasons, in order of force.

**The gap is provability, not security.** 155 of 155 tenant tables under RLS,
41 of 41 definer functions hardened, immutable hash-chained audit structures,
and a determinism discipline most vendors cannot approach. This is a platform
that would *survive* an audit and cannot currently *start* one. That asymmetry
is the cheapest kind of gap to close and the most expensive kind to leave open.

**The evidence engine already exists.** The event spine — append-only,
hash-chained, retention-classified, closed-vocabulary — was built for Process
Intelligence and is structurally an audit evidence engine. Competitors without
event sourcing must build this from nothing. ProjectOps360 must connect it.

**The window is now.** Compliance debt compounds. Retrofitting evidence onto a
larger surface with more customers and more integrations costs several times
what it costs today, and Type II requires an observation window that cannot be
compressed. **Every quarter of delay is a quarter added to the earliest possible
attestation date, not merely a quarter of delayed work.**

## 12.2 How it increases enterprise trust

Enterprise trust is not produced by a certificate. It is produced by a vendor
being able to answer a specific question quickly, precisely, and without
defensiveness. ETCF makes the answers queryable rather than reconstructed — and
a vendor that answers "here is the evidence, generated continuously, and here is
the gap we have not yet closed" is trusted more than one that answers only in
green.

## 12.3 How it differentiates ProjectOps360

Three claims competitors cannot easily copy:

1. **Processing Integrity as a first-class category.** Most SaaS vendors decline
   it because they cannot evidence deterministic, provenance-bearing computation.
   This platform can: pure engines, 3,147 executable tests, guard-named
   regressions, provenance on every figure, and a documented refusal to fabricate
   a value where data is absent. *Elect this category deliberately.*

2. **AI governance that is already true.** "AI never mutates without human
   approval", "AI never sees raw payloads it should not", "every AI-derived
   entity traces to its source and its approver" — these are existing properties,
   not roadmap items. Within 18 months they will be standard contract
   requirements. Being able to evidence them now is a durable advantage.

3. **The same engine explains your project and your controls.** A structural
   claim, not a positioning statement.

## 12.4 How it increases valuation

Compliance debt is priced in diligence whether or not it is discussed. A
diligence-ready governance posture removes a recognised discount, expands the
addressable market to buyers who cannot contract without attestation, and
converts "we intend to be secure" into an audited assertion. It also signals
engineering maturity — the discipline visible in the regression map and the
executable UX contracts is precisely the signal technical diligence looks for.

## 12.5 How it accelerates enterprise sales

Security review is typically the longest non-negotiation phase of an enterprise
deal. A Trust Centre with current documentation, a completed attestation and
pre-answered questionnaires removes weeks per deal and, more importantly,
removes the deals that die silently in review without feedback.

## 12.6 How it prepares for future certifications

Because controls are authored framework-neutral and evidence is automated at the
source, each additional framework is a mapping exercise. **The expensive work is
done once.** This is the same principle that governs the product's own
architecture — one source of truth, many projections — applied to governance.

---

## 12.7 Recommended immediate actions

Ordered by value per unit of effort.

| # | Action | Effort | Rationale |
|---|---|---|---|
| 1 | **Name an accountable security owner** | Hours | Nothing below happens without it. Every framework requires it |
| 2 | **Wire `platform_governance_audit`** | Days | The best-designed control surface in the platform has zero rows. Highest leverage available |
| 3 | **Test a database restore and record the result** | Hours | An untested backup is a hypothesis. Cheapest high-value control in the programme |
| 4 | **Build the subprocessor inventory** | Days | P0 for SOC 2, GDPR Art. 28, and the first question enterprise counsel asks |
| 5 | **Enable dependency and secret scanning in CI** | Hours | Closes CC6.8 and part of CC7.1 at near-zero cost |
| 6 | **Capture authentication events** | Days | Largest single evidence gap; blocks the observation window if left |
| 7 | **Enable MFA for privileged roles** | Weeks | Highest-risk technical gap; frequently a hard gate in enterprise review |
| 8 | **Record the two RLS exceptions formally** | Hours | They appear correct; "appears correct" is not a control statement |

Items 1, 3, 5 and 8 are achievable within a week and close a disproportionate
share of the P0 findings.

---

## Appendix A — Assessment method

Static analysis of the committed source tree, plus direct measurement against
the production database (project `ocopmlnkvidvmxgiwvxw`, 2026-07-26). Findings
where the two disagreed were resolved in favour of the measurement; one such
disagreement is documented in the reading note above.

**Not assessed:** hosting and database provider internal controls (inherited —
these require the providers' own attestation reports, which should be collected
as vendor evidence under M1); network layer; physical security; personnel
controls.

## Appendix B — Terms

| Term | Meaning |
|---|---|
| **Type I** | Auditor opinion on control *design* at a point in time |
| **Type II** | Auditor opinion on control *operating effectiveness* over a window (6–12 months) |
| **TSC** | Trust Services Criteria — the SOC 2 control framework |
| **Observation window** | The period over which Type II evidence is collected |
| **Inherited control** | A control operated by a subprocessor, evidenced by their report |
| **Compensating control** | An alternative control where the primary is not feasible |
| **Residual risk** | Risk remaining after controls are applied |
