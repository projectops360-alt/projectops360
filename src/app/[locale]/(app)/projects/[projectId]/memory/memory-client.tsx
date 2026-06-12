"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  CalendarDays,
  Scale,
  FileText,
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────────

interface Communication {
  id: string;
  title: string;
  date: string | null;
  sourceType: string;
  requiresFollowUp: boolean;
}

interface Meeting {
  id: string;
  title: string;
  date: string | null;
  status: string;
}

interface Decision {
  id: string;
  title: string;
  date: string | null;
  status: string;
  impactArea: string | null;
}

interface Document {
  id: string;
  title: string;
  documentType: string | null;
  status: string;
}

interface ProjectMemoryClientProps {
  projectId: string;
  locale: string;
  communications: Communication[];
  meetings: Meeting[];
  decisions: Decision[];
  documents: Document[];
  counts: {
    communications: number;
    meetings: number;
    decisions: number;
    documents: number;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────────

const SOURCE_TYPE_COLORS: Record<string, string> = {
  email: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  meeting: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  phone: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  teams: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  slack: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  in_person: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  document: "bg-slate-50 text-slate-700 dark:bg-slate-950/50 dark:text-slate-300",
  manual_note: "bg-gray-50 text-gray-700 dark:bg-gray-950/50 dark:text-gray-300",
  other: "bg-gray-50 text-gray-700 dark:bg-gray-950/50 dark:text-gray-300",
};

type TabKey = "all" | "communications" | "meetings" | "decisions" | "documents" | "search";

// ── Sub-components ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (["completed", "accepted", "approved", "logged"].includes(status)) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  }
  if (["cancelled", "rejected", "revoked"].includes(status)) {
    return <Circle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  }
  return <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function ProjectMemoryClient({
  projectId,
  locale,
  communications,
  meetings,
  decisions,
  documents,
  counts,
}: ProjectMemoryClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const base = `/${locale}/projects/${projectId}`;

  const isEs = locale === "es";

  // ── Tab definitions ───────────────────────────────────────────────────────

  const tabs: Array<{ key: TabKey; label: string; count?: number; icon: typeof BookOpen }> = [
    { key: "all", label: isEs ? "Todo" : "All", icon: BookOpen },
    { key: "communications", label: isEs ? "Comunicaciones" : "Communications", count: counts.communications, icon: MessageSquare },
    { key: "meetings", label: isEs ? "Reuniones" : "Meetings", count: counts.meetings, icon: CalendarDays },
    { key: "decisions", label: isEs ? "Decisiones" : "Decisions", count: counts.decisions, icon: Scale },
    { key: "documents", label: isEs ? "Documentos" : "Documents", count: counts.documents, icon: FileText },
    { key: "search", label: isEs ? "Buscar" : "Search", icon: Search },
  ];

  // ── Unified activity feed (for "All" tab) ─────────────────────────────────

  type ActivityItem = {
    id: string;
    type: "communication" | "meeting" | "decision" | "document";
    title: string;
    date: string | null;
    meta: string;
    status?: string;
  };

  const allItems: ActivityItem[] = [
    ...communications.map((c) => ({
      id: c.id,
      type: "communication" as const,
      title: c.title,
      date: c.date,
      meta: c.sourceType,
      status: undefined,
    })),
    ...meetings.map((m) => ({
      id: m.id,
      type: "meeting" as const,
      title: m.title,
      date: m.date,
      meta: m.status,
      status: m.status,
    })),
    ...decisions.map((d) => ({
      id: d.id,
      type: "decision" as const,
      title: d.title,
      date: d.date,
      meta: d.status,
      status: d.status,
    })),
    ...documents.map((doc) => ({
      id: doc.id,
      type: "document" as const,
      title: doc.title,
      date: null, // documents don't have a date field in our query
      meta: doc.status,
      status: doc.status,
    })),
  ]
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const typeIcon: Record<string, { icon: React.ReactNode; color: string }> = {
    communication: { icon: <MessageSquare className="h-4 w-4" />, color: "text-teal-500" },
    meeting: { icon: <CalendarDays className="h-4 w-4" />, color: "text-blue-500" },
    decision: { icon: <Scale className="h-4 w-4" />, color: "text-amber-500" },
    document: { icon: <FileText className="h-4 w-4" />, color: "text-purple-500" },
  };

  const typeLabel: Record<string, string> = {
    communication: isEs ? "Comunicación" : "Communication",
    meeting: isEs ? "Reunión" : "Meeting",
    decision: isEs ? "Decisión" : "Decision",
    document: isEs ? "Documento" : "Document",
  };

  const routeMap: Record<string, string> = {
    communication: "communications",
    meeting: "meetings",
    decision: "decisions",
    document: "documents",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">
          {isEs ? "Memoria del Proyecto" : "Project Memory"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Historial completo de comunicaciones, reuniones, decisiones y documentos."
            : "Complete history of communications, meetings, decisions, and documents."}
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="border-b border-border">
        <div className="flex overflow-x-auto gap-1 -mb-px scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count != null && (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.key
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {/* ── All ─────────────────────────────────────────────────────────── */}
        {activeTab === "all" && (
          <>
            {allItems.length === 0 ? (
              <EmptyState message={isEs ? "No hay registros aún" : "No records yet"} />
            ) : (
              <div className="space-y-1">
                {allItems.map((item) => {
                  const info = typeIcon[item.type];
                  const route = routeMap[item.type];
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={`${base}/${route}`}
                      className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className={`mt-0.5 shrink-0 ${info.color}`}>{info.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {typeLabel[item.type]}
                          </span>
                          {item.status && <StatusDot status={item.status} />}
                          {item.type === "communication" && (
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_TYPE_COLORS[item.meta] || SOURCE_TYPE_COLORS.other}`}>
                              {item.meta}
                            </span>
                          )}
                          {item.date && (
                            <span className="text-[11px] text-muted-foreground">
                              · {new Date(item.date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Communications ─────────────────────────────────────────────── */}
        {activeTab === "communications" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {counts.communications} {isEs ? "comunicaciones registradas" : "communications recorded"}
              </p>
              <Link
                href={`${base}/communications`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {isEs ? "Gestionar" : "Manage"} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {communications.length === 0 ? (
              <EmptyState message={isEs ? "No hay comunicaciones aún" : "No communications yet"} />
            ) : (
              <div className="space-y-1">
                {communications.map((c) => (
                  <Link
                    key={c.id}
                    href={`${base}/communications`}
                    className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {c.title}
                        </p>
                        {c.requiresFollowUp && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Follow-up
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_TYPE_COLORS[c.sourceType] || SOURCE_TYPE_COLORS.other}`}>
                          {c.sourceType}
                        </span>
                        {c.date && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(c.date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Meetings ───────────────────────────────────────────────────── */}
        {activeTab === "meetings" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {counts.meetings} {isEs ? "reuniones registradas" : "meetings recorded"}
              </p>
              <Link
                href={`${base}/meetings`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {isEs ? "Gestionar" : "Manage"} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {meetings.length === 0 ? (
              <EmptyState message={isEs ? "No hay reuniones aún" : "No meetings yet"} />
            ) : (
              <div className="space-y-1">
                {meetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`${base}/meetings/${m.id}`}
                    className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {m.title}
                        </p>
                        <StatusDot status={m.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground capitalize">{m.status}</span>
                        {m.date && (
                          <span className="text-[11px] text-muted-foreground">
                            · {new Date(m.date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Decisions ──────────────────────────────────────────────────── */}
        {activeTab === "decisions" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {counts.decisions} {isEs ? "decisiones registradas" : "decisions recorded"}
              </p>
              <Link
                href={`${base}/decisions`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {isEs ? "Gestionar" : "Manage"} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {decisions.length === 0 ? (
              <EmptyState message={isEs ? "No hay decisiones aún" : "No decisions yet"} />
            ) : (
              <div className="space-y-1">
                {decisions.map((d) => (
                  <Link
                    key={d.id}
                    href={`${base}/decisions/${d.id}`}
                    className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {d.title}
                        </p>
                        <StatusDot status={d.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground capitalize">{d.status}</span>
                        {d.impactArea && (
                          <span className="text-[11px] text-muted-foreground">· {d.impactArea}</span>
                        )}
                        {d.date && (
                          <span className="text-[11px] text-muted-foreground">
                            · {new Date(d.date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Documents ──────────────────────────────────────────────────── */}
        {activeTab === "documents" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {counts.documents} {isEs ? "documentos registrados" : "documents recorded"}
              </p>
              <Link
                href={`${base}/documents`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {isEs ? "Gestionar" : "Manage"} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {documents.length === 0 ? (
              <EmptyState message={isEs ? "No hay documentos aún" : "No documents yet"} />
            ) : (
              <div className="space-y-1">
                {documents.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`${base}/documents/${doc.id}`}
                    className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {doc.title}
                        </p>
                        <StatusDot status={doc.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.documentType && (
                          <span className="text-[11px] text-muted-foreground capitalize">{doc.documentType}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground capitalize">{doc.status}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Search ─────────────────────────────────────────────────────── */}
        {activeTab === "search" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-2">
              {isEs ? "Buscar en el proyecto" : "Search within project"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {isEs
                ? "Busca en comunicaciones, reuniones, decisiones y documentos."
                : "Search across communications, meetings, decisions, and documents."}
            </p>
            <Link
              href={`${base}/search`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Search className="h-4 w-4" />
              {isEs ? "Ir a búsqueda avanzada" : "Go to advanced search"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
