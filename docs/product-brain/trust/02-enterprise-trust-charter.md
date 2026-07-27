# Enterprise Trust Charter

**Version 1.0** · The constitution of the Enterprise Trust Program
**Status:** APPROVED — frozen at Enterprise Trust Baseline v1.0 · **Date:** 2026-07-26
**Review:** annually, and on trigger (see [Review Cycle](#review-cycle))
**Companions:** [ETCF Architecture & Governance Specification](00-etcf-architecture-specification.md) ·
[Enterprise Trust Strategy](01-enterprise-trust-strategy.md) ·
[Programme entry point](README.md)

---

## How to read this document

This charter contains principles, not procedures. Procedures change when
circumstances change. Principles change only when we are persuaded we were wrong.

Every principle here is written to be **violable**. A principle that cannot be
broken is a description, not a commitment. Each therefore states what it forbids
and what it costs — because a principle with no cost is a preference, and
preferences do not survive a deadline.

When a future decision is contested, this document is the tiebreaker. If it does
not settle the question, that is a defect in the charter and should be corrected
here rather than resolved by seniority.

Nothing in this document depends on a particular technology, framework, auditor,
regulation or organizational shape. Those will change. This should not.

---

# Purpose

## Why Enterprise Trust exists

We hold other organizations' work. Their commitments, their money, their people's
time, their decisions and the reasoning behind them. When a customer places a
programme inside this platform, they transfer operational control while keeping
accountability. They remain answerable to their board, their regulator and their
own customers for outcomes they can no longer directly observe.

Enterprise Trust exists to make that transfer defensible.

Not comfortable — defensible. A customer must be able to answer, to someone who
is not friendly and not technical, the question *how do you know?* Everything in
this programme serves that sentence.

## Why it is permanent, not a project

A certification is a statement about a period that has ended. It expires, and
what it attested to begins decaying the moment the auditor leaves.

Trust is not a state we reach. It is a property the system either has or does not
have, continuously, and it is only observable in the moments when it is tested —
during an incident, a dispute, a review, an acquisition. Those moments are not
scheduled.

A programme that exists to obtain a certificate ends when the certificate
arrives, and the posture decays until the next audit forces reconstruction. This
one exists to hold a property, and properties are held continuously or not at all.

**The certificate is a by-product. If it ever becomes the objective, this
programme has failed and should be restarted.**

---

# Mission

> **Make every consequential claim about this platform answerable with evidence
> the system produced itself.**

Four words carry the weight.

**Consequential** — not every claim. Trust is not exhaustive documentation; it is
knowing which claims someone will be held to and making those provable.

**Answerable** — within a timeframe that matters to the person asking. An answer
that takes three weeks to assemble is an answer that arrived after the decision.

**Evidence** — not assertion, not recollection, not a screenshot of a screen that
has since changed.

**The system produced itself** — generated as a by-product of operation, not
assembled by a person preparing for a review. Evidence that requires human effort
to exist is evidence that will stop existing.

---

# Vision

ProjectOps360 becomes a platform where **governance is a property of the work,
not a description of it**.

Today, in most organizations, execution happens in one place and its governance
is reconstructed elsewhere — after the fact, from memory, in documents that
describe a version of the programme that has already moved on. The gap between
what happened and what is recorded is where risk accumulates unobserved.

We intend to close that gap for ourselves first, and to hold open the possibility
of closing it for our customers.

Three properties define the destination:

**Trust is observable, not asserted.** Anyone with a legitimate interest can see
the evidence that concerns them rather than receiving our summary of it.

**Trust improves as the product improves.** Because governance reads the same
canonical record as the product, investment in one is investment in both. Any
design that makes them separate should be rejected on those grounds alone.

**Trust survives the people who built it.** Institutional knowledge is a
liability. If the answer to *how do you know?* depends on who is asked, we have
not built the capability — we have hired it.

---

# Core Principles

Thirteen principles. Each states a rule, what it forbids, and what it costs.

---

## 1. Trust by Design

**Trust is a design input, not a review stage.**

Trust properties — isolation, provenance, auditability, least privilege — are
decided when a capability is designed. They cannot be added later without
changing load-bearing structure, and a review that arrives after the design is a
review that can only approve or delay.

*This forbids:* treating security as a checkpoint before release. Designing first
and asking about trust second.

*This costs:* design work is slower. Some capabilities will take longer to
specify than to build.

---

## 2. Evidence over Assumptions

**We do not know what we have not measured.**

An assessment that cannot be re-run is an opinion. A control that has not been
tested is an intention. A backup that has not been restored is a hypothesis.

When a document and a system disagree, **the system is right**. The document is a
defect to be corrected — never the other way around.

*This forbids:* claiming a posture from design intent. Reporting a control as
operating because it was implemented. Answering *how do you know?* with *because
we built it that way*.

*This costs:* measurement is work, and it will sometimes contradict what we
believed and have already said.

---

## 3. Security by Default

**The safe configuration is the one that requires no decision.**

Defaults are where security actually lives, because most systems run in their
default state most of the time. Access is denied unless granted. Data is private
unless shared. A capability is off until it is deliberately enabled.

*This forbids:* a permissive default with a documented way to tighten it. A
setting whose safe value depends on someone remembering to change it.

*This costs:* friction on legitimate use, and a support burden from people
blocked by a default that was correct.

---

## 4. Least Privilege

**Every actor holds the narrowest authority that permits their work, for the
shortest time it is needed.**

This applies without exception to humans, services and AI. Privilege is granted
for a purpose and expires — standing access is the accumulation of decisions
nobody revisited.

Emergency access exists, is time-boxed, and is reviewed after use. **An emergency
path that is not reviewed is not an emergency path; it is a permanent
back door with a euphemism.**

*This forbids:* permanent elevated access. Shared credentials. Privilege granted
because revoking it later would be awkward.

*This costs:* recertification is recurring work, and someone will be blocked at
an inconvenient moment.

---

## 5. Immutable Auditability

**A record of what happened cannot be edited to say something else.**

Audit records are append-only and tamper-evident, enforced by the system rather
than by convention. Corrections are new records that reference what they correct;
history is added to, never rewritten.

Immutability enforced by policy is not immutability. It is a request.

*This forbids:* deleting or amending an audit record for any reason, including
correcting a genuine error. Retention policies that quietly discard evidence
during a period under review.

*This costs:* storage, and living permanently with records of our mistakes.

---

## 6. Every Decision Leaves Evidence

**If a decision matters, its record exists before anyone asks for it.**

Consequential decisions — access granted, risk accepted, exception approved,
control waived, AI output acted upon — produce a durable record at the moment
they are made, containing who, what, when, on what basis, and under whose
authority.

**Evidence cannot be created retroactively.** Every moment a decision goes
unrecorded is permanently absent from the record. This is the only cost in this
programme that cannot be recovered by spending more later.

*This forbids:* reconstructing decisions from memory during a review.
Consequential authority exercised through channels that leave no trace.

*This costs:* recording is friction at exactly the moment someone is trying to
move quickly.

---

## 7. No Hidden Decisions

**Authority exercised invisibly is authority we do not have.**

Every decision that affects a customer's data, security or obligations is
discoverable by someone with a legitimate interest — including decisions to deny,
to defer, and to accept a risk.

**A denial is evidence of a working control and is worth more than an approval.**
A system that records only what it permitted cannot demonstrate that it refuses
anything.

*This forbids:* undisclosed access to customer data. Silent policy changes.
Controls that log success and drop failure.

*This costs:* transparency about our refusals and our gaps, including to people
who will use them against us.

---

## 8. Explainability

**Any figure or conclusion the platform presents can be traced to its inputs and
its method.**

A number a user cannot interrogate is a number they cannot defend, and defending
numbers is what our users do for a living. Explanation is not narration — it is
the ability to reach the underlying facts and the operation applied to them.

*This forbids:* presenting a figure whose derivation is unavailable. Explanations
that describe a computation without exposing it.

*This costs:* some techniques are excluded because their outputs cannot be
explained, even when they would perform better.

---

## 9. Deterministic Intelligence

**Prefer computation that can be reproduced over inference that can only be
believed.**

Where a result can be derived deterministically from canonical data, derive it.
Reserve inference for questions that genuinely require judgement — and when
inference is used, **say so at the point of use**.

A reproducible result is the strongest form of explanation available: it can be
recomputed and compared rather than argued about.

*This forbids:* using a model where a computation would do. Presenting inferred
and derived figures identically.

*This costs:* deterministic derivation is harder to build and covers less ground.

---

## 10. Human Accountability

**A person is accountable for every consequential decision. Not a team, not a
process, not a system.**

Automation may propose, compute, recommend and prepare. It may not be
accountable, because accountability requires the capacity to be answerable, and
only a person has that.

Where automation acts within delegated authority, the person who delegated it
remains accountable for the outcome.

*This forbids:* "the system decided". Ownership assigned to a group, which is
ownership assigned to nobody. Risk accepted without a name attached.

*This costs:* people must accept accountability for outcomes they did not
directly control, which is uncomfortable and occasionally unfair.

---

## 11. Privacy by Design

**We collect what we need, keep it while we need it, and can prove we disposed
of the rest.**

Data has a lifecycle with a defined end. The obligation to delete is as real as
the obligation to protect, and considerably easier to neglect because nothing
fails when it is ignored.

Data we do not hold cannot be breached, subpoenaed, or mishandled. **Not
collecting is the strongest control available and the one least often
considered.**

*This forbids:* retaining data because it might prove useful. Collecting a field
because it is easy to collect. Deletion that hides a record rather than removing
it.

*This costs:* analytical capability we forgo, and the recurring work of disposal.

---

## 12. Compliance as a Product Capability

**Governance reads the same canonical record as the product.**

Any design that requires a separate system of record for compliance is rejected
on that basis. Two systems describing the same events will diverge, and the
divergence will be discovered at the worst possible moment — during an audit, an
incident, or a dispute.

One consequence is strategic and should be stated plainly: **investment in the
product improves the compliance posture, and investment in compliance improves
the product.** A programme structured otherwise is a tax. This one must never
become one.

*This forbids:* compliance-only data stores. Evidence assembled by copying from
the operational system. Governance features that do not also serve users.

*This costs:* the canonical model must carry obligations that no single feature
justifies.

---

## 13. Knowledge Before Automation

**Automate a process only after we understand it well enough to describe it.**

Automation applied to a process we do not understand produces speed in an unknown
direction and removes the observation that would have revealed the problem.
Understand, describe, then automate — in that order, without exception.

The corollary matters as much: **automation that removes a human's ability to
observe a process has made that process less trustworthy**, whatever it did to
throughput.

*This forbids:* automating to avoid the work of understanding. Optimisations that
eliminate the signals a person used to detect that something was wrong.

*This costs:* speed we could have had earlier.

---

## The principle drawn from our own history

Three of these principles converge on a failure this organization has
demonstrated repeatedly, at increasing scale: **a capability was built correctly
and never connected to anything.** The mechanism was sound, the tests passed, and
no path existed from the surface to it.

The most consequential instance was an audit trail with a constrained vocabulary,
enforced immutability and a cryptographic chain — designed better than most
production systems achieve — containing no records at all.

The charter therefore adopts a completion rule that overrides every other
definition of done in this programme:

> **A control is complete when a query returns its evidence.**
> Not when the mechanism exists. Not when the tests pass.
> **When the rows are there.**

This is not a technical standard. It is a statement about what we are willing to
call finished, and it applies to every principle above.

---

# Decision Principles

Principles are cheap when they agree. These are the rules for when they do not.

## When security conflicts with convenience

**Security wins, and the inconvenience is treated as a design defect to be
solved rather than a cost to be borne.**

The failure mode is not choosing convenience — it is choosing security and
declaring the problem closed. Controls that are painful get circumvented, and a
circumvented control is worse than an absent one because it produces the
appearance of protection.

*If a control is being worked around, the control is wrong.* Fix the control.

## When compliance conflicts with speed

**Ask which is reversible.**

Most compliance work is deferrable at a known cost. Two categories are not:

**Evidence not captured is gone permanently.** No later investment recovers it.
**Architectural properties** — isolation, immutability, provenance — become
prohibitively expensive to add once a system depends on their absence.

For those two, compliance wins regardless of the deadline. For everything else,
speed may win, provided the decision is recorded as an exception with an owner
and an expiry.

**An exception without an expiry is not an exception. It is a decision nobody
wanted to make in public.**

## When architecture conflicts with deadlines

**The deadline may win once. It may not win twice for the same reason.**

Shipping around an architectural constraint is legitimate under pressure and
becomes illegitimate when repeated, because the second instance is no longer a
deadline problem — it is a decision to keep the constraint unresolved.

The rule: the first occurrence is an exception, recorded with a remediation
owner. The second occurrence for the same cause is escalated to the Executive
Sponsor as an architectural decision, because that is what it has become.

## When technical debt conflicts with governance

**Debt that weakens a control is not debt. It is an accepted risk, and it must be
accepted by name.**

Ordinary technical debt is an engineering trade-off, managed by engineering.
Debt that degrades isolation, auditability, access control or provenance changes
our risk position and belongs in the risk register with a named accepting
executive and an expiry.

The distinction is not severity. It is **who is entitled to accept it**.

## The meta-rule

**When a decision is genuinely close, choose the option that leaves more
evidence.**

Evidence is the only asset in this programme that appreciates. A decision that
turns out wrong but is well documented can be corrected. A decision that turns
out right but is undocumented teaches nothing and cannot be defended.

---

# Governance Model

Roles are defined as **functions, not job titles**. The organization will change
shape; the functions must persist. One person may hold several. **No function may
be held by nobody**, and holding a function means it is that person's
accountability, not their committee's.

## Executive Sponsor

Holds ultimate accountability for the trust posture. Approves the charter and its
amendments, accepts risks above the delegated threshold, resolves conflicts
between trust and other objectives, and ensures the programme has an owner with
capacity.

**The Sponsor's most important act is protecting the programme's principles when
they become inconvenient.** Principles are never tested when they are cheap.

## Architecture Review

Evaluates whether a proposed design satisfies the principles in this charter
**before** it is built. Consulted for any change crossing a trust boundary,
altering the canonical record, changing an isolation mechanism, or introducing an
external dependency that processes customer data.

Architecture Review has the authority to require redesign. Review that can only
advise is not review; it is commentary that arrives too late to matter.

## Security Review

Evaluates threat exposure and control adequacy. Owns threat models, penetration
testing, vulnerability management and security monitoring. Has the authority to
block a release that introduces unmitigated critical exposure — and the
obligation to say so in writing when it declines to.

## Compliance Review

Maintains the control inventory and framework mappings, assesses evidence
sufficiency, and manages the relationship with external auditors.

**Compliance Review does not own controls.** Controls are owned by the functions
that operate them. Compliance Review owns whether we can *prove* they operate —
a distinction that determines whether the function becomes a bottleneck or a
service.

## Change Approval

Every change to production passes a defined path with an authorising record. The
path is the control; its enforcement is the evidence.

Emergency changes may bypass normal approval and may not bypass the record.
**Post-hoc review of emergency changes is mandatory** — an emergency path without
review becomes the normal path within two quarters.

## Architectural Decision Records

Decisions with lasting consequence are recorded as ADRs: the decision, its
context, the alternatives, the reasoning, and the consequences accepted.

An ADR is written when a decision would be expensive to reverse or when a future
person would reasonably ask *why is it like this?* **The ADR's purpose is not to
justify the decision. It is to let a successor disagree competently** — with the
reasoning available rather than reconstructed.

ADRs are superseded, never deleted.

## Risk Acceptance

Risk may be accepted rather than mitigated. Acceptance requires: a named
accepting executive at the appropriate authority level, an expiry date, a stated
compensating control or an explicit statement that none exists, and a record.

**Acceptance without an expiry is abandonment wearing a governance word.** At
expiry, the risk returns for a fresh decision by whoever holds the function then
— which is the point: the world will have changed and the acceptance should be
re-earned.

---

# Success Criteria

Not certifications. Not documents. Not scores. These are the operational
outcomes that indicate the capability is real, phrased as questions with binary
answers.

**1. Can we answer?** A reasonable question about data handling, access, incident
history or AI behaviour is answered from an authoritative source within one
business day — including when the honest answer is *not yet*.

**2. Was the evidence already there?** When evidence is needed, it exists,
generated at the time of the event rather than assembled afterwards. *The
assembly effort is the metric.* It should trend to zero.

**3. Can we reconstruct?** Given any past event, we can determine what happened,
who was involved, what was accessed and what changed — without depending on a
particular person's memory.

**4. Do controls operate unattended?** Controls function without someone
remembering to run them. A control requiring monthly human diligence will lapse
within a year; this is not pessimism, it is the observed behaviour of all
organizations.

**5. Would we survive our own incident?** Not *would we have prevented it* — we
will not prevent all of them. Could we detect it, contain it, reconstruct it,
disclose it accurately and within obligation, and demonstrate what we did?

**6. Does it survive its people?** A person central to this capability leaves,
and the capability does not degrade. If it does, we hired trust rather than
building it.

**7. Do we know our gaps?** We can enumerate what we have not yet closed, with
owners and dates. **A programme that reports only strengths has stopped
assessing.** The number of known gaps is a health indicator; the number of
*unknown* gaps is the risk.

**8. Is it cheaper each time?** Each additional framework, customer assessment
and audit costs less than the last. Rising cost means we are producing reports
rather than capability.

---

# Ownership

Ownership means accountability: the named person answers for the state of the
thing, whether or not they perform the work. Every domain below has exactly one
accountable owner.

| Domain | Owns | Accountable for |
|---|---|---|
| **Architecture** | Trust properties of system design | That designs satisfy this charter before they are built |
| **Security** | Threat exposure and technical controls | That exposure is known, monitored and within tolerance |
| **Governance** | Policies, standards, decision processes | That decisions are made through a defined process with a record |
| **Evidence** | Collection, integrity, retention, availability | That evidence exists when needed and has not been tampered with |
| **Compliance** | Control inventory, framework mappings, audits | That we can prove what we claim |
| **Risk** | Risk register, acceptance, treatment tracking | That risks are known, owned, and either treated or accepted by name |
| **AI Governance** | Boundaries, traceability, oversight of AI behaviour | That AI operates within delegated authority and every consequential output is traceable |

## Rules of ownership

**One name per domain.** Shared ownership is unowned. Where two people must
collaborate, one is accountable.

**Ownership is explicit and current.** An owner who has left, changed role, or
does not know they hold the function is not an owner. Ownership is reviewed at
the charter's review cycle.

**Owners may delegate work, never accountability.**

**AI Governance is separated deliberately.** It could be folded into Security or
Architecture. It is not, because AI-specific obligations are growing faster than
any adjacent domain and because a responsibility held as a secondary concern
receives secondary attention.

---

# Review Cycle

## Cadence

**Annually**, at minimum. The review examines whether the principles remain
correct — not whether we are complying with them, which is a different exercise
conducted continuously.

## Triggered review

The charter is reviewed out of cycle when:

- A significant security incident occurs. *An incident is evidence about our
  principles, and the most valuable evidence available.*
- We enter a materially different regulatory or market context.
- A principle is found to be repeatedly circumvented. **Repeated violation is
  data: either the principle is wrong, or it is unenforceable as written. Both
  are charter defects.**
- The company's structure changes such that the ownership model no longer maps
  to reality.
- A framework or obligation emerges that the principles do not address.

## What requires executive approval

**Executive approval required:**

- Adding, removing or materially changing a principle
- Changing the decision principles — the conflict-resolution rules
- Changing the governance model or ownership structure
- Changing the success criteria
- Accepting a risk above the delegated threshold
- Any exception to a principle lasting beyond a defined maximum

**Executive approval not required:**

- Clarifying language without changing meaning
- Adding examples or interpretation
- Anything in the policies, standards and procedures beneath this charter

## The distinction that keeps this alive

**A charter that requires executive review to change a procedure will be
abandoned within two quarters.** Procedures must be changeable by the people who
operate them. Principles must not be changeable by the people they constrain.

That is the entire architecture of this section, and getting it wrong in either
direction kills the document — too rigid and it is bypassed, too loose and it
constrains nothing.

---

# Long-Term Commitments

These are commitments, not aspirations. Each is written to be kept. **A
commitment we might break is worse than none**, because breaking it teaches
people what our commitments are worth.

## To our customers

We will hold your data with the care you would apply yourself, and we will tell
you the truth about how we hold it — including what we do not yet do well.

We will not access your data without a legitimate purpose, and when we do, the
access will be recorded and available to you.

We will tell you when something goes wrong, promptly and accurately, before we
are certain of the full picture rather than after. **We will not wait for a
comfortable version of the facts.**

We will not use your data for purposes you have not agreed to, including
improving our own systems, without asking first.

When you leave, we will return your data and delete our copies, and we will be
able to prove we did.

## To our partners

We will be a dependency you can assess. Our posture will be documented, current
and available, and we will answer your questionnaires from a live inventory
rather than from a memory of how things were.

We will tell you when a change on our side affects your risk.

## To our employees

We will make the secure path the easy path, and treat friction as our defect
rather than your inconvenience.

We will not ask you to work around a control. If a control is being circumvented,
we will fix the control.

We will not blame individuals for systemic failures. **Post-incident review
exists to improve the system, and it stops working the moment it becomes a
performance conversation.**

We will give you the authority that matches your accountability.

## To our auditors

We will not perform compliance for you. What you see will be what runs.

We will show you our gaps. A finding you discover that we already knew and
disclosed is a functioning programme; a finding you discover that we did not know
is a failure of ours, not a success of yours.

Our evidence will be generated by the system, timestamped, and tamper-evident. If
we cannot prove something, we will say so rather than construct a substitute.

## To our investors

We will not accumulate compliance debt silently. Our posture, including its gaps,
will be visible in the same materials that show our commercial position.

We will not present a certification as a substitute for a capability.

We will treat governance as an asset with a return, held to the same standard as
any other investment — and we will tell you when it is not producing one.

---

# Closing Statement

Trust is the only thing we sell that we cannot build.

Everything else in this platform is constructed: the graph, the engines, the
intelligence. They can be specified, built, tested, and shipped on a date. Trust
cannot. It is not produced by the work — it is *conceded* by someone else, slowly,
on the basis of evidence, and it is withdrawn quickly on the basis of a single
contradiction between what we said and what was true.

This asymmetry is the reason for everything in this document. A capability that
takes years to earn and moments to lose cannot be managed by intention. It has to
be structural: built into how systems are designed, how decisions are recorded,
how authority is granted, and what we are willing to call finished.

We hold other people's work. They gave up the ability to watch it directly, and
kept the obligation to answer for it. The whole of this programme is the
acknowledgment that they were owed something in return — not reassurance, but
**the ability to verify**.

So we commit to something narrower and harder than being trustworthy. We commit
to being **checkable**. To leaving evidence when it would be easier not to. To
recording our refusals alongside our approvals. To naming our gaps before someone
else finds them. To saying *we do not know* when we do not know, and to treating
that sentence as a finding rather than a failure.

The certifications will come, and they will expire, and they will be renewed.
They are not what this is. They are the receipt.

**What this is: a decision, made once and re-made continuously, that when someone
asks us how we know — we will be able to show them.**

---

*This charter governs the Enterprise Trust Program. Where any policy, standard,
procedure or decision conflicts with it, this document prevails. Where this
document is silent, the principle most consistent with those written here should
be inferred — and then written down.*
