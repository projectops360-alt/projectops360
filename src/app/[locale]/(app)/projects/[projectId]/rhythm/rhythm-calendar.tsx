"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import { EVENT_TYPE_META } from "./rhythm-badges";
import type { EventView } from "./types";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function RhythmCalendar({
  locale, events, onSelect,
}: { locale: string; events: EventView[]; onSelect: (e: EventView) => void }) {
  const isEs = locale === "es";
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Events grouped by local day key.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventView[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.startDatetime));
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime());
    return map;
  }, [events]);

  // 6-week grid, Monday-start.
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [year, month]);

  const monthLabel = cursor.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = useMemo(() =>
    // Monday-first weekday short names in the active locale (June 1 2026 = Mon).
    Array.from({ length: 7 }, (_, i) =>
      new Date(2026, 5, 1 + i).toLocaleDateString(locale, { weekday: "short" }).replace(".", ""),
    ),
  [locale]);

  const todayKey = dayKey(today);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold capitalize text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted">{isEs ? "Hoy" : "Today"}</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{w}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const k = dayKey(date);
          const inMonth = date.getMonth() === month;
          const isToday = k === todayKey;
          const dayEvents = eventsByDay.get(k) ?? [];
          return (
            <div key={i} className={`min-h-[92px] border-b border-r border-border p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${inMonth ? "" : "bg-muted/20"}`}>
              <div className="mb-1 flex justify-end">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-brand-600 font-semibold text-white" : inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>{date.getDate()}</span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const meta = EVENT_TYPE_META[e.eventType] ?? EVENT_TYPE_META.other;
                  return (
                    <button key={e.id} onClick={() => onSelect(e)} title={e.title}
                      className={`flex w-full items-center gap-0.5 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80 ${meta.color}`}>
                      {e.meeting?.meetingLink && <Video className="h-2.5 w-2.5 shrink-0" />}
                      <span className="truncate">{new Date(e.startDatetime).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} {e.title}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} {isEs ? "más" : "more"}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
