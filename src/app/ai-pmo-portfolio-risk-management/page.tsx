import type { Metadata } from "next";
import Link from "next/link";
import { AcquisitionCapture } from "@/components/analytics/acquisition-capture";

const canonicalUrl = "https://projectops360.com/ai-pmo-portfolio-risk-management";

export const metadata: Metadata = {
  title: "AI PMO Portfolio Risk Management | ProjectOps360",
  description:
    "Learn how AI can help PMOs detect portfolio risk from execution evidence, recurring friction, dependencies and downstream impact without turning weak signals into false certainty.",
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: canonicalUrl,
    title: "AI PMO Portfolio Risk Management — From Status Risk to Execution Evidence",
    description:
      "A practical framework for using AI, process mining and dependency intelligence to identify evidence-backed portfolio risk across projects.",
    siteName: "ProjectOps360",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI PMO Portfolio Risk Management | ProjectOps360",
    description:
      "Detect portfolio risk from execution evidence, friction patterns and dependency impact — not only red status reports.",
  },
};

const portfolioSignals = [
  {
    title: "Schedule drift",
    text: "Actual execution is moving farther from baseline dates, expected sequence or milestone timing.",
  },
  {
    title: "Dependency congestion",
    text: "Multiple downstream activities are waiting on the same predecessor, deliverable, decision or shared workstream.",
  },
  {
    title: "Recurring blockers",
    text: "The same blocker pattern appears repeatedly inside one project or across several projects in the portfolio.",
  },
  {
    title: "Rework loops",
    text: "Completed or reviewed work repeatedly moves backward, reopens or cycles through corrective activity.",
  },
  {
    title: "Decision latency",
    text: "Execution waits while approvals, governance decisions or escalations remain unresolved longer than expected.",
  },
  {
    title: "Cross-project exposure",
    text: "A problem in one project connects to milestones, resources or dependencies that affect other initiatives.",
  },
];

const steps = [
  {
    title: "Define the portfolio risk model",
    text: "Establish the outcomes, milestones, critical dependencies, risk categories and governance thresholds that matter to the PMO. AI needs an explicit operating context before a signal can be interpreted as material risk.",
  },
  {
    title: "Collect timestamped execution evidence",
    text: "Use project events such as status transitions, planned and actual dates, blockers, approvals, decisions, reopens, dependencies, milestones, time entries and other traceable execution records.",
  },
  {
    title: "Reconstruct how work is actually moving",
    text: "Analyze the observed sequence of work across projects instead of relying only on the latest status snapshot. This exposes waiting, loops, skipped stages and execution divergence.",
  },
  {
    title: "Generate candidate risk signals",
    text: "Surface schedule drift, recurring friction, dependency waiting, rework, decision latency and other patterns as candidates for investigation. A signal is not automatically a proven cause.",
  },
  {
    title: "Connect risk to dependencies and downstream impact",
    text: "Trace which tasks, milestones, workstreams and projects depend on the affected work so the PMO can see potential blast radius rather than treating every red item equally.",
  },
  {
    title: "Prioritize by severity, confidence and leverage",
    text: "Rank attention using the strength of evidence, persistence of the signal, business or milestone exposure and the amount of downstream work connected to the issue.",
  },
  {
    title: "Review, intervene and remeasure",
    text: "Keep accountable humans in the decision loop. After action is taken, compare the next execution window with the prior one and verify whether the underlying signal actually improved.",
  },
];

const governanceStates = [
  ["Observed", "A timestamped event, state or dependency that can be traced directly to project evidence."],
  ["Inferred", "A likely explanation supported by patterns, but not yet proven as the causal reason for the risk."],
  ["Predicted", "A forward-looking estimate of possible exposure that should be explicitly labeled as a prediction."],
  ["Unknown", "A question the available evidence cannot answer. Missing evidence should not be converted into a reassuring zero-risk result."],
];

