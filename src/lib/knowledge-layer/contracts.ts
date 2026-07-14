import { z } from "zod";
import {
  KNOWLEDGE_CAPTURE_METHODS,
  KNOWLEDGE_CONFIDENCE_LEVELS,
  KNOWLEDGE_EVIDENCE_ROLES,
  KNOWLEDGE_EVIDENCE_TYPES,
  KNOWLEDGE_OBJECT_TYPES,
  type KnowledgeAction,
  type KnowledgeActorRole,
  type KnowledgeLifecycleStatus,
} from "./types";

const metadataSchema = z.record(z.string(), z.unknown());

export const knowledgeEvidenceSchema = z.object({
  type: z.enum(KNOWLEDGE_EVIDENCE_TYPES),
  ref: z.string().trim().min(1).max(1000),
  role: z.enum(KNOWLEDGE_EVIDENCE_ROLES),
  confidence: z.enum(KNOWLEDGE_CONFIDENCE_LEVELS),
  note: z.string().trim().max(4000).nullable().optional(),
  metadata: metadataSchema.optional().default({}),
}).strict();

export const knowledgeProvenanceSchema = z.object({
  captureMethod: z.enum(KNOWLEDGE_CAPTURE_METHODS),
  sourceKind: z.string().trim().min(1).max(200),
  sourceRef: z.string().trim().min(1).max(1000),
  engineName: z.string().trim().max(200).nullable().optional(),
  engineVersion: z.string().trim().max(100).nullable().optional(),
  configVersion: z.string().trim().max(100).nullable().optional(),
  dataQualityFlags: z.array(z.string().trim().min(1).max(200)).max(100).optional().default([]),
}).strict();

const knowledgeVersionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(4000),
  body: z.string().trim().min(1).max(100000),
  structuredContent: metadataSchema.optional().default({}),
  confidence: z.enum(KNOWLEDGE_CONFIDENCE_LEVELS),
  confidenceReason: z.string().trim().min(3).max(4000),
  provenance: knowledgeProvenanceSchema,
  evidence: z.array(knowledgeEvidenceSchema).min(1).max(250),
  proposalRationale: z.string().trim().min(3).max(4000),
}).strict();

export const createKnowledgeObjectSchema = knowledgeVersionSchema.extend({
  projectId: z.string().uuid(),
  knowledgeType: z.enum(KNOWLEDGE_OBJECT_TYPES),
  idempotencyKey: z.string().trim().min(8).max(300),
}).strict();

export const reviseKnowledgeObjectSchema = knowledgeVersionSchema.extend({
  knowledgeObjectId: z.string().uuid(),
  expectedVersionNo: z.number().int().positive(),
}).strict();

export const transitionKnowledgeObjectSchema = z.object({
  knowledgeObjectId: z.string().uuid(),
  expectedVersionNo: z.number().int().positive(),
  targetStatus: z.enum(["validated", "active"]),
  rationale: z.string().trim().min(3).max(4000),
}).strict();

const actionRoles: Record<KnowledgeAction, ReadonlySet<KnowledgeActorRole>> = {
  read: new Set(["owner", "admin", "member", "viewer"]),
  propose: new Set(["owner", "admin", "member"]),
  revise: new Set(["owner", "admin", "member"]),
  validate: new Set(["owner", "admin"]),
  activate: new Set(["owner", "admin"]),
};

export function authorizeKnowledgeAction(role: KnowledgeActorRole, action: KnowledgeAction): boolean {
  return actionRoles[action].has(role);
}

export function canTransitionKnowledgeObject(
  from: KnowledgeLifecycleStatus,
  to: KnowledgeLifecycleStatus,
): boolean {
  return (from === "proposed" && to === "validated")
    || (from === "validated" && to === "active");
}
