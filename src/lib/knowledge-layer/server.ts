import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseKnowledgeLayerRepository } from "./repository";
import { KnowledgeLayerService } from "./service";
import type {
  CreateKnowledgeObjectInput,
  KnowledgeObjectListFilter,
  ReviseKnowledgeObjectInput,
  TransitionKnowledgeObjectInput,
} from "./types";

async function runtime() {
  const org = await getOrgContext();
  const repository = createSupabaseKnowledgeLayerRepository(await createClient(), createAdminClient());
  return {
    context: {
      organizationId: org.organizationId,
      userId: org.userId,
      role: org.role,
    },
    service: new KnowledgeLayerService(repository),
  };
}

export async function proposeProjectKnowledgeObject(input: CreateKnowledgeObjectInput) {
  const { context, service } = await runtime();
  return service.propose(context, input);
}

export async function reviseProjectKnowledgeObject(input: ReviseKnowledgeObjectInput) {
  const { context, service } = await runtime();
  return service.revise(context, input);
}

export async function validateProjectKnowledgeObject(input: Omit<TransitionKnowledgeObjectInput, "targetStatus">) {
  const { context, service } = await runtime();
  return service.validate(context, input);
}

export async function activateProjectKnowledgeObject(input: Omit<TransitionKnowledgeObjectInput, "targetStatus">) {
  const { context, service } = await runtime();
  return service.activate(context, input);
}

export async function listProjectKnowledgeObjects(projectId: string, filter?: KnowledgeObjectListFilter) {
  const { context, service } = await runtime();
  return service.list(context, projectId, filter);
}

export async function getProjectKnowledgeObjectHistory(projectId: string, knowledgeObjectId: string) {
  const { context, service } = await runtime();
  return service.history(context, projectId, knowledgeObjectId);
}
