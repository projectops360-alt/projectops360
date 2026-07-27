import { z } from "zod";
import {
  KNOWLEDGE_CAPTURE_METHODS,
  KNOWLEDGE_CONFIDENCE_LEVELS,
  KNOWLEDGE_ENDPOINT_KINDS,
  KNOWLEDGE_EVIDENCE_ROLES,
  KNOWLEDGE_EVIDENCE_TYPES,
  KNOWLEDGE_OBJECT_TYPES,
  KNOWLEDGE_RELATION_BASES,
  KNOWLEDGE_RELATION_TYPES,
  KNOWLEDGE_SCOPES,
  type KnowledgeAction,
  type KnowledgeActorRole,
  type KnowledgeEndpointKind,
  type KnowledgeLifecycleStatus,
  type KnowledgeRelationType,
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
  scope: z.enum(KNOWLEDGE_SCOPES),
  projectId: z.string().uuid().nullable(),
  knowledgeType: z.enum(KNOWLEDGE_OBJECT_TYPES),
  idempotencyKey: z.string().trim().min(8).max(300),
  ownerUserId: z.string().uuid().nullable().optional(),
}).strict().superRefine((value, ctx) => {
  // ADR-013. The scope decides whether a project is required; the caller never
  // signals scope by omitting the project. Rejecting the incoherent pair here
  // gives the caller a usable error before the database raises one.
  if (value.scope === "project" && value.projectId == null) {
    ctx.addIssue({ code: "custom", path: ["projectId"], message: "knowledge_input_project_required" });
  }
  if (value.scope === "organization" && value.projectId != null) {
    ctx.addIssue({ code: "custom", path: ["projectId"], message: "knowledge_input_project_forbidden_at_org_scope" });
  }
});

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

// ── Canonical relation semantics (EKI §4, ADR-016) ──────────────────────────
//
// This table mirrors `project_knowledge_assert_relation` in migration
// 20260863000000. The database is the enforcement point — this exists so a
// caller gets a usable error before a constraint raises one, and so the
// vocabulary is inspectable from TypeScript.
//
// Drift between the two would be silent, so a guard test parses the migration
// and compares it against this table.

export interface KnowledgeRelationSpec {
  /** Required endpoint kind, or null when the relation accepts either. */
  readonly source: KnowledgeEndpointKind | null;
  readonly target: KnowledgeEndpointKind | null;
  /**
   * A version-sensitive relation binds to a specific version of an object
   * endpoint. A control's new assertion does not inherit the old assertion's
   * evidence or approval.
   */
  readonly versionSensitive: boolean;
  /** Whether a human must approve the assertion before it carries weight. */
  readonly humanApproval: boolean;
}

export const KNOWLEDGE_RELATION_SPECS: Readonly<Record<KnowledgeRelationType, KnowledgeRelationSpec>> = {
  derived_from: { source: "knowledge_package", target: "knowledge_package", versionSensitive: false, humanApproval: true },
  implements: { source: "knowledge_package", target: "knowledge_package", versionSensitive: false, humanApproval: true },
  governed_by: { source: "knowledge_object", target: "knowledge_package", versionSensitive: false, humanApproval: true },
  satisfies: { source: "knowledge_object", target: "knowledge_package", versionSensitive: true, humanApproval: true },
  maps_to: { source: "knowledge_object", target: "knowledge_package", versionSensitive: true, humanApproval: true },
  applies_to: { source: "knowledge_package", target: "knowledge_object", versionSensitive: false, humanApproval: false },
  tested_by: { source: "knowledge_object", target: "knowledge_object", versionSensitive: true, humanApproval: true },
  failed_by: { source: "knowledge_object", target: "knowledge_object", versionSensitive: true, humanApproval: true },
  mitigates: { source: "knowledge_object", target: "knowledge_object", versionSensitive: false, humanApproval: true },
  threatens: { source: "knowledge_object", target: "knowledge_object", versionSensitive: false, humanApproval: true },
  accepted_as_exception_by: { source: "knowledge_object", target: "knowledge_object", versionSensitive: true, humanApproval: true },
  depends_on: { source: "knowledge_object", target: "knowledge_object", versionSensitive: false, humanApproval: true },
  supports: { source: "knowledge_object", target: "knowledge_object", versionSensitive: true, humanApproval: false },
  contradicts: { source: null, target: null, versionSensitive: true, humanApproval: false },
  supersedes: { source: null, target: null, versionSensitive: true, humanApproval: true },
};

