"use client";

import type { DocumentStatus } from "@/types/database";

const statusColors: Record<DocumentStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  review: "bg-amber-100 text-amber-800",
  approved: "bg-brand-100 text-brand-800",
  archived: "bg-blue-100 text-blue-800",
};

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  label: string;
}

export function DocumentStatusBadge({ status, label }: DocumentStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {label}
    </span>
  );
}