// Loading fallback for the Milestone Process Flow view. Pure visual (no text)
// so it stays locale-independent, mirroring the project-level skeleton.
export default function MilestoneFlowLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className="h-6 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-7 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 w-full animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
        <div className="h-96 w-full animate-pulse rounded-lg border border-border bg-card" />
      </div>
    </div>
  );
}
