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
    <div className={cn("flex items-center justify-center", !fullWidth && "overflow-hidden rounded-lg", className)}>
      {/* 3D render sits on a dark backdrop that matches the sidebar, so it
          blends seamlessly even when bled full-width. */}
      {/* 31KB WebP (down from a 1MB PNG). The sidebar logo is not the LCP, so we
          load it eagerly but without `priority`, which would otherwise pre-empt
          the real LCP asset. */}
      <Image
        src="/logo-3d.webp"
        alt="Project Ops 360°"
        width={1344}
        height={768}
        className={fullWidth ? "block h-auto w-full" : "h-14 w-auto shrink-0"
        }
      />
    </div>
  );
}