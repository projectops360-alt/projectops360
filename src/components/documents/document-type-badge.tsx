"use client";

import type { DocumentType } from "@/types/database";

const typeColors: Record<DocumentType, string> = {
  evidence: "bg-emerald-100 text-emerald-800",
  contract: "bg-purple-100 text-purple-800",
  specification: "bg-blue-100 text-blue-800",
  report: "bg-amber-100 text-amber-800",
  presentation: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-800",
};

interface DocumentTypeBadgeProps {
  documentType: DocumentType;
  label: string;
}

export function DocumentTypeBadge({ documentType, label }: DocumentTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[documentType] ?? "bg-gray-100 text-gray-800"}`}
    >
      {label}
    </span>
  );
}