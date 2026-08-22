import type { Metadata } from "next";
import Link from "next/link";
import { AcquisitionCapture } from "@/components/analytics/acquisition-capture";

const canonicalUrl = "https://projectops360.com/how-to-detect-project-friction";

export const metadata: Metadata = {
  title: "How to Detect Project Friction | 8-Step Diagnostic Guide | ProjectOps360",
  description:
    "Learn how to detect project friction using execution evidence: waiting, blockers, rework, decision latency, handoff delays, schedule divergence and dependency impact.",
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: canonicalUrl,
    title: "How to Detect Project Friction — An Evidence-Based Guide",
    description:
      "An 8-step method for finding where project execution is slowing down, validating the evidence and tracing downstream impact.",
    siteName: "ProjectOps360",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Detect Project Friction | ProjectOps360",
    description:
      "Detect waiting, rework, blockers and dependency friction from actual project execution evidence.",
  },
};

const steps = [
  {
    title: "Define the expected execution path",
    copy: "Start with what should happen: milestone sequence, task dependencies, expected handoffs, planned durations, decision gates and required approvals. Friction can only be interpreted against an expected flow or baseline.",
  },
  {
    title: "Capture execution evidence",
    copy: "Use timestamped facts such as status transitions, start and finish dates, blocker events, dependency changes, approvals, decisions, reopens, time entries and milestone movement. Do not begin with opinions about why a project is slow.",
  },
  {
    title: "Reconstruct how work actually moved",
    copy: "Sequence the observed events to see the real path through the project. Compare actual execution with the planned path and identify where work waited, repeated, moved backward or bypassed the expected sequence.",
  },
  {
    title: "Detect recurring friction patterns",
    copy: "Look for blocked work, long dependency waits, repeated rework, slow decisions, handoff gaps, stalled tasks and increasing divergence from the schedule or milestone baseline.",
  },
  {
    title: "Separate the symptom from the likely cause",
    copy: "A late task is a symptom. Investigate what preceded it: unresolved dependency, approval wait, resource constraint, requirement change, rework loop or an upstream task that finished later than expected. Keep inference separate from observed fact.",
  },
  {
    title: "Trace downstream impact",
    copy: "Identify which tasks, milestones and workstreams depend on the friction point. The highest-priority problem is not always the most delayed item; it may be the one with the largest downstream blast radius.",
  },
  {
    title: "Prioritize evidence-backed intervention",
    copy: "Rank friction by severity, confidence, persistence and downstream leverage. Prefer interventions supported by traceable evidence, especially when the same pattern appears repeatedly or affects critical work.",
  },
  {
    title: "Remeasure after the intervention",
    copy: "After action is taken, compare the next execution window with the prior one. Verify whether waiting, rework, blocker age or dependency delay actually decreased. If it did not, revisit the diagnosis instead of declaring success.",
  },
];

const signals = [
  {
    signal: "Blocked work",
    question: "Is work unable to progress even though it should be active?",
    evidence: "Blocked-state duration, blocker events, unresolved inputs or approvals.",
  },
  {
    signal: "Dependency waiting",
    question: "Is downstream work ready but waiting for an upstream output?",
    evidence: "Predecessor completion, successor readiness, dependency lag and start delay.",
  },
  {
    signal: "Rework",
    question: "Is completed or reviewed work repeatedly moving backward?",
    evidence: "Reopened tasks, repeated status transitions, corrective cycles and revisions.",
  },
  {
    signal: "Decision latency",
    question: "Is execution paused while a decision or approval remains unresolved?",
    evidence: "Decision request time, approval time, blocked work during the interval.",
  },
  {
    signal: "Handoff delay",
    question: "Does time accumulate between one team finishing and the next starting?",
    evidence: "Completion-to-start gaps across linked tasks, teams or workstreams.",
  },
  {
    signal: "Schedule divergence",
    question: "Is actual execution increasingly departing from the expected sequence or dates?",
    evidence: "Baseline variance, milestone movement, actual-vs-planned duration and sequence changes.",
  },
];

