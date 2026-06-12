"use client";

import type { DecisionStatus } from "@/types/database";

const statusColors: Record<DecisionStatus, string> = {
  proposed: "bg-blue-100 text-blue-800",
  accepted: "bg-brand-100 text-brand-800",
  rejected: "bg-red-100 text-red-800",
  deferred: "bg-amber-100 text-amber-800",
  revoked: "bg-slate-100 text-slate-700",
};

interface DecisionStatusBadgeProps {
  status: DecisionStatus;
  label: string;
}

export function DecisionStatusBadge({ status, label }: DecisionStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {label}
    </span>
  );
}