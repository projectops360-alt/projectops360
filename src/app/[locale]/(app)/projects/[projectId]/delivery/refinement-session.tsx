"use client";

// ============================================================================
// Refinement Sessions — run a facilitated refinement review.
// List + create (pick items, optional AI talking points) + session runner
// (review each item: talking points, decisions, notes, action items, outcome).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, Trash2, Play, CheckCircle2, Sparkles, MessageSquareText,
  ClipboardList, ListChecks, ChevronRight, X,
} from "lucide-react";
import { REFINEMENT_STATUS_META, REFINABLE_STATUSES } from "@/lib/refinement/templates";
import {
  createRefinementSessionAction, setSessionStatusAction,
  deleteRefinementSessionAction, saveSessionItemOutcomeAction,
} from "./actions";

const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const TONE: Record<string, string> = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};
const SESSION_TONE: Record<string, string> = { planned: "gray", active: "blue", completed: "green", canceled: "gray" };

interface Props {
  projectId: string; locale: string;
  items: Record<string, unknown>[]; // all backlog items (for titles)
  refinable: Record<string, unknown>[]; // selectable items
  sessions: Record<string, unknown>[];
  sessionItems: Record<string, unknown>[];
}

export function SessionsPanel(p: Props) {
  const isEs = p.locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(p.sessions.find((s) => String(s.status) === "active") ? String(p.sessions.find((s) => String(s.status) === "active")!.id) : null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [prepare, setPrepare] = useState(true);

  const titleOf = (id: unknown) => { const x = p.items.find((it) => String(it.id) === String(id)); return x ? String(x.title) : "—"; };
  const itemsOf = (sessionId: string) => p.sessionItems.filter((si) => String(si.session_id) === sessionId).sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const create = () => {
    if (!title.trim() || sel.size === 0) return;
    start(async () => {
      const r = await createRefinementSessionAction({ projectId: p.projectId, title: title.trim(), itemIds: [...sel], locale: p.locale, prepare });
      if (r.sessionId) { setOpenId(r.sessionId); setCreating(false); setTitle(""); setSel(new Set()); }
      router.refresh();
    });
  };
  const setStatus = (id: string, status: string) => start(async () => { await setSessionStatusAction({ projectId: p.projectId, id, status }); router.refresh(); });
  const del = (id: string) => start(async () => { await deleteRefinementSessionAction({ projectId: p.projectId, id }); if (openId === id) setOpenId(null); router.refresh(); });

  const openSession = openId ? p.sessions.find((s) => String(s.id) === openId) : null;

  // ── Session runner ───────────────────────────────────────────────────────
  if (openSession) {
    const sItems = itemsOf(String(openSession.id));
    const reviewed = sItems.filter((si) => si.reviewed).length;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
          <div>
            <button onClick={() => setOpenId(null)} className="text-xs text-brand-600 hover:underline dark:text-brand-400">← {isEs ? "Volver a sesiones" : "Back to sessions"}</button>
            <h3 className="mt-0.5 text-base font-bold text-foreground">{String(openSession.title)}</h3>
            <p className="text-[11px] text-muted-foreground">{reviewed}/{sItems.length} {isEs ? "revisados" : "reviewed"}</p>
          </div>
          <div className="flex items-center gap-2">
            {String(openSession.status) !== "completed" && (
              <button onClick={() => setStatus(String(openSession.id), "completed")} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isEs ? "Completar sesión" : "Complete session"}
              </button>
            )}
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${TONE[SESSION_TONE[String(openSession.status)] ?? "gray"]}`}>{String(openSession.status)}</span>
          </div>
        </div>

        <div className="space-y-2">
          {sItems.map((si) => (
            <SessionItemCard key={String(si.id)} projectId={p.projectId} isEs={isEs} si={si} title={titleOf(si.backlog_item_id)} pending={pending} start={start} onSaved={() => router.refresh()} />
          ))}
          {sItems.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sesión sin ítems." : "Session has no items."}</p>}
        </div>
      </div>
    );
  }

  // ── Sessions list + create ─────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{isEs ? "Reuniones de refinamiento: selecciona ítems, revisa cada uno con decisiones y action items, y marca el resultado." : "Refinement reviews: select items, review each with decisions and action items, and set the outcome."}</p>
        {!creating && <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"><Plus className="h-4 w-4" />{isEs ? "Nueva sesión" : "New session"}</button>}
      </div>

      {creating && (
        <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900 dark:bg-brand-950/20">
          <div className="flex items-center gap-2">
            <input className={inp} placeholder={isEs ? "Título de la sesión (ej. Refinamiento semanal)" : "Session title (e.g. Weekly refinement)"} value={title} onChange={(e) => setTitle(e.target.value)} />
            <button onClick={() => { setCreating(false); setSel(new Set()); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">{isEs ? "Selecciona ítems a refinar:" : "Select items to refine:"}</p>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
            {p.refinable.map((it) => (
              <label key={String(it.id)} className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={sel.has(String(it.id))} onChange={() => toggle(String(it.id))} className="h-3.5 w-3.5 accent-brand-600" />
                {String(it.title)}
              </label>
            ))}
            {p.refinable.length === 0 && <p className="text-[11px] text-muted-foreground">{isEs ? "No hay ítems disponibles." : "No items available."}</p>}
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={prepare} onChange={(e) => setPrepare(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Preparar puntos de discusión con IA" : "Prepare talking points with AI"}
          </label>
          <button onClick={create} disabled={pending || !title.trim() || sel.size === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{isEs ? `Iniciar sesión (${sel.size})` : `Start session (${sel.size})`}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {p.sessions.map((s) => {
          const its = itemsOf(String(s.id));
          const reviewed = its.filter((si) => si.reviewed).length;
          return (
            <div key={String(s.id)} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
              <button onClick={() => setOpenId(String(s.id))} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{String(s.title)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE[SESSION_TONE[String(s.status)] ?? "gray"]}`}>{String(s.status)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{its.length} {isEs ? "ítems" : "items"} · {reviewed} {isEs ? "revisados" : "reviewed"}{s.delivery_method ? ` · ${String(s.delivery_method)}` : ""}</p>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => setOpenId(String(s.id))} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">{isEs ? "Abrir" : "Open"}<ChevronRight className="h-3.5 w-3.5" /></button>
                <button onClick={() => del(String(s.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          );
        })}
        {p.sessions.length === 0 && !creating && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sin sesiones todavía. Crea la primera." : "No sessions yet. Create the first one."}</p>}
      </div>
    </div>
  );
}