const relationEndpointSchema = z.object({
  kind: z.enum(KNOWLEDGE_ENDPOINT_KINDS),
  id: z.string().uuid(),
  versionNo: z.number().int().positive().nullable().optional(),
}).strict();

export const createKnowledgeRelationSchema = z.object({
  scope: z.enum(KNOWLEDGE_SCOPES),
  projectId: z.string().uuid().nullable(),
  relationType: z.enum(KNOWLEDGE_RELATION_TYPES),
  source: relationEndpointSchema,
  target: relationEndpointSchema,
  basis: z.enum(KNOWLEDGE_RELATION_BASES).optional().default("declared"),
  note: z.string().trim().max(4000).nullable().optional(),
  metadata: metadataSchema.optional().default({}),
}).strict().superRefine((value, ctx) => {
  const spec = KNOWLEDGE_RELATION_SPECS[value.relationType];

  if (value.scope === "project" && value.projectId == null) {
    ctx.addIssue({ code: "custom", path: ["projectId"], message: "knowledge_relation_project_required" });
  }
  if (value.scope === "organization" && value.projectId != null) {
    ctx.addIssue({ code: "custom", path: ["projectId"], message: "knowledge_relation_project_forbidden_at_org_scope" });
  }

  if (spec.source != null && value.source.kind !== spec.source) {
    ctx.addIssue({ code: "custom", path: ["source", "kind"], message: "knowledge_relation_invalid_source_kind" });
  }
  if (spec.target != null && value.target.kind !== spec.target) {
    ctx.addIssue({ code: "custom", path: ["target", "kind"], message: "knowledge_relation_invalid_target_kind" });
  }

  // `supersedes` joins two endpoints of the same kind by definition.
  if (value.relationType === "supersedes" && value.source.kind !== value.target.kind) {
    ctx.addIssue({ code: "custom", path: ["target", "kind"], message: "knowledge_relation_supersedes_kind_mismatch" });
  }

  if (spec.versionSensitive) {
    if (value.source.kind === "knowledge_object" && value.source.versionNo == null) {
      ctx.addIssue({ code: "custom", path: ["source", "versionNo"], message: "knowledge_relation_source_version_required" });
    }
    if (value.target.kind === "knowledge_object" && value.target.versionNo == null) {
      ctx.addIssue({ code: "custom", path: ["target", "versionNo"], message: "knowledge_relation_target_version_required" });
    }
  }

  // An object cannot relate to itself. Self-supersession and self-contradiction
  // are the two that would otherwise slip through as "technically true".
  if (value.source.kind === value.target.kind && value.source.id === value.target.id) {
    ctx.addIssue({ code: "custom", path: ["target", "id"], message: "knowledge_relation_self_reference" });
  }
});

export const resolveKnowledgeRelationSchema = z.object({
  relationId: z.string().uuid(),
  // `unresolved` is absent on purpose: a contradiction may be accepted or
  // resolved, never un-noticed. Reopening one is a new relation, not an edit.
  resolution: z.enum(["accepted", "resolved"]),
  rationale: z.string().trim().min(3).max(4000),
}).strict();

/** Relations whose assertion requires a human approver before it carries weight. */
export function relationRequiresApproval(relationType: KnowledgeRelationType): boolean {
  return KNOWLEDGE_RELATION_SPECS[relationType].humanApproval;
}

/** Relations that bind to a specific version of their object endpoints. */
export function relationIsVersionSensitive(relationType: KnowledgeRelationType): boolean {
  return KNOWLEDGE_RELATION_SPECS[relationType].versionSensitive;
}
