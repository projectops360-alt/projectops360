// Inline SVG lockup from the handoff (assets/logo.svg). Inlined so the wordmark
// inherits the page's Space Grotesk font (per the handoff's requirement #1).
// A raster fallback lives at /landing/logo.png.

export function LandingLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 332 64" role="img" aria-label="Project Ops 360°" fill="none">
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M46 20 a 14 14 0 1 0 6 5" stroke="#2A9D8F" strokeWidth="4.4" />
        <path d="M25 32 l5 5 9 -11" stroke="#1B4D3D" strokeWidth="4.4" />
      </g>
      <text
        x="64"
        y="42"
        fontSize="30"
        letterSpacing="-0.5"
        style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontWeight: 700 }}
      >
        <tspan fill="#2A9D8F">Project</tspan>
        <tspan fill="#16302a"> Ops 360</tspan>
        <tspan fill="#2A9D8F">°</tspan>
      </text>
    </svg>
  );
}
