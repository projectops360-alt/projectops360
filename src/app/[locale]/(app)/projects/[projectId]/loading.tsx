// Loading fallback for any project sub-route. The ProjectLayout (tabs + title)
// renders first; this skeleton fills the content area while the page's server
// queries run. Pure visual (no text) so it stays locale-independent.
export default function ProjectLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Main panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}