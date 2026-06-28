"use client";

// ============================================================================
// ProjectOps360° — Product Brain Control Center (client shell)
// ============================================================================
// The cockpit: decisions, regressions, UX contracts, modules, ADRs/CAPs, the
// test-protection map, and AI development guardrails — searchable, filterable,
// status-driven. All data arrives via props ONLY after the server route passed
// the strict email allowlist (TASK 10A); this component never fetches the
// registry itself. The canonical Product Brain markdown is embedded in the
// Documents tab (no capability removed).
// ============================================================================

import { useMemo, useState, useTransition } from "react";
import {
  Brain, Search, Download, X, ShieldCheck, TriangleAlert, FlaskConical,
  FileText, BookOpen, Boxes, Scale, Sparkles, ExternalLink, CircleAlert,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { ProductBrainDoc } from "@/lib/product-brain/loader";
import type { ProductBrainItem, ProductBrainItemType } from "@/lib/product-brain-center/types";
import {
  filterItems, summarize, listModules, needsTest, isProtectedByTest, isRegressionOpen,
  type ProductBrainFilter,
} from "@/lib/product-brain-center/select";
import { askIsabellaAboutItemAction, exportProductBrainAction } from "./actions";
import { ProductIntelligenceCenter } from "./product-intelligence-center";

const GITHUB_BASE = "https://github.com/projectops360-alt/projectops360/blob/master/docs/product-brain";

type Tab =
  | "dashboard" | "decisions" | "regressions" | "ux" | "modules"
  | "adrs" | "tests" | "guardrails" | "documents";

const TAB_TYPE: Partial<Record<Tab, ProductBrainItemType | ProductBrainItemType[]>> = {
  decisions: "product_decision",
  regressions: "regression",
  ux: "ux_contract",
  modules: "module",
  adrs: ["adr", "cap"],
};

export function ProductBrainControlCenter({
  locale, items, docs, initialDocId, isAdmin,
}: {
  locale: Locale;
  items: ProductBrainItem[];
  docs: ProductBrainDoc[];
  initialDocId: string | null;
  isAdmin: boolean;
}) {
  const es = locale === "es";
  const tt = (en: string, esT: string) => (es ? esT : en);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [active, setActive] = useState<ProductBrainItem | null>(null);

  const summary = useMemo(() => summarize(items), [items]);
  const modules = useMemo(() => listModules(items), [items]);

  const tabItems = useMemo(() => {
    const t = TAB_TYPE[tab];
    const base: ProductBrainFilter = { query, module: moduleFilter };
    let list = filterItems(items, base);
    if (t) {
      const types = Array.isArray(t) ? t : [t];
      list = list.filter((i) => types.includes(i.type));
    }
    return list;
  }, [items, tab, query, moduleFilter]);

  const tabs: { key: Tab; label: string; icon: typeof Brain }[] = [
    { key: "dashboard", label: tt("Dashboard", "Panel"), icon: Brain },
    { key: "decisions", label: tt("Decisions", "Decisiones"), icon: Scale },
    { key: "regressions", label: tt("Regressions", "Regresiones"), icon: TriangleAlert },
    { key: "ux", label: tt("UX Contracts", "Contratos UX"), icon: ShieldCheck },
    { key: "modules", label: tt("Modules", "Módulos"), icon: Boxes },
    { key: "adrs", label: "ADRs / CAPs", icon: BookOpen },
    { key: "tests", label: tt("Test Map", "Mapa de tests"), icon: FlaskConical },
    { key: "guardrails", label: tt("AI Guardrails", "Reglas IA"), icon: Sparkles },
    { key: "documents", label: tt("Documents", "Documentos"), icon: FileText },
  ];

  async function doExport() {
    const res = await exportProductBrainAction();
    if (!res.ok) return;
    const blob = new Blob([res.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-brain-status-report.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{tt("Product Brain Control Center", "Centro de Control del Product Brain")}</h1>
            <p className="text-sm text-muted-foreground">
              {tt("Track product decisions, regressions, UX contracts, modules, and protection status.",
                  "Rastrea decisiones de producto, regresiones, contratos UX, módulos y estado de protección.")}
            </p>
          </div>
        </div>
        <button onClick={doExport} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400">
          <Download className="h-4 w-4" />
          {tt("Export report", "Exportar reporte")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === key ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <Dashboard summary={summary} tt={tt} onJump={setTab} />}

      {tab === "guardrails" && <Guardrails items={items} tt={tt} />}

      {tab === "tests" && <TestMap items={items} tt={tt} onOpen={setActive} />}

      {tab === "documents" && (
        <div className="-m-6">
          <ProductIntelligenceCenter locale={locale} docs={docs} initialId={initialDocId} isAdmin={isAdmin} />
        </div>
      )}

      {/* Item-list tabs */}
      {["decisions", "regressions", "ux", "modules", "adrs"].includes(tab) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tt("Search by ID, title, module, keyword…", "Busca por ID, título, módulo, palabra…")}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">{tt("All modules", "Todos los módulos")}</option>
              {modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <ItemList items={tabItems} onOpen={setActive} tt={tt} />
        </div>
      )}

      {active && <DetailDrawer item={active} onClose={() => setActive(null)} tt={tt} />}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ summary, tt, onJump }: { summary: ReturnType<typeof summarize>; tt: (a: string, b: string) => string; onJump: (t: Tab) => void }) {
  const cards: { label: string; value: number; tone: string; tab?: Tab }[] = [
    { label: tt("Product decisions", "Decisiones"), value: summary.productDecisions, tone: "text-foreground", tab: "decisions" },
    { label: tt("Open regressions", "Regresiones abiertas"), value: summary.openRegressions, tone: summary.openRegressions > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", tab: "regressions" },
    { label: tt("Closed regressions", "Regresiones cerradas"), value: summary.closedRegressions, tone: "text-green-600 dark:text-green-400", tab: "regressions" },
    { label: tt("Protected by tests", "Protegidas por test"), value: summary.protectedByTest, tone: "text-green-600 dark:text-green-400", tab: "tests" },
    { label: tt("Needs test", "Falta test"), value: summary.needsTest, tone: summary.needsTest > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground", tab: "tests" },
    { label: tt("Needs review", "Requiere revisión"), value: summary.needsReview, tone: "text-amber-600 dark:text-amber-400" },
    { label: tt("High priority", "Alta prioridad"), value: summary.highPriority, tone: "text-foreground" },
    { label: tt("Modules with gaps", "Módulos con brechas"), value: summary.modulesWithGaps, tone: "text-foreground", tab: "modules" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={() => c.tab && onJump(c.tab)}
          className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-brand-500/50"
        >
          <p className={`text-2xl font-bold ${c.tone}`}>{c.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
        </button>
      ))}
    </div>
  );
}

// ── Item list ────────────────────────────────────────────────────────────────
function StatusBadge({ item }: { item: ProductBrainItem }) {
  const open = isRegressionOpen(item);
  const tone = open
    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
    : isProtectedByTest(item)
    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
    : item.status === "needs_review" || item.status === "needs_test"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>{item.status}</span>;
}

function TestBadge({ item }: { item: ProductBrainItem }) {
  const t = item.testStatus;
  const protectedT = isProtectedByTest(item);
  const tone = protectedT
    ? "text-green-600 dark:text-green-400"
    : needsTest(item)
    ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] ${tone}`}>
      {protectedT ? <ShieldCheck className="h-3 w-3" /> : needsTest(item) ? <CircleAlert className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
      {t}
    </span>
  );
}

function ItemList({ items, onOpen, tt }: { items: ProductBrainItem[]; onOpen: (i: ProductBrainItem) => void; tt: (a: string, b: string) => string }) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{tt("No items match.", "Ningún elemento coincide.")}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.itemKey}>
          <button onClick={() => onOpen(i)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-brand-500/50">
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{i.itemKey}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{i.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{i.module ?? "—"} · {i.summary}</span>
            </span>
            <TestBadge item={i} />
            <StatusBadge item={i} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Test Protection Map ───────────────────────────────────────────────────────
function TestMap({ items, tt, onOpen }: { items: ProductBrainItem[]; tt: (a: string, b: string) => string; onOpen: (i: ProductBrainItem) => void }) {
  const protectedItems = items.filter(isProtectedByTest);
  const needs = items.filter(needsTest);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-green-500/30 bg-green-500/[0.04] p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />{tt("Protected by tests", "Protegidas por test")} ({protectedItems.length})</h2>
        <ul className="space-y-1.5">
          {protectedItems.map((i) => (
            <li key={i.itemKey}>
              <button onClick={() => onOpen(i)} className="w-full text-left text-xs text-foreground hover:text-brand-600 dark:hover:text-brand-400">
                <span className="font-mono text-[10px] text-muted-foreground">{i.itemKey}</span> {i.title}
                {i.testFiles[0] && <span className="block truncate font-mono text-[10px] text-muted-foreground">{i.testFiles[0]}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><CircleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />{tt("Needs test / manual only", "Falta test / solo manual")} ({needs.length})</h2>
        {needs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{tt("Everything protected has automated coverage.", "Todo lo protegido tiene cobertura automatizada.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {needs.map((i) => (
              <li key={i.itemKey}>
                <button onClick={() => onOpen(i)} className="w-full text-left text-xs text-foreground hover:text-brand-600 dark:hover:text-brand-400">
                  <span className="font-mono text-[10px] text-muted-foreground">{i.itemKey}</span> {i.title} <span className="text-amber-600 dark:text-amber-400">[{i.testStatus}]</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── AI Guardrails ─────────────────────────────────────────────────────────────
function Guardrails({ items, tt }: { items: ProductBrainItem[]; tt: (a: string, b: string) => string }) {
  const rules = items.filter((i) => i.type === "ai_development_rule" || i.type === "security_rule");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.04] p-4 text-sm text-foreground">
        <p className="font-semibold">{tt("Read before touching protected areas", "Lee antes de tocar áreas protegidas")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tt("No green test, no closed regression. No CI, no merge. No Product UX Contract, no UI overwrite. See CLAUDE.md and 11-ai-development-rules.md.",
              "Sin test verde, no se cierra regresión. Sin CI, no hay merge. Sin contrato UX, no se sobrescribe la UI. Ver CLAUDE.md y 11-ai-development-rules.md.")}
        </p>
      </div>
      <ul className="space-y-2">
        {rules.map((i) => (
          <li key={i.itemKey} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground">{i.title}</p>
            {i.decision && <p className="mt-1 text-xs text-muted-foreground">{i.decision}</p>}
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">docs/product-brain/{i.sourcePath}{i.sourceSection ? ` → ${i.sourceSection}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────────
function DetailDrawer({ item, onClose, tt }: { item: ProductBrainItem; onClose: () => void; tt: (a: string, b: string) => string }) {
  const [isabella, setIsabella] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask() {
    start(async () => {
      const res = await askIsabellaAboutItemAction(item.itemKey);
      setIsabella(res.ok ? res.answer : res.message);
    });
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) =>
    children ? (
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    ) : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{item.itemKey}</span>
            <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge item={item} />
            <TestBadge item={item} />
            <span className="text-[10px] text-muted-foreground">{item.type} · {item.module ?? "—"} · {item.severity}</span>
          </div>
          <Row label={tt("Summary", "Resumen")}>{item.summary}</Row>
          <Row label={tt("Decision", "Decisión")}>{item.decision}</Row>
          <Row label={tt("Expected behavior", "Comportamiento esperado")}>{item.expectedBehavior}</Row>
          <Row label={tt("Protection rule", "Regla de protección")}>{item.protectionRule}</Row>
          <Row label={tt("Test files", "Archivos de test")}>
            {item.testFiles.length > 0 ? (
              <ul className="space-y-0.5">{item.testFiles.map((f) => <li key={f} className="font-mono text-[11px] text-muted-foreground">{f}</li>)}</ul>
            ) : null}
          </Row>
          <Row label={tt("Verification", "Verificación")}>
            {item.verificationSteps.length > 0 ? (
              <ol className="list-decimal space-y-0.5 pl-4 text-xs">{item.verificationSteps.map((s, n) => <li key={n}>{s}</li>)}</ol>
            ) : null}
          </Row>
          <Row label={tt("Related", "Relacionados")}>{item.relatedItems.length > 0 ? item.relatedItems.join(", ") : null}</Row>
          <Row label={tt("Source", "Fuente")}>
            <a href={`${GITHUB_BASE}/${item.sourcePath}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
              <ExternalLink className="h-3 w-3" /> docs/product-brain/{item.sourcePath}{item.sourceSection ? ` → ${item.sourceSection}` : ""}
            </a>
          </Row>

          {isabella && (
            <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.05] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300"><Sparkles className="h-3.5 w-3.5" /> Isabella</p>
              <pre className="whitespace-pre-wrap text-xs text-foreground">{isabella}</pre>
            </div>
          )}
        </div>
        <div className="border-t border-border p-3">
          <button onClick={ask} disabled={pending} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {pending ? tt("Asking Isabella…", "Preguntando a Isabella…") : tt("Ask Isabella about this item", "Pregúntale a Isabella sobre esto")}
          </button>
        </div>
      </div>
    </>
  );
}
