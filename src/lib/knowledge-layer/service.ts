import {
  authorizeKnowledgeAction,
  createKnowledgeObjectSchema,
  reviseKnowledgeObjectSchema,
  transitionKnowledgeObjectSchema,
} from "./contracts";
import type { KnowledgeLayerRepository } from "./repository";
import type {
  CreateKnowledgeObjectInput,
  KnowledgeActorContext,
  KnowledgeObjectListFilter,
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
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
