import type { Metadata } from "next";
import Link from "next/link";
import { AcquisitionCapture } from "@/components/analytics/acquisition-capture";

const canonicalUrl = "https://projectops360.com/process-mining-for-pmo";

export const metadata: Metadata = {
  title: "Process Mining for PMO | See How Projects Actually Flow | ProjectOps360",
  description:
    "Learn how PMOs can use process mining to reconstruct actual project execution, detect bottlenecks and rework, compare planned vs observed flow, and trace downstream impact.",
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: canonicalUrl,
    title: "Process Mining for PMO — See How Projects Actually Flow",
    description:
      "A practical guide to using process mining for PMO execution intelligence, bottleneck detection, conformance analysis and cross-project learning.",
    siteName: "ProjectOps360",
  },
  twitter: {
    card: "summary_large_image",
    title: "Process Mining for PMO | ProjectOps360",
    description:
      "Reconstruct actual project execution, expose friction and see which dependencies can carry problems downstream.",
  },
};

const pmUseCases = [
  {
    title: "Find recurring bottlenecks",
    text: "Identify where work repeatedly waits, stalls or accumulates across projects, workstreams or lifecycle stages.",
  },
  {
    title: "Detect rework loops",
    text: "Surface repeated backward transitions, reopened work and corrective cycles that consume time without moving execution forward.",
  },
  {
    title: "Measure handoff friction",
    text: "Inspect the time between one team completing work and the next team beginning the dependent activity.",
  },
  {
    title: "Compare planned vs actual flow",
    text: "Use the project plan as the expected path and compare it with the sequence reconstructed from observed execution events.",
  },
  {
    title: "Spot systemic PMO problems",
    text: "Separate one-off project issues from execution patterns that recur across a portfolio and may require governance or operating-model changes.",
  },
  {
    title: "Trace downstream impact",
    text: "Connect an execution problem to the tasks, milestones and dependencies that may be affected next.",
  },
];

const steps = [
  {
    title: "Define the expected execution model",
    text: "Identify the lifecycle, milestone sequence, critical dependencies, approval gates and expected handoffs that represent how the project is intended to run.",
  },
  {
    title: "Collect timestamped execution events",
    text: "Use task transitions, start and finish dates, blocker events, approvals, decisions, reopens, milestone changes, time entries and other traceable project events.",
  },
  {
    title: "Reconstruct the observed flow",
    text: "Sequence the events to show how work actually moved instead of relying only on the current status of each task.",
  },
  {
    title: "Compare observed flow with expected flow",
    text: "Look for waiting, loops, skipped stages, repeated transitions, long handoffs and divergence from the planned sequence or timing.",
  },
  {
    title: "Validate candidate friction with evidence",
    text: "Treat deviations as signals to investigate. Keep observed facts, inferred explanations and unknowns distinct so a sequence is not mistaken for proven causality.",
  },
  {
    title: "Prioritize by portfolio impact",
    text: "Use dependency context, milestone exposure, recurrence and confidence to decide which friction points deserve PMO intervention first.",
  },
];

const dataInputs = [
  ["Task history", "Timestamped status and ownership transitions"],
  ["Planned and actual dates", "Baseline, start, finish and duration evidence"],
  ["Dependencies", "Predecessor/successor relationships and lag"],
  ["Milestones", "Expected delivery gates and movement over time"],
  ["Blockers", "When work stopped, why and when it resumed"],
  ["Decisions and approvals", "Request-to-resolution timing for gates"],
  ["Rework events", "Reopens, revisions and backward transitions"],
  ["Time / effort", "Useful context for effort overrun and stalled work"],
];

const faq = [
  {
    q: "What is process mining for a PMO?",
    a: "Process mining for a PMO is the use of timestamped project execution events to reconstruct how work actually moved, compare the observed path with the expected project flow, and investigate bottlenecks, waiting, rework, handoff delays and other execution deviations.",
  },
  {
    q: "How is process mining different from a PMO dashboard?",
    a: "A PMO dashboard summarizes current state and KPIs. Process mining analyzes event sequences over time to show the path work took, where it waited or repeated, and how actual execution differed from the expected flow. The two approaches are complementary.",
  },
  {
    q: "What data does a PMO need for process mining?",
    a: "The most useful input is timestamped execution history: task transitions, planned and actual dates, dependencies, milestones, blockers, approvals, decisions, reopens and other events that can be tied back to a project or work item.",
  },
  {
    q: "Can process mining identify the root cause of a project delay?",
    a: "Process mining can expose the execution patterns that preceded a delay, such as waiting, rework or a dependency bottleneck. Those patterns are evidence for root-cause investigation, but sequence or correlation alone should not be presented as proven causality without supporting evidence.",
  },
  {
    q: "Can a PMO use process mining across multiple projects?",
    a: "Yes. When projects share comparable event definitions, a PMO can compare recurring patterns across a portfolio and distinguish isolated project issues from systemic execution friction.",
  },
  {
    q: "How does ProjectOps360 use process mining?",
    a: "ProjectOps360 uses Process Mining to reconstruct observed project execution, Friction Radar to surface evidence-backed friction signals, and the Living Graph to show dependencies and downstream impact. The objective is to turn project event history into traceable Project Execution Intelligence.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Process Mining for PMO: How to See How Projects Actually Flow",
  description:
    "A practical guide for PMOs using process mining to reconstruct actual project execution, compare planned and observed flow, and investigate recurring execution friction.",
  datePublished: "2026-08-22",
  dateModified: "2026-08-22",
  mainEntityOfPage: canonicalUrl,
  author: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
  publisher: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
  about: [
    "Process Mining for PMO",
    "Project Execution Intelligence",
    "PMO Analytics",
    "Project Bottleneck Detection",
    "Project Friction Intelligence",
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How a PMO Can Use Process Mining",
  description:
    "A six-step evidence-based method for applying process mining to project and portfolio execution.",
  step: steps.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.text,
  })),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const breadcrumbJsonLd = {
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
    { "@type": "ListItem", position: 3, name: "Process Mining for PMO", item: canonicalUrl },
  ],
};

