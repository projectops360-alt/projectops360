import {
  authorizeKnowledgeAction,
  createKnowledgeObjectSchema,
  createKnowledgeRelationSchema,
  resolveKnowledgeRelationSchema,
  reviseKnowledgeObjectSchema,
  transitionKnowledgeObjectSchema,
} from "./contracts";
import type { KnowledgeLayerRepository } from "./repository";
import type {
  CreateKnowledgeObjectInput,
  CreateKnowledgeRelationInput,
  KnowledgeActorContext,
  KnowledgeObjectListFilter,
  KnowledgeRelationListFilter,
  ResolveKnowledgeRelationInput,
  ReviseKnowledgeObjectInput,
  TransitionKnowledgeObjectInput,
} from "./types";

export class KnowledgeLayerError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
    this.name = "KnowledgeLayerError";
  }
}

function assertAuthorized(context: KnowledgeActorContext, action: Parameters<typeof authorizeKnowledgeAction>[1]) {
  if (!authorizeKnowledgeAction(context.role, action)) {
    throw new KnowledgeLayerError("knowledge_action_forbidden");
  }
}

export class KnowledgeLayerService {
  constructor(private readonly repository: KnowledgeLayerRepository) {}

  async propose(context: KnowledgeActorContext, input: CreateKnowledgeObjectInput) {
    assertAuthorized(context, "propose");
    const parsed = createKnowledgeObjectSchema.safeParse(input);
    if (!parsed.success) throw new KnowledgeLayerError("invalid_knowledge_proposal", parsed.error.issues[0]?.message);
    return this.repository.create(context, parsed.data);
  }

  async revise(context: KnowledgeActorContext, input: ReviseKnowledgeObjectInput) {
    assertAuthorized(context, "revise");
    const parsed = reviseKnowledgeObjectSchema.safeParse(input);
    if (!parsed.success) throw new KnowledgeLayerError("invalid_knowledge_revision", parsed.error.issues[0]?.message);
    return this.repository.revise(context, parsed.data);
  }

  async validate(context: KnowledgeActorContext, input: Omit<TransitionKnowledgeObjectInput, "targetStatus">) {
    assertAuthorized(context, "validate");
    const parsed = transitionKnowledgeObjectSchema.safeParse({ ...input, targetStatus: "validated" });
    if (!parsed.success) throw new KnowledgeLayerError("invalid_knowledge_transition", parsed.error.issues[0]?.message);
    return this.repository.transition(context, parsed.data);
  }

  async activate(context: KnowledgeActorContext, input: Omit<TransitionKnowledgeObjectInput, "targetStatus">) {
    assertAuthorized(context, "activate");
    const parsed = transitionKnowledgeObjectSchema.safeParse({ ...input, targetStatus: "active" });
    if (!parsed.success) throw new KnowledgeLayerError("invalid_knowledge_transition", parsed.error.issues[0]?.message);
    return this.repository.transition(context, parsed.data);
  }

  async list(
    context: KnowledgeActorContext,
    projectId: string,
    filter?: KnowledgeObjectListFilter,
  ) {
    assertAuthorized(context, "read");
    if (!zUuid(projectId)) throw new KnowledgeLayerError("invalid_project_id");
    return this.repository.list(context, projectId, filter);
  }

  async history(context: KnowledgeActorContext, projectId: string, knowledgeObjectId: string) {
    assertAuthorized(context, "read");
    if (!zUuid(projectId)) throw new KnowledgeLayerError("invalid_project_id");
    if (!zUuid(knowledgeObjectId)) throw new KnowledgeLayerError("invalid_knowledge_object_id");
    return this.repository.history(context, projectId, knowledgeObjectId);
  }

  /**
   * Organization-scoped knowledge (ADR-013).
   *
   * Separate from `list` rather than a filter on it, so a project view cannot
   * accidentally include governance objects by omitting a parameter. The two
   * scopes are asked for explicitly or not at all.
   */
  async listOrganizationScoped(context: KnowledgeActorContext, filter?: KnowledgeObjectListFilter) {
    assertAuthorized(context, "read");
    return this.repository.listOrganizationScoped(context, filter);
  }

  async relate(context: KnowledgeActorContext, input: CreateKnowledgeRelationInput) {
    // Asserting a relation is a proposal about how knowledge connects, which is
    // the same authority as proposing knowledge. Confirming one that requires
    // approval is enforced by the repository recording the approver, and by the
    // database refusing an endpoint the relation type does not accept.
    assertAuthorized(context, "propose");
    const parsed = createKnowledgeRelationSchema.safeParse(input);
    if (!parsed.success) throw new KnowledgeLayerError("invalid_knowledge_relation", parsed.error.issues[0]?.message);
    return this.repository.createRelation(context, parsed.data);
  }

  /**
   * Accept or resolve a contradiction.
   *
   * Requires validate authority, not propose: recording that an inconsistency
   * is acceptable is a judgement about the knowledge, not a contribution to it.
   * A contradiction is never deleted, and there is no path back to `unresolved`.
   */
  async resolveRelation(context: KnowledgeActorContext, input: ResolveKnowledgeRelationInput) {
    assertAuthorized(context, "validate");
    const parsed = resolveKnowledgeRelationSchema.safeParse(input);
    if (!parsed.success) throw new KnowledgeLayerError("invalid_knowledge_relation_resolution", parsed.error.issues[0]?.message);
    return this.repository.resolveRelation(context, parsed.data);
  }

  async listRelations(context: KnowledgeActorContext, filter?: KnowledgeRelationListFilter) {
    assertAuthorized(context, "read");
    if (filter?.objectId && !zUuid(filter.objectId)) throw new KnowledgeLayerError("invalid_knowledge_object_id");
    return this.repository.listRelations(context, filter);
  }
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
