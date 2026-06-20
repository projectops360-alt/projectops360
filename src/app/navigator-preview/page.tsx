"use client";

// TEMPORARY preview route to visually verify the ProjectOpsNavigatorButton
// renders and the drawer opens. NOT part of the shipped feature — deleted
// after verification.

import { NextIntlClientProvider } from "next-intl";
import { ProjectOpsNavigatorButton } from "@/components/navigator/ProjectOpsNavigatorButton";
import { Bell } from "lucide-react";

export default function NavigatorPreviewPage() {
  return (
    <NextIntlClientProvider locale="en" messages={{}}>
      <div className="min-h-screen bg-background">
        {/* Faux app header to show the button in realistic context */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">ProjectOps360°</span>
            <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Search everything… ⌘K
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ProjectOpsNavigatorButton />
            <button type="button" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              PO
            </div>
          </div>
        </header>

        <main className="p-10">
          <h1 className="text-2xl font-semibold text-foreground">Navigator preview</h1>
          <p className="mt-2 text-muted-foreground">
            Click the <strong>Navigator</strong> button in the header to open the contextual drawer.
          </p>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}