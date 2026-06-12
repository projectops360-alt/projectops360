import Image from "next/image";
import { setRequestLocale } from "next-intl/server";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-950 to-brand-900 px-4">
      <div className="w-full max-w-md">
        {/* ── Logo ── */}
        <div className="mb-8 flex justify-center">
          <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <Image
              src="/logo.png"
              alt="ProjectOps360°"
              width={120}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </div>
        </div>
        {/* ── Card ── */}
        <div className="rounded-2xl border border-white/10 bg-card p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}