export default function ProcessMiningForPmoPage() {
  return (
    <>
      <AcquisitionCapture />
      {[articleJsonLd, howToJsonLd, faqJsonLd, breadcrumbJsonLd].map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
                href="/how-to-detect-project-friction"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white md:inline"
              >
                Detection Guide
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
                  PMO · Project Execution Intelligence
                </p>
                <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                  Process Mining for PMO
                </h1>
                <p className="mt-7 max-w-3xl text-xl leading-9 text-slate-700 dark:text-slate-300 sm:text-2xl">
                  Reconstruct how projects actually execute, compare observed flow with the plan, and find recurring waiting, rework and bottlenecks before the PMO treats them as isolated status problems.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a href="#method" className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">
                    See the PMO method
                  </a>
                  <Link
                    href="/project-friction-intelligence"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    Explore Friction Intelligence
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Answer first</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                What does process mining give a PMO?
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Process mining gives a PMO a reconstruction of observed execution from timestamped project events. Instead of seeing only the latest status, the PMO can inspect the path work took, where it waited or repeated, and how that path differed from the expected project flow.
              </p>
            </div>
            <div className="mt-10 max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">PMO execution lens</p>
              <p className="mt-3 text-xl leading-9 text-slate-800 dark:text-slate-200">
                <strong>Plan</strong> → <strong>Events</strong> → <strong>Observed Flow</strong> → <strong>Deviation</strong> → <strong>Evidence</strong> → <strong>Portfolio Intervention</strong>
              </p>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">PMO use cases</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Where process mining changes the PMO conversation
                </h2>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {pmUseCases.map((item) => (
                  <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="method" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Operating method</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                How a PMO can apply process mining in six steps
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                The method is evidence-first. A deviation is a signal to investigate, not automatic proof of a root cause.
              </p>
            </div>
            <div className="mt-12 max-w-5xl space-y-5">
              {steps.map((step, index) => (
                <article key={step.title} className="grid gap-4 rounded-3xl border border-slate-200 p-6 dark:border-slate-800 sm:grid-cols-[56px_1fr] sm:p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{step.title}</h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-950 text-white dark:border-slate-800">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Dashboard vs execution intelligence</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">
                A dashboard tells the PMO what the project looks like now. Process mining explains how it got there.
              </h2>
              <div className="mt-10 overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-2 bg-slate-900 text-sm font-semibold">
                  <div className="p-4">Traditional PMO view</div>
                  <div className="border-l border-slate-800 p-4 text-emerald-300">Process-mining view</div>
                </div>
                {[
                  ["Task is overdue", "Where did execution wait or repeat before it became overdue?"],
                  ["Milestone is at risk", "Which observed execution paths and dependencies are contributing to the exposure?"],
                  ["Project is red", "Which friction patterns are recurring, and are they systemic across the portfolio?"],
                  ["Team reports a blocker", "How long has the blocked state existed and what dependent work is waiting?"],
                  ["Schedule variance increased", "Where did actual execution diverge from the expected path?"],
                ].map(([left, right]) => (
                  <div key={left} className="grid grid-cols-2 border-t border-slate-800 text-sm sm:text-base">
                    <div className="p-4 text-slate-300">{left}</div>
                    <div className="border-l border-slate-800 p-4 text-white">{right}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Data foundation</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                What project data a PMO needs
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Process mining does not require perfect data, but it does require traceable events. Missing history should remain unknown rather than being interpreted as proof that no friction exists.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {dataInputs.map(([title, text]) => (
                <article key={title} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Governance</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  PMO process mining should increase evidence, not false certainty
                </h2>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  ["Observed", "A timestamped event or state that can be traced back to project evidence."],
                  ["Inferred", "A likely explanation supported by patterns but not yet proven as causal."],
                  ["Predicted", "A forward-looking risk or impact estimate that should be labeled as such."],
                  ["Unknown", "A question the available data cannot answer. Missing evidence is not zero friction."],
                ].map(([title, text]) => (
                  <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">ProjectOps360 model</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Process Mining → Friction Radar → Living Graph
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                ProjectOps360 extends process reconstruction into a broader Project Execution Intelligence model so PMO leaders can move from observed flow to friction evidence and dependency impact.
              </p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {[
                ["1 · Process Mining", "Reconstruct observed execution and compare it with expected flow."],
                ["2 · Friction Radar", "Surface waiting, blockers, rework and other evidence-backed friction signals."],
                ["3 · Living Graph", "Show which milestones, tasks and dependencies connect to the friction point and where impact may propagate."],
              ].map(([title, text]) => (
                <article key={title} className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{title}</p>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
              <Link href="/project-friction-intelligence" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
                Project Friction Intelligence →
              </Link>
              <Link href="/how-to-detect-project-friction" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
                How to Detect Project Friction →
              </Link>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-emerald-50 dark:border-slate-800 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">FAQ</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Process mining for PMO questions
                </h2>
              </div>
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
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">See the execution pattern behind the status report.</h2>
                <p className="mt-4 leading-7 text-slate-300">
                  Reconstruct actual flow, detect friction with evidence and understand what the problem can affect next.
                </p>
              </div>
              <div className="mt-8 flex shrink-0 gap-3 lg:mt-0 lg:pl-10">
                <Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400">
                  Start free
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
