import type { Metadata } from "next";
import Link from "next/link";

import { AcquisitionCapture } from "@/components/analytics/acquisition-capture";
import {
  buyerIntentPages,
  type BuyerIntentSlug,
} from "@/lib/authority/buyer-intent-pages";

const baseUrl = "https://projectops360.com";
const publishedDate = "2026-08-22";

export function buildBuyerIntentMetadata(slug: BuyerIntentSlug): Metadata {
  const page = buyerIntentPages[slug];
  const canonical = `${baseUrl}/${slug}`;

  return {
    title: `${page.title} | ProjectOps360`,
    description: page.metaDescription,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title: `${page.title} | ProjectOps360`,
      description: page.metaDescription,
      url: canonical,
      siteName: "ProjectOps360",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} | ProjectOps360`,
      description: page.metaDescription,
    },
  };
}

export function BuyerIntentPage({ slug }: { slug: BuyerIntentSlug }) {
  const page = buyerIntentPages[slug];
  const canonical = `${baseUrl}/${slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.metaDescription,
    datePublished: publishedDate,
    dateModified: publishedDate,
    mainEntityOfPage: canonical,
    author: {
      "@type": "Organization",
      name: "ProjectOps360",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "ProjectOps360",
      url: baseUrl,
    },
    about: [page.title, page.eyebrow, "Project Execution Intelligence"],
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: page.methodTitle,
    description: page.methodIntro,
    step: page.method.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.body,
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ProjectOps360",
        item: `${baseUrl}/landing`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Project Friction Intelligence",
        item: `${baseUrl}/project-friction-intelligence`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.title,
        item: canonical,
      },
    ],
  };

  return (
    <>
      <AcquisitionCapture />
      {[articleJsonLd, howToJsonLd, faqJsonLd, breadcrumbJsonLd].map(
        (payload, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
          />
        ),
      )}

      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
            <Link
              href="/landing"
              className="text-lg font-bold tracking-tight text-slate-950 dark:text-white"
            >
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
                href="/process-mining-for-pmo"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white md:inline"
              >
                Process Mining for PMO
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
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
                  {page.eyebrow}
                </p>
                <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                  {page.title}
                </h1>
                <p className="mt-7 max-w-4xl text-xl leading-9 text-slate-700 dark:text-slate-300 sm:text-2xl">
                  {page.hero}
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a
                    href="#method"
                    className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
                  >
                    See the method
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
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                Answer first
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {page.answerTitle}
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                {page.answer}
              </p>
            </div>
            <div className="mt-10 max-w-6xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                Execution intelligence chain
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200 sm:text-lg">
                {page.chain.map((item, index) => (
                  <span key={item} className="flex items-center gap-2">
                    <span>{item}</span>
                    {index < page.chain.length - 1 ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        →
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  Execution signals
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  {page.signalsTitle}
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                  {page.signalsIntro}
                </p>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {page.signals.map((signal) => (
                  <article
                    key={signal.title}
                    className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                      {signal.title}
                    </h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                      {signal.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            id="method"
            className="mx-auto max-w-7xl px-6 py-20 lg:px-8"
          >
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                Operating method
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {page.methodTitle}
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                {page.methodIntro}
              </p>
            </div>
            <div className="mt-12 max-w-5xl space-y-5">
              {page.method.map((step, index) => (
                <article
                  key={step.title}
                  className="grid gap-4 rounded-3xl border border-slate-200 p-6 dark:border-slate-800 sm:grid-cols-[56px_1fr] sm:p-7"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-950 text-white dark:border-slate-800">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Comparison
              </p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {page.comparisonTitle}
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                {page.comparisonIntro}
              </p>
              <div className="mt-10 overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-2 bg-slate-900 text-sm font-semibold">
                  <div className="p-4">{page.comparisonHeaders[0]}</div>
                  <div className="border-l border-slate-800 p-4 text-emerald-300">
                    {page.comparisonHeaders[1]}
                  </div>
                </div>
                {page.comparison.map((row) => (
                  <div
                    key={row.left}
                    className="grid grid-cols-2 border-t border-slate-800 text-sm sm:text-base"
                  >
                    <div className="p-4 text-slate-300">{row.left}</div>
                    <div className="border-l border-slate-800 p-4 text-white">
                      {row.right}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                Buyer evaluation
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {page.decisionTitle}
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                {page.decisionIntro}
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {page.decisionPoints.map((point) => (
                <article
                  key={point.title}
                  className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800"
                >
                  <h3 className="font-semibold text-slate-950 dark:text-white">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {point.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  ProjectOps360 model
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Process Mining → Friction Radar → Living Graph
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                  ProjectOps360 approaches execution problems as an evidence
                  chain: reconstruct what actually happened, surface recurring
                  friction, then connect the problem to dependencies and
                  downstream impact.
                </p>
              </div>
              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                <article className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    1 · Process Mining
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
                    Reconstruct actual execution
                  </h3>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    Use timestamped project events to expose observed sequence,
                    waiting, loops and deviations.
                  </p>
                </article>
                <article className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    2 · Friction Radar
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
                    Surface evidence-backed friction
                  </h3>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    Detect recurring blockers, waiting, rework, decision latency
                    and schedule divergence without hiding the evidence.
                  </p>
                </article>
                <article className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    3 · Living Graph
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
                    See connected downstream impact
                  </h3>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    Trace material friction to tasks, milestones and dependencies
                    that may be affected next.
                  </p>
                </article>
              </div>
              <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
                {page.related.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    {item.label} →
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-slate-200 bg-emerald-50 dark:border-slate-800 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  FAQ
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  {page.title} questions
                </h2>
              </div>
              <div className="mt-10 max-w-4xl divide-y divide-slate-200 dark:divide-slate-800">
                {page.faq.map((item) => (
                  <article key={item.question} className="py-6 first:pt-0">
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                      {item.question}
                    </h3>
                    <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="rounded-3xl bg-slate-950 px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  ProjectOps360
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  See the execution evidence behind project status.
                </h2>
                <p className="mt-4 leading-7 text-slate-300">
                  Reconstruct actual flow, detect friction and understand what a
                  problem can affect next.
                </p>
              </div>
              <div className="mt-8 flex shrink-0 gap-3 lg:mt-0 lg:pl-10">
                <Link
                  href="/signup"
                  className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Start free
                </Link>
                <Link
                  href="/landing"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-900"
                >
                  Explore platform
                </Link>
              </div>
            </div>
            {page.disclaimer ? (
              <p className="mt-6 text-xs leading-5 text-slate-500">
                {page.disclaimer}
              </p>
            ) : null}
          </section>
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>© 2026 ProjectOps360°. Project Execution Intelligence.</p>
            <Link
              href="/project-friction-intelligence"
              className="font-medium hover:text-slate-900 dark:hover:text-white"
            >
              Project Friction Intelligence
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
