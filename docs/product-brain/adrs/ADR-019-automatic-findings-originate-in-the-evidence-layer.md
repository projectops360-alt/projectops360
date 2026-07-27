# ADR-019 — Automatic findings originate in the evidence layer, never in the AI

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** P1/P4 · **Supersedes:** the open decision recorded as EKI §11 #7
**Related:** [ADR-018](ADR-018-isabella-reasons-live-over-the-graph.md) ·
[ADR-006 Independent status dimensions](ADR-006-independent-status-dimensions.md) ·
[Enterprise Trust Charter](../trust/02-enterprise-trust-charter.md)

---

## Context

EKI relies on findings that appear without human action: an exception passing its
expiry, an evidence binding whose records stopped arriving, a control that has sat
in `implemented` beyond a threshold without reaching `operating`, a policy past
its review date, an ownership domain with no owner.

These are the mechanism by which a governance programme notices its own decay —
the failure that occurs *between* audits, when nothing changed and that is
precisely the problem.

## Problem

Where do automatic findings come from? The AI can observe all of these
conditions, and would produce well-written findings with good explanations.

## Decision drivers

| # | Driver |
|---|---|
| D1 | A finding must be reproducible — the same state must always produce the same finding |
| D2 | Charter P2 — evidence over assumptions |
| D3 | Charter P9 — prefer computation that can be reproduced over inference that can only be believed |
| D4 | Charter P10 — human accountability for consequential decisions |
| D5 | Findings drive remediation and appear in audits; their basis will be challenged |

## Decision

**Automatic findings are produced by deterministic rules over evidence and
object state. The AI may not create a finding.**

Three tiers, with strictly different authority:

| Tier | Producer | Authority | Basis |
|---|---|---|---|
| **Deterministic** | Rule over object state and evidence | **Creates a finding directly** | A stated, reproducible condition |
| **Human** | A person | Creates a finding directly | Judgement |
| **AI** | Isabella | **Proposes a candidate only** | Pattern recognition |

**Deterministic conditions** (the v1 set, each a stated predicate):

1. An Exception whose expiry has passed
2. An EvidenceBinding whose latest record exceeds its freshness tolerance
3. A Control in `implemented` beyond a threshold without reaching `operating`
4. A Policy or Standard past its review date
5. An ownership domain with no accountable owner
6. An unresolved `contradicts` relationship older than a threshold
7. An Obligation with no ControlMapping
8. A ControlMapping in `disputed` beyond a threshold

Each is a condition, not a judgement. Each is stated in the finding.

**AI candidates** enter as `proposed`, are visibly attributed to the AI, and
require a human transition — which the existing schema already requires to carry
a rationale.

## Detailed rationale

**Why the AI may not create findings, when it could do it well.** Three reasons,
in ascending order of force.

*Reproducibility.* The same state must produce the same finding. A model's output
varies with phrasing, context and version. When an auditor asks *why was this
raised and that not*, "the model noticed" is not an answer that survives.

*Challengeability.* Findings drive remediation and appear in audit evidence. A
deterministic finding can be checked by re-evaluating its condition. A model-
generated one can only be argued about — and the argument arrives at the least
convenient moment.

*Accountability.* Charter P10: a person is accountable for every consequential
decision. Raising a finding assigns work and creates a record; it is
consequential. Automation may act within delegated authority only where the
delegation is a stated rule, which is exactly what a deterministic condition is.

**Why the AI's contribution is nonetheless real.** The AI sees patterns rules
cannot express: a control repeatedly excepted, a risk whose realisation suggests
its assessment was optimistic, a mapping whose evidence has drifted from its
assertion. These are genuine and valuable. **They are also judgements**, and they
enter as proposals — which is the correct handling of a judgement made by
something that cannot be accountable for it.

**Why the deterministic set is small and explicit.** Each condition is a promise:
*if this state exists, a finding exists.* A large or fuzzy set makes the promise
unverifiable. Eight stated predicates can be tested individually.

**Why condition 2 is the important one.** A binding that stops producing records
is a control that stopped operating, and nothing errors when it happens. It is the
condition that makes Charter's completion rule self-enforcing rather than
aspirational, and it is why the finding must be automatic — a human noticing
requires a human looking, and nobody looks at a control that is working.

## Consequences

### Positive

