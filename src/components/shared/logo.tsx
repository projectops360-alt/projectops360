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
        "flex items-center justify-center",
        onDark && "rounded-xl bg-white px-3 py-2 shadow-sm",
        className,
      )}
    >
      <Image
        src="/logo-full.png"
        alt="Project Ops 360°"
        width={2953}
        height={1024}
        // Fill the available width so the wide wordmark stays legible in the
        // narrow sidebar; height follows the aspect ratio.
        className={onDark ? "h-auto w-full" : "h-8 w-auto shrink-0"}
        priority
      />
    </div>
  );
}