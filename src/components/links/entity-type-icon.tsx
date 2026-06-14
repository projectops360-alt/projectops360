"use client";

import {
  Gavel,
  Calendar,
  MessageSquare,
  FileText,
  CheckSquare,
  Users,
  FolderKanban,
  BookOpen,
  ListChecks,
  Flag,
  ShieldAlert,
} from "lucide-react";
import type { TraceableEntityType } from "@/types/database";

const iconMap: Record<TraceableEntityType, typeof Gavel> = {
  decision: Gavel,
  meeting: Calendar,
  communication: MessageSquare,
  document: FileText,
  action_item: CheckSquare,
  stakeholder: Users,
  project: FolderKanban,
  memory: BookOpen,
  task: ListChecks,
  milestone: Flag,
  risk: ShieldAlert,
};

interface EntityTypeIconProps {
  entityType: TraceableEntityType;
  className?: string;
}

export function EntityTypeIcon({ entityType, className = "h-4 w-4" }: EntityTypeIconProps) {
  const Icon = iconMap[entityType];
  return <Icon className={className} />;
}