- Findings are reproducible and challengeable (D1, D5)
- The governance programme detects its own decay without human diligence
- The AI's pattern recognition is captured without being trusted with authority
  it cannot hold (D4)
- The Charter's completion rule becomes self-enforcing

### Negative

- Only stated conditions are detected. A decay mode nobody anticipated produces
  no finding
- Thresholds require tuning: too tight produces noise, too loose produces silence
- Deterministic findings may be technically correct and contextually unimportant

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Automatic findings become noise and are ignored wholesale | **High** | Thresholds are per binding, not global. A finding that recurs without remediation escalates rather than repeats |
| A condition is disabled to reduce noise, silently removing detection | **High** | Disabling a condition is itself a governance decision requiring a rationale — the same discipline as any exception |
| AI proposals accumulate unreviewed, becoming a second unmonitored backlog | Medium | Proposals expire. An unreviewed proposal is not a finding and must not be counted as one |

## Security implications

Deterministic findings cannot be suppressed by prompt manipulation, because no
model is in the path. **This matters more than it first appears**: an AI-generated
finding pipeline is an AI-suppressible finding pipeline, and the conditions being
detected are precisely those an attacker or a negligent operator would prefer
undetected.

## RLS and tenant-isolation implications

Findings are tenant-scoped like every knowledge object (ADR-013). A deterministic
rule evaluates within one tenant; there is no cross-tenant evaluation, and a rule
that required one would be a different decision.

## Evidence implications

- A deterministic finding **states its condition and the state that satisfied it**,
  making it self-evidencing
- Finding creation is itself an evidence record — evidence that the monitoring
  control operates
- **A period with no automatic findings is evidence that conditions were met**,
  provided the rules ran. The rules' execution must therefore be recorded
  independently of their output, or silence is ambiguous

That last point is subtle and important: absence of findings must be
distinguishable from absence of evaluation.

## AI-governance implications

- Isabella may propose findings, visibly attributed, in `proposed` status
- She may **explain** a deterministic finding — the explanation is valuable and
  carries no authority
- She may not create, transition, close or suppress a finding
- She may not alter a threshold
- These boundaries are enforced at the authorization layer, not by prompt
  instruction. **A boundary held only in a prompt is a suggestion**

## Migration implications

Conceptual. Conditions are evaluated over existing state. No schema change beyond
the object model already decided.

## Compatibility

| Component | Impact |
|---|---|
| Knowledge objects | Findings are objects (ADR-014) |
| Evidence model | Conditions read evidence; they do not write it |
| Event log | Finding creation is an event |
| Isabella | Gains a proposal path; gains no authority |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| AI creates findings | Not reproducible, not challengeable, and assigns accountability to something that cannot hold it |
| Only human findings | Requires diligence that reliably lapses. Nobody inspects a control that appears to be working |
| AI creates, human confirms | Confirmation of a fluent, plausible finding becomes rubber-stamping. The reproducibility problem is unchanged |
| A single global staleness threshold | Freshness is a property of a binding, not of the platform. A daily control and an annual one are not comparable |

## Validation criteria

1. No finding has an AI actor as creator
2. Every deterministic finding states its condition and the state satisfying it
3. Re-evaluating the condition reproduces the finding exactly
4. AI proposals are `proposed`, visibly attributed, and expire
5. An expired exception produces a finding without human action
6. A binding exceeding its freshness tolerance produces a finding without human action
7. Disabling a condition produces a governance record with a rationale
8. **Rule execution is recorded independently of rule output**, so silence is
   distinguishable from non-evaluation

## Implementation guardrails

- Conditions are stated predicates, reviewable as a set
- Thresholds are per object, not global
- **A finding never disappears because its condition cleared.** It is resolved and
  verified — which is the difference between fixing something and no longer seeing it
- The AI has no write path to findings at any status other than `proposed`

## Rollback

Reversible per condition. Disabling one is itself a governance decision requiring
a rationale, which is the intended friction.

## Open follow-up questions (non-blocking)

1. What are the initial threshold values? *Non-blocking: tuning parameters, not
   architecture. The requirement that they are per binding is the decision.*
2. Should recurring findings escalate in severity automatically? *Non-blocking:
   a treatment policy, decidable once findings exist.*
3. Do AI proposals count toward a gap metric before review? *Non-blocking; the
   answer is no, and the validation criteria already state it.*
