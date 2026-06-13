import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand logo. The artwork is the full-color "Project Ops 360°" mark
 * (transparent PNG). On a light surface render it as-is; on the dark sidebar
 * pass `onDark` to sit it on a light plate so the dark-green wordmark stays
 * legible.
 */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center",
        onDark && "rounded-lg bg-white/95 px-2 py-1 shadow-sm",
        className,
      )}
    >
      <Image
        src="/logo-full.png"
        alt="Project Ops 360°"
        width={2953}
        height={1024}
        className="h-8 w-auto shrink-0"
        priority
      />
    </div>
  );
}