"use client";

import type { ImpactArea } from "@/types/database";

const impactColors: Record<ImpactArea, string> = {
  scope: "bg-purple-100 text-purple-800",
  schedule: "bg-amber-100 text-amber-800",
  budget: "bg-green-100 text-green-800",
  risk: "bg-red-100 text-red-800",
  quality: "bg-blue-100 text-blue-800",
  communication: "bg-teal-100 text-teal-800",
  document: "bg-slate-100 text-slate-700",
  other: "bg-gray-100 text-gray-800",
};

interface ImpactBadgeProps {
  impactArea: ImpactArea;
  label: string;
  /** Use smaller padding when rendered inline in tight layouts. */
  compact?: boolean;
}

export function ImpactBadge({ impactArea, label, compact }: ImpactBadgeProps) {
  const sizeClass = compact
    ? "px-1.5 py-px text-[10px]"
    : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${impactColors[impactArea] ?? "bg-gray-100 text-gray-800"}`}
    >
      {label}
    </span>
  );
}