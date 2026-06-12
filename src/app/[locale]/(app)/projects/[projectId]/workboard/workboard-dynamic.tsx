"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with @hello-pangea/dnd
export const WorkboardClient = dynamic(
  () => import("./workboard-client").then((mod) => mod.WorkboardClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading workboard...</p>
        </div>
      </div>
    ),
  }
);