// ── One item under review ─────────────────────────────────────────────────────

function SessionItemCard({ projectId, isEs, si, title, pending, start, onSaved }: {
  projectId: string; isEs: boolean; si: Record<string, unknown>; title: string;
  pending: boolean; start: React.TransitionStartFunction; onSaved: () => void;
}) {
  const [outcome, setOutcome] = useState(String(si.outcome ?? ""));
  const [decisions, setDecisions] = useState(String(si.decisions ?? ""));
  const [notes, setNotes] = useState(String(si.notes ?? ""));
  const [actionItems, setActionItems] = useState(String(si.action_items ?? ""));
  const points = Array.isArray(si.talking_points) ? (si.talking_points as { kind?: string; text?: string }[]) : [];

  const save = () => start(async () => {
    await saveSessionItemOutcomeAction({
      projectId, sessionItemId: String(si.id), backlogItemId: String(si.backlog_item_id),
      outcome: outcome || undefined, decisions, notes, actionItems, reviewed: true,
    });
    onSaved();
  });

  return (
    <div className={`rounded-xl border bg-card p-3 ${si.reviewed ? "border-green-300 dark:border-green-900" : "border-border"}`}>
      <div className="flex items-center gap-2">
        {si.reviewed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <ClipboardList className="h-4 w-4 text-muted-foreground" />}
        <span className="font-semibold text-foreground">{title}</span>
      </div>

      {points.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg bg-muted/30 p-2 text-xs">
          {points.map((pt, i) => (
            <p key={i} className="flex items-start gap-1.5 text-muted-foreground">
              {pt.kind === "question" ? <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" /> : <ListChecks className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />}
              {pt.text}
            </p>
          ))}
        </div>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <textarea className={inp} rows={2} placeholder={isEs ? "Decisiones" : "Decisions"} value={decisions} onChange={(e) => setDecisions(e.target.value)} />
        <textarea className={inp} rows={2} placeholder={isEs ? "Action items" : "Action items"} value={actionItems} onChange={(e) => setActionItems(e.target.value)} />
      </div>
      <textarea className={`${inp} mt-2`} rows={2} placeholder={isEs ? "Notas" : "Notes"} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-medium text-muted-foreground">{isEs ? "Resultado:" : "Outcome:"}</label>
        <select className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-brand-500 focus:outline-none" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">{isEs ? "— Sin cambio —" : "— No change —"}</option>
          {REFINABLE_STATUSES.map((s) => { const m = REFINEMENT_STATUS_META[s]; return <option key={s} value={s}>{isEs ? m.es : m.en}</option>; })}
        </select>
        <button onClick={save} disabled={pending} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isEs ? "Guardar revisión" : "Save review"}
        </button>
      </div>
    </div>
  );
}
