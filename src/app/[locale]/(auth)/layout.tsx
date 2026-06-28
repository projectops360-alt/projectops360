import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* soft premium brand glow (subtle, adapts to theme) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-200px] h-[560px] w-[900px] -translate-x-1/2 blur-[60px]"
        style={{ background: "radial-gradient(ellipse, rgba(0,122,77,0.16), transparent 65%)" }}
      />

      <div className="relative w-full max-w-md">
        {/* ── Logo ── */}
        <div className="mb-9 flex justify-center">
          {/* light theme: dark-green wordmark · dark theme: 3D mark */}
          <Image
            src="/logo-full.png"
            alt="ProjectOps360°"
            width={295}
            height={102}
            className="block h-16 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo-3d.webp"
            alt="ProjectOps360°"
            width={295}
            height={102}
            className="hidden h-16 w-auto dark:block"
            priority
          />
        </div>
        {/* ── Card ── */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_24px_70px_-30px_rgba(6,78,59,0.35)]">
          {children}
        </div>
      </div>
    </div>
  );
}
