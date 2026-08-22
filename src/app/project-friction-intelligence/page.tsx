import type { Metadata } from "next";
import Link from "next/link";
import { AcquisitionCapture } from "@/components/analytics/acquisition-capture";

const canonicalUrl = "https://projectops360.com/project-friction-intelligence";

export const metadata: Metadata = {
  title: "Project Friction Intelligence | Detect Why Projects Slow Down | ProjectOps360",
  description:
    "Project Friction Intelligence helps PMOs detect execution resistance, bottlenecks, rework, dependency delays and root causes before they become status-report surprises.",
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: canonicalUrl,
    title: "Project Friction Intelligence — Detect Why Projects Slow Down",
    description:
      "See how work actually flows, detect where execution is breaking down, understand why, and see what it will affect next.",
    siteName: "ProjectOps360",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Friction Intelligence | ProjectOps360",
    description:
      "Process Mining → Friction Radar → Living Graph. Project execution intelligence for PMOs and transformation programs.",
  },
};

const signals = [
  ["Blocked work", "Tasks remain unable to progress because a decision, dependency, input or resource is missing."],
  ["Dependency waiting", "Downstream work is ready but cannot start because upstream work has not produced the required output."],
  ["Rework", "Work repeatedly returns to an earlier state, is reopened, or requires corrective cycles."],
  ["Decision latency", "Execution pauses while approvals or decisions remain unresolved longer than expected."],
  ["Handoff delay", "Time accumulates between one team completing work and the next team beginning it."],
  ["Schedule divergence", "Observed execution increasingly departs from the planned sequence, duration or milestone path."],
];

const faq = [
  {
    q: "What is project friction?",
    a: "Project friction is measurable resistance inside project execution that causes work to move slower, repeat, wait, detour or stop. It can appear as blocked tasks, dependency waits, rework, slow decisions, handoff delays or repeated deviations from the expected flow.",
  },
  {
    q: "What is Project Friction Intelligence?",
    a: "Project Friction Intelligence is the practice of using execution evidence to detect friction, trace its likely cause, assess its impact and prioritize intervention. It focuses on why execution is degrading, not only on which task is late.",
  },
  {
    q: "How is Project Friction Intelligence different from project tracking?",
    a: "Project tracking records status, dates, owners and completion. Project Friction Intelligence analyzes the execution pattern behind those records to identify waiting, rework, bottlenecks, dependency effects and recurring causes of delay.",
  },
  {
    q: "Can process mining be used for project management?",
    a: "Yes. When project systems contain timestamped execution events, process-mining techniques can reconstruct observed flows and compare them with expected paths. This helps expose deviations, repeated loops, waiting and bottlenecks that are difficult to see in a static plan.",
  },
  {
    q: "How does ProjectOps360 detect project friction?",
    a: "ProjectOps360 combines Process Mining to reconstruct execution, Friction Radar to surface friction signals and evidence, and the Living Graph to show dependencies and downstream impact. The objective is to connect a signal to supporting evidence and the part of the project it can affect.",
  },
  {
    q: "Who should use Project Friction Intelligence?",
    a: "It is most useful for project and program managers, PMO leaders, transformation offices and SAP program teams managing complex work with many dependencies, handoffs, approvals and parallel workstreams.",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Project Friction Intelligence: Detect Why Projects Slow Down",
    description:
      "A practical definition and operating model for detecting execution resistance, bottlenecks, rework and dependency delays in complex projects.",
    datePublished: "2026-08-21",
    dateModified: "2026-08-21",
    mainEntityOfPage: canonicalUrl,
    author: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
    publisher: { "@type": "Organization", name: "ProjectOps360", url: "https://projectops360.com" },
    about: [
      "Project Friction Intelligence",
      "Project Execution Intelligence",
      "Process Mining for Project Management",
      "Project Bottleneck Detection",
      "Project Dependency Intelligence",
    ],
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
      { "@type": "ListItem", position: 2, name: "Project Friction Intelligence", item: canonicalUrl },
    ],
  },
];

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{title}</h2>
      {copy ? <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{copy}</p> : null}
    </div>
  );
}

