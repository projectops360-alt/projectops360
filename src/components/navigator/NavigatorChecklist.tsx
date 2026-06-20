"use client";

import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigatorChecklistProps {
  items: string[];
  /** Visual emphasis for the leading glyph (informational, not toggleable here). */
  className?: string;
}

export function NavigatorChecklist({ items, className }: NavigatorChecklistProps) {
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
          <Circle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}