const faq = [
  {
    q: "How do you detect project friction?",
    a: "Detect project friction by comparing actual execution evidence with the expected project flow. Look for measurable waiting, blockers, rework, decision latency, handoff delay, dependency delay and schedule divergence, then trace each signal to evidence and downstream impact.",
  },
  {
    q: "What data is needed to detect project friction?",
    a: "Useful inputs include timestamped task status changes, planned and actual dates, milestones, dependencies, blockers, approvals, decisions, reopens, time entries and other execution events. More complete event history produces a stronger diagnosis, but missing data should remain unknown rather than being treated as zero friction.",
  },
  {
    q: "Is an overdue task the same as project friction?",
    a: "No. An overdue task is an outcome or symptom. Project friction describes execution resistance that may contribute to the delay, such as waiting on a dependency, rework, a slow approval, a blocker or a difficult handoff.",
  },
  {
    q: "How can a PMO find systemic project friction?",
    a: "A PMO can compare friction patterns across projects and look for recurring waits, rework loops, approval delays, handoff problems or dependency bottlenecks. Repeated patterns across projects are more likely to indicate a systemic execution problem than a one-off delay.",
  },
  {
    q: "Can process mining detect project friction?",
    a: "Process-mining techniques can reconstruct observed project execution from timestamped events and expose deviations, loops, waiting and bottlenecks. These patterns can then be evaluated as candidate friction signals and validated against project evidence.",
  },
  {
    q: "How does ProjectOps360 detect project friction?",
    a: "ProjectOps360 uses Process Mining to reconstruct observed execution, Friction Radar to identify evidence-backed friction signals, and the Living Graph to show dependencies and downstream impact. The system keeps observed facts, inferences and unknowns distinct.",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Detect Project Friction: An Evidence-Based Diagnostic Guide",
    description:
      "An eight-step method for detecting execution friction in projects using actual events, dependencies, baselines and traceable evidence.",
    datePublished: "2026-08-22",
    dateModified: "2026-08-22",
    mainEntityOfPage: canonicalUrl,
    author: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
    publisher: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
    about: [
      "Project Friction",
      "Project Friction Detection",
      "Project Execution Intelligence",
      "Process Mining for Project Management",
      "Project Bottleneck Detection",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Detect Project Friction",
    description:
      "Detect project friction by comparing expected execution with actual evidence, validating friction patterns and tracing downstream impact.",
    totalTime: "PT30M",
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.copy,
      url: `${canonicalUrl}#step-${index + 1}`,
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ProjectOps360", item: "https://projectops360.com/landing" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Project Friction Intelligence",
        item: "https://projectops360.com/project-friction-intelligence",
      },
      { "@type": "ListItem", position: 3, name: "How to Detect Project Friction", item: canonicalUrl },
    ],
  },
];

function EyebrowTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{title}</h2>
      {copy ? <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{copy}</p> : null}
    </div>
  );
}