const faq = [
  {
    q: "What is AI PMO portfolio risk management?",
    a: "AI PMO portfolio risk management uses project and portfolio data to identify risk signals, recurring execution friction, dependency exposure and patterns that may require PMO intervention. A responsible implementation keeps observed facts, inference, predictions and unknowns clearly separated.",
  },
  {
    q: "How can AI identify portfolio risk before a project turns red?",
    a: "AI can examine leading execution signals such as increasing schedule divergence, repeated blockers, dependency waiting, rework loops, slow decisions and recurring patterns across projects. These signals can indicate rising exposure before a traditional status summary changes to red, but they still need evidence and context.",
  },
  {
    q: "What is the difference between AI portfolio risk management and a PMO dashboard?",
    a: "A PMO dashboard typically summarizes current KPIs and reported status. AI portfolio risk management can analyze event history, recurring patterns and dependency relationships to help explain how risk is developing and which downstream work may be exposed.",
  },
  {
    q: "Can AI determine the root cause of portfolio risk automatically?",
    a: "AI can surface patterns and evidence that support root-cause investigation, but correlation, sequence and statistical association should not automatically be presented as proven causality. High-impact conclusions should remain traceable to evidence and human review.",
  },
  {
    q: "What data does a PMO need for AI portfolio risk management?",
    a: "Useful inputs include timestamped task history, planned and actual dates, milestones, dependencies, blockers, decisions, approvals, rework events, time or effort records, risk records and other execution evidence that can be traced back to a project or work item.",
  },
  {
    q: "How does ProjectOps360 approach AI portfolio risk management?",
    a: "ProjectOps360 combines Process Mining to reconstruct observed execution, Friction Radar to surface evidence-backed friction signals, and the Living Graph to show dependencies and downstream impact. This creates a Project Execution Intelligence layer that can support PMO portfolio risk decisions with traceable evidence.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AI PMO Portfolio Risk Management: From Status Risk to Execution Evidence",
  description:
    "A practical framework for PMOs using AI, process mining and dependency intelligence to identify evidence-backed portfolio risk.",
  datePublished: "2026-08-22",
  dateModified: "2026-08-22",
  mainEntityOfPage: canonicalUrl,
  author: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
  publisher: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
  about: [
    "AI PMO Portfolio Risk Management",
    "PMO Risk Management",
    "Project Portfolio Management",
    "Project Execution Intelligence",
    "Project Friction Intelligence",
    "Process Mining for PMO",
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How a PMO Can Use AI for Portfolio Risk Management",
  description:
    "A seven-step evidence-based method for applying AI and execution intelligence to portfolio risk management.",
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
    { "@type": "ListItem", position: 3, name: "AI PMO Portfolio Risk Management", item: canonicalUrl },
  ],
};

export default function AiPmoPortfolioRiskManagementPage() {
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
                href="/process-mining-for-pmo"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline"
              >
                Process Mining for PMO
              </Link>
              <Link
                href="/project-friction-intelligence"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white md:inline"
              >
                Friction Intelligence
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
                  AI · PMO · Portfolio Risk
                </p>
                <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                  AI PMO Portfolio Risk Management
                </h1>
                <p className="mt-7 max-w-3xl text-xl leading-9 text-slate-700 dark:text-slate-300 sm:text-2xl">
                  Move beyond reported red status. Use execution evidence, recurring friction and dependency context to identify where portfolio risk is developing and what it may affect next.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a href="#method" className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">
                    See the 7-step method
                  </a>
                  <Link
                    href="/process-mining-for-pmo"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    Process Mining for PMO
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Answer first</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                What should AI portfolio risk management do for a PMO?
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                AI portfolio risk management should help a PMO detect evidence-backed risk signals across projects, explain the execution patterns behind those signals, and connect the risk to dependencies and downstream exposure. It should not replace governance with a black-box score.
              </p>
            </div>
            <div className="mt-10 max-w-5xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">Portfolio risk intelligence chain</p>
              <p className="mt-3 text-xl leading-9 text-slate-800 dark:text-slate-200">
                <strong>Execution Events</strong> → <strong>Risk Signals</strong> → <strong>Evidence</strong> → <strong>Dependencies</strong> → <strong>Downstream Exposure</strong> → <strong>PMO Action</strong>
              </p>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Leading execution signals</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Risk signals to investigate before the status report catches up
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                  These patterns are candidates for PMO attention. Their meaning depends on severity, persistence, evidence quality and portfolio context.
                </p>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {portfolioSignals.map((signal) => (
                  <article key={signal.title} className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{signal.title}</h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{signal.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="method" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Operating method</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                A 7-step AI portfolio risk method for PMOs
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                The method keeps evidence and accountable decision-making at the center. AI accelerates detection and synthesis; it does not remove the risk owner.
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Traditional risk view vs execution intelligence</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">
                A risk register records what people know. Execution intelligence also looks for what the work is showing.
              </h2>
              <div className="mt-10 overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-2 bg-slate-900 text-sm font-semibold">
                  <div className="p-4">Traditional PMO risk view</div>
                  <div className="border-l border-slate-800 p-4 text-emerald-300">AI execution-intelligence view</div>
                </div>
                {[
                  ["Risk owner reports milestone concern", "Is actual execution already diverging from the milestone path?"],
                  ["Project is yellow or red", "Which recurring friction signals appeared before the status changed?"],
                  ["Dependency is listed", "How much downstream work is connected to the dependency and currently waiting?"],
                  ["Risk is scored high", "What evidence supports severity and how persistent is the signal?"],
                  ["Mitigation is marked complete", "Did execution measurably improve after the intervention?"],
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
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Risk prioritization</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Do not collapse portfolio risk into one opaque AI score
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                A useful PMO decision should expose the dimensions underneath the ranking so leaders can challenge the conclusion and inspect the evidence.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["Severity", "How material could the issue be to delivery, cost, scope or strategic outcome?"],
                ["Confidence", "How strong and complete is the evidence behind the signal?"],
                ["Persistence", "Is the pattern recurring or was it a one-time event?"],
                ["Blast radius", "How much downstream work or how many projects are connected to the issue?"],
              ].map(([title, text]) => (
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
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Evidence governance</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Separate what is known from what AI is inferring
                </h2>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {governanceStates.map(([title, text]) => (
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
                ProjectOps360 approaches portfolio risk as an execution-intelligence problem: reconstruct what actually happened, detect evidence-backed friction, then connect the issue to dependencies and downstream impact.
              </p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">1 · Process Mining</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Reconstruct actual execution</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Expose observed flow, waiting, loops and deviations across project event history.</p>
              </article>
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">2 · Friction Radar</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Surface risk-producing friction</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Identify recurring blockers, rework, schedule divergence and other evidence-backed friction signals.</p>
              </article>
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">3 · Living Graph</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">See downstream exposure</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Connect the risk signal to tasks, milestones and dependencies so PMO leaders can see where impact may propagate.</p>
              </article>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
              <Link href="/process-mining-for-pmo" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">Process Mining for PMO →</Link>
              <Link href="/project-friction-intelligence" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">Project Friction Intelligence →</Link>
              <Link href="/how-to-detect-project-friction" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">How to Detect Project Friction →</Link>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-emerald-50 dark:border-slate-800 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">FAQ</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">AI PMO portfolio risk management questions</h2>
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
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">See portfolio risk in the execution — not only in the status report.</h2>
                <p className="mt-4 leading-7 text-slate-300">Reconstruct actual flow, detect evidence-backed friction and understand which dependencies can carry the problem downstream.</p>
              </div>
              <div className="mt-8 flex shrink-0 gap-3 lg:mt-0 lg:pl-10">
                <Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400">Start free</Link>
                <Link href="/landing" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-900">Explore platform</Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>© 2026 ProjectOps360°. Project Execution Intelligence.</p>
            <Link href="/project-friction-intelligence" className="font-medium hover:text-slate-900 dark:hover:text-white">Project Friction Intelligence</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
