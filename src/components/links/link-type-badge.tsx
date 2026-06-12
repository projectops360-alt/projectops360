"use client";

import type { LinkType } from "@/types/database";

const linkTypeColors: Record<LinkType, string> = {
  related_to: "bg-slate-100 text-slate-700",
  caused_by: "bg-orange-100 text-orange-800",
  depends_on: "bg-blue-100 text-blue-800",
  supersedes: "bg-purple-100 text-purple-800",
  derived_from: "bg-teal-100 text-teal-800",
  contradicts: "bg-red-100 text-red-800",
};

interface LinkTypeBadgeProps {
  linkType: LinkType;
  label: string;
}

export function LinkTypeBadge({ linkType, label }: LinkTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        linkTypeColors[linkType] ?? "bg-gray-100 text-gray-800"
      }`}
    >
      {label}
    </span>
  );
}