export default function HowToDetectProjectFrictionPage() {
  return (
    <>
      <AcquisitionCapture />
      {jsonLd.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
            <Link href="/landing" className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
              ProjectOps360°
            </Link>
            <nav className="flex items-center gap-3" aria-label="Primary">
              <Link
                href="/project-friction-intelligence"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline"
              >
                Friction Intelligence
              </Link>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline"
              >
                Log in
              </Link>
              <Link href="/signup" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                Start free
              </Link>
            </nav>
          </div>
        </header>

        <main>
          <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 via-white to-white dark:border-slate-800 dark:from-emerald-950/30 dark:via-slate-950 dark:to-slate-950">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
              <div className="max-w-4xl">
                <p className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300">
                  Practical Project Execution Guide
                </p>
                <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                  How to Detect Project Friction
                </h1>
                <p className="mt-7 max-w-3xl text-xl leading-9 text-slate-700 dark:text-slate-300 sm:text-2xl">
                  Compare how work was expected to move with how it actually moved. Then isolate waiting, blockers, rework, decision delays and dependency effects using traceable evidence.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a href="#method" className="rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
                    Use the 8-step method
                  </a>
                  <Link
                    href="/project-friction-intelligence"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                  >
                    What is Project Friction Intelligence?
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <EyebrowTitle
              eyebrow="Answer first"
              title="The shortest reliable way to find project friction"
              copy="Do not start by asking which task is late. Start by comparing the expected execution path with timestamped evidence of what actually happened. Friction appears where work repeatedly waits, stops, loops, moves backward or diverges from the expected flow."
            />
            <div className="mt-10 max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">Core diagnostic formula</p>
              <p className="mt-3 text-xl leading-9 text-slate-800 dark:text-slate-200">
                <strong>Expected flow</strong> → <strong>Observed events</strong> → <strong>Deviation or waiting pattern</strong> → <strong>Evidence-backed friction signal</strong> → <strong>Downstream impact</strong>
              </p>
            </div>
          </section>

          <section id="method" className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <EyebrowTitle
                eyebrow="Diagnostic method"
                title="8 steps to detect project friction"
                copy="The method is deliberately evidence-first. It is designed to prevent a late status from being mistaken for a root cause."
              />
              <div className="mt-12 max-w-5xl space-y-5">
                {steps.map((step, index) => (
                  <article
                    id={`step-${index + 1}`}
                    key={step.title}
                    className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[56px_1fr] sm:p-7"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{step.title}</h3>
                      <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{step.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <EyebrowTitle
              eyebrow="Signal checklist"
              title="What to look for in the execution data"
              copy="A friction candidate becomes useful when it can be connected to an observable pattern and supporting evidence."
            />
            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="hidden grid-cols-[180px_1fr_1fr] bg-slate-950 text-sm font-semibold text-white md:grid">
                <div className="p-4">Signal</div>
                <div className="border-l border-slate-800 p-4">Diagnostic question</div>
                <div className="border-l border-slate-800 p-4">Evidence to inspect</div>
              </div>
              <div className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {signals.map((item) => (
                  <div key={item.signal} className="grid gap-3 p-5 md:grid-cols-[180px_1fr_1fr] md:gap-0 md:p-0">
                    <div className="font-semibold text-slate-950 dark:text-white md:p-4">{item.signal}</div>
                    <div className="leading-7 text-slate-600 dark:text-slate-300 md:border-l md:border-slate-200 md:p-4 dark:md:border-slate-800">
                      {item.question}
                    </div>
                    <div className="leading-7 text-slate-600 dark:text-slate-300 md:border-l md:border-slate-200 md:p-4 dark:md:border-slate-800">
                      {item.evidence}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-950 text-white dark:border-slate-800">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <EyebrowTitle
                eyebrow="Root-cause discipline"
                title="Do not confuse the symptom with the cause"
                copy="The task that appears late on the dashboard may be where the problem became visible, not where it started."
              />
              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                <article className="rounded-3xl border border-slate-800 bg-slate-900 p-7">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Symptom</p>
                  <h3 className="mt-3 text-xl font-semibold">Task finished 5 days late</h3>
                  <p className="mt-3 leading-7 text-slate-300">This tells you the outcome, not why it happened.</p>
                </article>
                <article className="rounded-3xl border border-amber-900/60 bg-amber-950/20 p-7">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-400">Candidate friction</p>
                  <h3 className="mt-3 text-xl font-semibold">4-day approval wait + rework loop</h3>
                  <p className="mt-3 leading-7 text-slate-300">This is an execution pattern that can be verified against events.</p>
                </article>
                <article className="rounded-3xl border border-emerald-900/60 bg-emerald-950/20 p-7">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-400">Impact context</p>
                  <h3 className="mt-3 text-xl font-semibold">Three downstream tasks could not start</h3>
                  <p className="mt-3 leading-7 text-slate-300">Dependencies explain why this friction point deserves attention.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <EyebrowTitle
              eyebrow="Data requirements"
              title="Minimum evidence for a useful friction diagnosis"
              copy="You do not need perfect data, but the diagnosis should be explicit about what is observed, what is inferred and what remains unknown."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["Status history", "Timestamped task or work-item transitions."],
                ["Planned vs actual dates", "A baseline for schedule divergence and waiting."],
                ["Dependencies", "Predecessor/successor relationships and lag."],
                ["Blockers", "When work became blocked, why, and when it was resolved."],
                ["Decisions and approvals", "Request and resolution timing for execution gates."],
                ["Rework evidence", "Reopens, repeated reviews, revisions or backward transitions."],
                ["Milestones", "Expected execution gates and target dates."],
                ["Time or effort records", "Useful for identifying effort overrun and stalled execution."],
                ["Source traceability", "A reference back to the event, record or evidence that supports the signal."],
              ].map(([title, copy]) => (
                <article key={title} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <EyebrowTitle eyebrow="Common mistakes" title="Five ways friction analysis goes wrong" />
              <div className="mt-10 max-w-4xl space-y-4">
                {[
                  "Treating every overdue task as a root cause instead of an outcome.",
                  "Blaming an individual when the evidence shows a dependency, approval or process-design problem.",
                  "Assuming missing data means zero friction instead of marking the result unknown or insufficient evidence.",
                  "Using a single global score without exposing the underlying signals and evidence.",
                  "Treating correlation or sequence as proof of causality when no explicit causal evidence exists.",
                ].map((item, index) => (
                  <div key={item} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {index + 1}
                    </span>
                    <p className="font-medium leading-7 text-slate-800 dark:text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <EyebrowTitle
              eyebrow="Automation"
              title="How ProjectOps360 turns the method into Project Execution Intelligence"
              copy="The manual diagnostic method maps directly to the three analytical layers used by ProjectOps360."
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">1 · Process Mining</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Reconstruct actual execution</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Use timestamped project events to rebuild observed execution and compare it with expected flow.</p>
              </article>
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">2 · Friction Radar</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Detect evidence-backed signals</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Surface waiting, blockers, rework, schedule variance and other friction candidates without turning missing evidence into false certainty.</p>
              </article>
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">3 · Living Graph</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Trace downstream impact</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Connect the friction point to milestones, tasks and dependencies so leaders can see what else may be affected.</p>
              </article>
            </div>
            <div className="mt-8">
              <Link href="/project-friction-intelligence" className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
                Read the Project Friction Intelligence pillar →
              </Link>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-emerald-50 dark:border-slate-800 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <EyebrowTitle eyebrow="FAQ" title="Questions about detecting project friction" />
              <div className="mt-10 max-w-4xl divide-y divide-slate-200 dark:divide-slate-800">
                {faq.map((item) => (
                  <article key={item.q} className="py-6 first:pt-0">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{item.q}</h3>
                    <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">{item.a}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="rounded-3xl bg-slate-950 px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">ProjectOps360</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Stop at the friction — not just the late task.</h2>
                <p className="mt-4 leading-7 text-slate-300">
                  Reconstruct execution, inspect the evidence and see which dependencies can carry the problem downstream.
                </p>
              </div>
              <div className="mt-8 flex shrink-0 gap-3 lg:mt-0 lg:pl-10">
                <Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400">
                  Analyze your project
                </Link>
                <Link href="/landing" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-900">
                  Explore platform
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>© 2026 ProjectOps360°. Project Execution Intelligence.</p>
            <Link href="/project-friction-intelligence" className="font-medium hover:text-slate-900 dark:hover:text-white">
              Project Friction Intelligence
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
