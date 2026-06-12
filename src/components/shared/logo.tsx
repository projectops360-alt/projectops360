import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Brand logo image */}
      <Image
        src="/logo.png"
        alt="ProjectOps360°"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded"
        priority
      />
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-tight text-white">
          ProjectOps
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-brand-400">
          360°
        </span>
      </div>
    </div>
  );
}