import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Brand icon — soft green circle */}
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
        <span className="text-sm font-bold text-white">P</span>
      </div>
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