export default function ProjectFrictionIntelligencePage() {
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
              <Link href="/landing" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline">
                Platform
              </Link>
              <Link href="/login" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline">
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
                  Project Execution Intelligence
                </p>
                <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                  Project Friction Intelligence
                </h1>
                <p className="mt-7 max-w-3xl text-xl leading-9 text-slate-700 dark:text-slate-300 sm:text-2xl">
                  Detect where project execution is slowing down, understand why it is happening, and see what the friction can affect next.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href="/signup" className="rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
                    Analyze your project
                  </Link>
                  <a href="#definition" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
                    Learn how it works
                  </a>
                </div>
              </div>

              <div className="mt-14 grid gap-4 md:grid-cols-3">
                {["See how work actually flows", "Detect where execution is breaking down", "Understand downstream impact"].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">0{index + 1}</p>
                    <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="definition" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <SectionTitle
              eyebrow="Definition"
              title="What is project friction?"
              copy="Project friction is measurable resistance inside execution that makes work wait, repeat, detour or stop. A late task is an outcome. Friction is the execution behavior that helps explain how the project got there."
            />
            <div className="mt-10 max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">Answer-first definition</p>
              <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-300">
                <strong>Project Friction Intelligence</strong> is the use of execution evidence to detect friction, trace its likely cause, evaluate its impact and prioritize intervention. It is designed to answer a question traditional status reporting often cannot: <strong>why is execution degrading?</strong>
              </p>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <SectionTitle eyebrow="Signals" title="What project friction looks like in execution data" />
              <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {signals.map(([name, description]) => (
                    <div key={name} className="grid gap-2 p-5 md:grid-cols-[220px_1fr] md:gap-8">
                      <h3 className="font-semibold text-slate-950 dark:text-white">{name}</h3>
                      <p className="leading-7 text-slate-600 dark:text-slate-300">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <SectionTitle
              eyebrow="Operating model"
              title="Process Mining → Friction Radar → Living Graph"
              copy="ProjectOps360 connects three analytical layers so a friction signal can be interpreted in context instead of appearing as another isolated warning."
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {[
                ["Process Mining", "Reconstruct the observed flow of work from project events and compare actual execution with the expected path."],
                ["Friction Radar", "Identify execution signals such as waiting, rework, bottlenecks, stalled work and repeated deviations, with supporting evidence."],
                ["Living Graph", "Map milestones, tasks and dependencies so teams can see what a friction point connects to and where impact can propagate."],
              ].map(([title, description], index) => (
                <article key={title} className="rounded-3xl border border-slate-200 p-7 dark:border-slate-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{index + 1}</div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-950 text-white dark:border-slate-800">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Why it matters</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">Traditional project software tells you what is late. Project Friction Intelligence focuses on why execution is struggling.</h2>
              <div className="mt-10 overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-2 bg-slate-900 text-sm font-semibold">
                  <div className="p-4">Traditional tracking question</div>
                  <div className="border-l border-slate-800 p-4 text-emerald-300">Friction intelligence question</div>
                </div>
                {[
                  ["Which tasks are late?", "What execution pattern is making work late?"],
                  ["What is the current status?", "Where is work waiting, looping or repeatedly deviating?"],
                  ["Which milestone is at risk?", "Which friction signals and dependencies are contributing to that risk?"],
                  ["Who owns the task?", "What evidence explains why the task cannot progress?"],
                  ["What changed?", "What is the likely downstream effect of the change?"],
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
            <SectionTitle
              eyebrow="Evidence"
              title="A friction signal should be traceable"
              copy="A useful signal is not just a score. It should lead a project leader back to the execution evidence that produced it."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["Observed event", "What happened and when?"],
                ["Expected state", "What should have happened according to the plan or flow?"],
                ["Friction signal", "What pattern indicates resistance or degradation?"],
                ["Impact context", "Which tasks, milestones or dependencies can be affected?"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl bg-slate-50 p-6 dark:bg-slate-900">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <SectionTitle eyebrow="Use cases" title="Where Project Friction Intelligence is most valuable" />
              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  ["PMO and portfolio leadership", "Surface recurring execution problems across projects and distinguish isolated delays from systemic friction."],
                  ["Transformation programs", "Trace cross-workstream dependencies, handoffs, approvals and emerging bottlenecks in complex change programs."],
                  ["SAP implementations", "Monitor dependency-heavy execution across design, build, test, data, integration, cutover and business-readiness workstreams."],
                  ["Program and project managers", "Move from reactive status reporting toward evidence-backed intervention on the work that is actually slowing execution."],
                ].map(([title, description]) => (
                  <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <SectionTitle eyebrow="Buyer guide" title="How to evaluate project-friction software" />
            <div className="mt-10 max-w-4xl space-y-4">
              {[
                "Can it reconstruct actual execution rather than relying only on current task status?",
                "Can every detected friction signal be traced to evidence?",
                "Can it distinguish waiting, rework, blockers and dependency-driven delay?",
                "Can it show how one friction point connects to downstream work?",
                "Can PMO leaders compare patterns across projects instead of reviewing projects one by one?",
                "Can the system separate observed facts from inferred or predicted risk?",
              ].map((question) => (
                <div key={question} className="flex gap-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">✓</span>
                  <p className="font-medium leading-7 text-slate-800 dark:text-slate-200">{question}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-emerald-50 dark:border-slate-800 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <SectionTitle eyebrow="FAQ" title="Project Friction Intelligence questions" />
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
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">See how work actually flows — not just how it was planned.</h2>
                <p className="mt-4 leading-7 text-slate-300">Use Process Mining, Friction Radar and the Living Graph to investigate execution problems with evidence and dependency context.</p>
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
            <Link href="/landing" className="font-medium hover:text-slate-900 dark:hover:text-white">projectops360.com</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
