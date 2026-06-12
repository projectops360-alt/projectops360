"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import without SSR: @xyflow/react is a large, browser-only chunk.
// Skipping SSR lets the page shell paint immediately while the graph loads.
export const LivingGraphView = dynamic(
  () => import("./living-graph-view").then((mod) => mod.LivingGraphView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);
