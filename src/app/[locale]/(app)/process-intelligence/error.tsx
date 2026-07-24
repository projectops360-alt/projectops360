"use client";

// CAP-047 M3 — route error state. Bilingual, honest, with a safe way back to
// the current (default) dashboard. Never renders partial analytical data.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ProcessIntelligenceError({ reset }: { error: Error; reset: () => void }) {
  const pathname = usePathname();
  const isEs = pathname?.startsWith("/es") ?? false;
  const base = isEs ? "/es" : "";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="max-w-md text-sm text-muted-foreground">
        {isEs
          ? "Process Intelligence no pudo cargar sus datos. Ningún dato parcial fue mostrado."
          : "Process Intelligence could not load its data. No partial data was displayed."}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          {isEs ? "Reintentar" : "Retry"}
        </button>
        <Link
          href={base || "/"}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {isEs ? "Volver al Dashboard Actual" : "Back to Current Dashboard"}
        </Link>
      </div>
    </div>
  );
}
