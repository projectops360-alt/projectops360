// Shared view-model types for the Project Memory UI (client-safe, no server imports).

import type {
  MemorySourceType,
  MemoryImportance,
  MemorySentiment,
  MemoryVisibility,
  MemoryPipelineStatus,
  MemoryClassification,
} from "@/types/database";

export interface MemoryLinkView {
  linkId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  label: string;
}

export interface MemoryItemView {
  id: string;
  title: string;
  content: string | null;
  summary: string | null;
  sourceType: MemorySourceType;
  sourceSystem: string | null;
  authorName: string | null;
  authorEmail: string | null;
  participants: string[];
  occurredAt: string | null;
  createdAt: string;
  importanceLevel: MemoryImportance;
  sentiment: MemorySentiment | null;
  aiClassification: MemoryClassification;
  tags: string[];
  visibility: MemoryVisibility;
  aiStatus: MemoryPipelineStatus;
  indexStatus: MemoryPipelineStatus;
  links: MemoryLinkView[];
}

/** A project entity a memory item can be linked to. */
export interface LinkableEntity {
  id: string;
  label: string;
}

export interface LinkableEntities {
  task: LinkableEntity[];
  milestone: LinkableEntity[];
  decision: LinkableEntity[];
  risk: LinkableEntity[];
  stakeholder: LinkableEntity[];
  document: LinkableEntity[];
  communication: LinkableEntity[];
  meeting: LinkableEntity[];
}

export type LinkableEntityType = keyof LinkableEntities;
