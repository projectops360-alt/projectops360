"use client";

import { Bell, Search } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      {/* ── Search ── */}
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-8 hidden rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        {/* ── Avatar placeholder ── */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          PO
        </div>
      </div>
    </header>
  );
}