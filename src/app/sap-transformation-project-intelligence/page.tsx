import type { Metadata } from "next";
import Link from "next/link";
import { AcquisitionCapture } from "@/components/analytics/acquisition-capture";

const canonicalUrl = "https://projectops360.com/sap-transformation-project-intelligence";

export const metadata: Metadata = {
  title: "SAP Transformation Project Intelligence | ProjectOps360",
  description:
    "Learn how project intelligence can help SAP transformation leaders detect execution friction, dependency exposure, rework, readiness drift and downstream impact across complex programs.",
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: canonicalUrl,
    title: "SAP Transformation Project Intelligence — See How the Program Is Actually Executing",
    description:
      "A practical framework for SAP transformation leaders using execution evidence, process mining, friction detection and dependency intelligence across workstreams.",
    siteName: "ProjectOps360",
  },
  twitter: {
    card: "summary_large_image",
    title: "SAP Transformation Project Intelligence | ProjectOps360",
    description:
      "Detect execution friction, cross-workstream dependencies and downstream exposure before they become late SAP milestones.",
  },
};

const signals = [
  {
    title: "Cross-workstream dependency congestion",
    text: "Multiple teams are waiting on the same design decision, data object, interface, environment, approval or predecessor deliverable.",
  },
  {
    title: "Testing and defect rework loops",
    text: "Work repeatedly cycles through retest, reopen, remediation and validation instead of progressing toward exit criteria.",
  },
  {
    title: "Data migration readiness drift",
    text: "Cleansing, mapping, conversion, reconciliation or sign-off activity is moving away from the expected readiness path.",
  },
  {
    title: "Decision and approval latency",
    text: "Architecture, scope, governance or business decisions remain unresolved while dependent work accumulates waiting time.",
  },
  {
    title: "Integration bottlenecks",
    text: "Interfaces, external systems or shared technical dependencies become concentration points for blocked or delayed work.",
  },
  {
    title: "Cutover exposure",
    text: "Critical tasks, dependencies or unresolved readiness conditions are converging on the cutover window with insufficient margin.",
  },
];

const steps = [
  {
    title: "Define the transformation execution model",
    text: "Map the major workstreams, milestones, decision gates, expected handoffs and critical dependencies that represent how the SAP program is intended to execute.",
  },
  {
    title: "Collect timestamped project evidence",
    text: "Use task history, milestone movement, dependencies, blockers, decisions, approvals, defects, testing cycles, readiness records, planned and actual dates and other traceable execution events.",
  },
  {
    title: "Reconstruct observed execution",
    text: "Sequence the evidence to show how work actually moved across workstreams rather than relying only on current status, percent complete or manually reported traffic lights.",
  },
  {
    title: "Compare expected and observed flow",
    text: "Look for waiting, loops, repeated handoffs, skipped gates, schedule divergence and recurring patterns that show where execution differs from the transformation plan.",
  },
  {
    title: "Detect candidate friction",
    text: "Surface recurring blockers, rework, decision latency, dependency waiting and readiness drift as signals for investigation. Treat signals as evidence to examine, not automatic proof of root cause.",
  },
  {
    title: "Trace downstream program impact",
    text: "Connect each material friction point to the tasks, milestones and workstreams that depend on it so the program can see potential propagation toward testing, deployment or cutover.",
  },
  {
    title: "Prioritize intervention",
    text: "Use severity, evidence confidence, persistence, milestone exposure and dependency blast radius to decide which issues deserve program leadership attention first.",
  },
  {
    title: "Intervene and remeasure",
    text: "After an action is taken, inspect the next execution window to verify whether waiting, rework or dependency exposure actually improved.",
  },
];

const workstreams = [
  ["Process design", "Decisions, scope changes, approvals and handoffs"],
  ["Data migration", "Mapping, cleansing, conversion, reconciliation and sign-off"],
  ["Integrations", "Interfaces, external systems, shared dependencies and validation"],
  ["Testing", "Cycles, defects, rework, retesting and exit criteria"],
  ["Security & roles", "Design, approvals, provisioning and readiness dependencies"],
  ["Change & training", "Content readiness, stakeholder dependencies and adoption preparation"],
  ["Cutover", "Critical sequence, readiness gates, owners and predecessor completion"],
  ["PMO / governance", "Milestones, decisions, risks, dependencies and intervention evidence"],
];

