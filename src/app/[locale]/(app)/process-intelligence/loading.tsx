// CAP-047 M3 — route loading state (skeleton, motion-free by design).
export default function ProcessIntelligenceLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-72 rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
      <div className="h-[420px] rounded-2xl border border-border bg-muted/30" />
    </div>
  );
}
