import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand logo. The artwork is the full-color "Project Ops 360°" mark
 * (transparent PNG). On a light surface render it as-is; on the dark sidebar
 * pass `onDark` to sit it on a light plate so the dark-green wordmark stays
 * legible.
 */
export function Logo({ className, fullWidth = false }: { className?: string; fullWidth?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-lg", className)}>
      {/* 3D render already sits on a dark backdrop, so it blends into the dark
          sidebar (rounded corners hide the seam). */}
      <Image
        src="/logo-3d.png"
        alt="Project Ops 360°"
        width={1344}
        height={768}
        className={fullWidth ? "h-auto w-full" : "h-14 w-auto shrink-0"}
        priority
      />
    </div>
  );
}