const faq = [
  {
    q: "What is SAP transformation project intelligence?",
    a: "SAP transformation project intelligence is the use of traceable project execution evidence to understand how a transformation is actually progressing across workstreams, where execution is diverging from the plan, which friction patterns are recurring, and what downstream milestones or dependencies may be exposed.",
  },
  {
    q: "How is project intelligence different from an SAP project status dashboard?",
    a: "A status dashboard summarizes current KPIs, milestone health and reported state. Project intelligence also analyzes execution history and dependency context to show how the program reached its current condition, where work waited or repeated, and which connected activities may be affected next.",
  },
  {
    q: "What execution signals matter in an SAP transformation?",
    a: "Useful signals include cross-workstream dependency waiting, repeated defects or retesting, data migration readiness drift, unresolved decisions, integration bottlenecks, milestone divergence and cutover dependencies that are losing schedule margin.",
  },
  {
    q: "Can project intelligence automatically prove the root cause of an SAP delay?",
    a: "No. Project intelligence can expose patterns and evidence that support root-cause investigation, but sequence, correlation or repeated occurrence should not automatically be presented as proven causality without supporting evidence and accountable review.",
  },
  {
    q: "Does SAP transformation project intelligence require direct access to the SAP system?",
    a: "Not necessarily. Project intelligence can begin with project execution evidence such as schedules, task history, milestones, dependencies, blockers, decisions, defects, readiness records and other timestamped program data. The quality of conclusions depends on the quality and completeness of the available evidence.",
  },
  {
    q: "How does ProjectOps360 approach SAP transformation intelligence?",
    a: "ProjectOps360 combines Process Mining to reconstruct observed project execution, Friction Radar to surface evidence-backed friction signals, and the Living Graph to show dependencies and downstream impact. The objective is to give transformation leaders traceable Project Execution Intelligence across complex programs.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "SAP Transformation Project Intelligence: See How the Program Is Actually Executing",
  description:
    "A practical framework for SAP transformation leaders using execution evidence, process mining, friction detection and dependency intelligence across complex programs.",
  datePublished: "2026-08-22",
  dateModified: "2026-08-22",
  mainEntityOfPage: canonicalUrl,
  author: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
  publisher: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
  about: [
    "SAP Transformation Project Intelligence",
    "SAP Transformation Management",
    "SAP Program Management",
    "Project Execution Intelligence",
    "Process Mining for PMO",
    "Project Friction Intelligence",
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Apply Project Intelligence to an SAP Transformation",
  description:
    "An eight-step evidence-based method for understanding execution friction and dependency exposure across an SAP transformation program.",
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
    { "@type": "ListItem", position: 3, name: "SAP Transformation Project Intelligence", item: canonicalUrl },
  ],
};

export default function SapTransformationProjectIntelligencePage() {
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
              <Link href="/process-mining-for-pmo" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline">
                Process Mining for PMO
              </Link>
              <Link href="/ai-pmo-portfolio-risk-management" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white md:inline">
                AI Portfolio Risk
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
              <div className="max-w-5xl">
                <p className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300">
                  SAP Transformation · Project Execution Intelligence
                </p>
                <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                  SAP Transformation Project Intelligence
                </h1>
                <p className="mt-7 max-w-4xl text-xl leading-9 text-slate-700 dark:text-slate-300 sm:text-2xl">
                  See how the transformation is actually executing across workstreams. Detect recurring friction, understand dependency exposure and trace what a problem can affect before it becomes another late milestone.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a href="#method" className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">
                    See the 8-step method
                  </a>
                  <Link href="/project-friction-intelligence" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                    Explore Friction Intelligence
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Answer first</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">What is SAP transformation project intelligence?</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                SAP transformation project intelligence turns traceable execution history into an evidence-based view of how the program is really moving. It helps leaders compare expected and observed flow, investigate recurring friction and understand which connected milestones or workstreams may be exposed next.
              </p>
            </div>
            <div className="mt-10 max-w-5xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">Transformation intelligence chain</p>
              <p className="mt-3 text-xl leading-9 text-slate-800 dark:text-slate-200">
                <strong>Program Plan</strong> → <strong>Execution Events</strong> → <strong>Observed Flow</strong> → <strong>Friction Evidence</strong> → <strong>Dependencies</strong> → <strong>Downstream Exposure</strong>
              </p>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Execution signals</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Signals that deserve attention before the program reports another delay</h2>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">These are investigation signals, not automatic causal findings. Their importance depends on persistence, evidence quality and dependency context.</p>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {signals.map((signal) => (
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
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">An 8-step project intelligence method for SAP transformations</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">The method is evidence-first. It preserves human accountability while making execution patterns and dependency exposure easier to detect and explain.</p>
            </div>
            <div className="mt-12 max-w-5xl space-y-5">
              {steps.map((step, index) => (
                <article key={step.title} className="grid gap-4 rounded-3xl border border-slate-200 p-6 dark:border-slate-800 sm:grid-cols-[56px_1fr] sm:p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{index + 1}</div>
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Status reporting vs execution intelligence</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">A SAP status report tells you what is red. Project intelligence investigates the execution path that made it red.</h2>
              <div className="mt-10 overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-2 bg-slate-900 text-sm font-semibold"><div className="p-4">Traditional program view</div><div className="border-l border-slate-800 p-4 text-emerald-300">Project-intelligence view</div></div>
                {[
                  ["Testing is behind", "Where are defects, retesting or dependency waits repeatedly consuming cycle time?"],
                  ["Data migration is at risk", "Which readiness activities are drifting and which downstream milestones depend on them?"],
                  ["Integration milestone is red", "Is one interface, decision or shared technical dependency creating concentrated waiting?"],
                  ["Cutover readiness is yellow", "Which unresolved predecessors and critical dependencies are losing schedule margin?"],
                  ["Business decision is open", "How much downstream work is currently waiting on the unresolved decision?"],
                ].map(([left, right]) => (
                  <div key={left} className="grid grid-cols-2 border-t border-slate-800 text-sm sm:text-base"><div className="p-4 text-slate-300">{left}</div><div className="border-l border-slate-800 p-4 text-white">{right}</div></div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Workstream coverage</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">One execution model across connected transformation workstreams</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">The objective is not to flatten every workstream into one score. It is to preserve workstream evidence while making cross-workstream dependencies and handoffs visible.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workstreams.map(([title, text]) => (
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
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Separate what happened from what the program is inferring</h2>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  ["Observed", "A timestamped event, state, dependency, decision or milestone change traceable to project evidence."],
                  ["Inferred", "A likely explanation supported by patterns but not yet proven as the causal reason for the issue."],
                  ["Predicted", "A forward-looking estimate of possible downstream exposure that must remain labeled as a prediction."],
                  ["Unknown", "A question the available project evidence cannot answer. Missing evidence is not proof of zero risk or zero friction."],
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
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Process Mining → Friction Radar → Living Graph</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">ProjectOps360 approaches SAP transformation management as an execution-intelligence problem: reconstruct how work actually moved, surface evidence-backed friction, then show the dependencies and milestones connected to the issue.</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800"><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">1 · Process Mining</p><h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Reconstruct observed execution</h3><p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Compare expected transformation flow with timestamped project execution evidence.</p></article>
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800"><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">2 · Friction Radar</p><h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Detect recurring friction</h3><p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Surface waiting, blockers, rework, decision latency and execution divergence with evidence.</p></article>
              <article className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800"><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">3 · Living Graph</p><h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">See downstream impact</h3><p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Connect friction to tasks, milestones, workstreams and dependencies that may be affected next.</p></article>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
              <Link href="/process-mining-for-pmo" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">Process Mining for PMO →</Link>
              <Link href="/project-friction-intelligence" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">Project Friction Intelligence →</Link>
              <Link href="/ai-pmo-portfolio-risk-management" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">AI PMO Portfolio Risk →</Link>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-emerald-50 dark:border-slate-800 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">FAQ</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">SAP transformation project intelligence questions</h2>
              </div>
              <div className="mt-10 max-w-4xl divide-y divide-slate-200 dark:divide-slate-800">
                {faq.map((item) => (
                  <article key={item.q} className="py-6 first:pt-0"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">{item.q}</h3><p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">{item.a}</p></article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="rounded-3xl bg-slate-950 px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">ProjectOps360</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">See the execution problem before it becomes another SAP milestone delay.</h2><p className="mt-4 leading-7 text-slate-300">Reconstruct actual flow, detect evidence-backed friction and understand which dependencies can carry the problem downstream.</p></div>
              <div className="mt-8 flex shrink-0 gap-3 lg:mt-0 lg:pl-10"><Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400">Start free</Link><Link href="/landing" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-900">Explore platform</Link></div>
            </div>
            <p className="mt-6 text-xs leading-5 text-slate-500">ProjectOps360 is an independent product and is not affiliated with or endorsed by SAP SE.</p>
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
