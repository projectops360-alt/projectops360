// Stage-lit brand logo: the app wordmark (logo-full.png) filled with a top-down
// gradient via CSS mask + a soft spotlight glow above — dark letters lit from
// above, "like a stage". Height is controlled by the passed className.

export function LogoStage({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="ProjectOps 360°" className={`relative inline-block aspect-[2953/1024] ${className}`}>
      {/* spotlight pool above the logo */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-55%] h-[150%] w-[78%] -translate-x-1/2 rounded-full opacity-40 blur-2xl"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,122,77,.28), transparent 70%)" }}
      />
      {/* the wordmark, filled with the top-lit gradient */}
      <span aria-hidden className="lp-logo-stage absolute inset-0" />
    </span>
  );
}
