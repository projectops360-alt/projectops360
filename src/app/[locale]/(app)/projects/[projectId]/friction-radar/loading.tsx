export default function FrictionRadarLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 motion-safe:animate-pulse" aria-busy="true">
      <div className="h-52 rounded-2xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 rounded-xl bg-muted" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-32 rounded-xl bg-muted" />)}
      </div>
      <div className="h-96 rounded-2xl bg-muted" />
    </div>
  );
}
