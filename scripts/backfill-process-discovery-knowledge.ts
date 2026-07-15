import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { buildProcessDiscoveryKnowledgeProposals, type KnowledgeBackfillEvent } from "../src/lib/knowledge-layer/process-discovery-backfill";
import { createSupabaseKnowledgeLayerRepository } from "../src/lib/knowledge-layer/repository";
import { KnowledgeLayerService } from "../src/lib/knowledge-layer/service";
import type { KnowledgeActorRole } from "../src/lib/knowledge-layer/types";

loadEnvConfig(process.cwd());

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const projectId = argument("project");
  const actorId = argument("actor");
  const execute = process.argv.includes("--execute");
  if (!projectId || !actorId) throw new Error("Usage: npm run knowledge:backfill -- --project=<uuid> --actor=<uuid> [--execute]");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const projectResult = await client.from("projects").select("id,organization_id").eq("id", projectId).single();
  if (projectResult.error || !projectResult.data) throw new Error(projectResult.error?.message ?? "project_not_found");
  const organizationId = String(projectResult.data.organization_id);
  const memberResult = await client.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", actorId).single();
  if (memberResult.error || !memberResult.data) throw new Error(memberResult.error?.message ?? "actor_not_member");
  const role = String(memberResult.data.role) as KnowledgeActorRole;
  if (!(["owner", "admin", "member"] as string[]).includes(role)) throw new Error("actor_cannot_propose_knowledge");

  const eventsResult = await client.from("project_event_log").select([
    "event_id", "organization_id", "project_id", "case_id", "event_type", "event_category",
    "occurred_at", "recorded_at", "sequence_number", "event_lifecycle_class", "is_compensating_event",
  ].join(",")).eq("organization_id", organizationId).eq("project_id", projectId).order("sequence_number", { ascending: true }).limit(1000);
  if (eventsResult.error) throw new Error(eventsResult.error.message);

  const events = (eventsResult.data ?? []).map((row) => ({
    eventId: String(row.event_id),
    evidenceRef: String(row.event_id),
    organizationId: String(row.organization_id),
    projectId: String(row.project_id),
    caseId: String(row.case_id),
    eventType: String(row.event_type),
    eventCategory: String(row.event_category),
    occurredAt: row.occurred_at == null ? null : String(row.occurred_at),
    recordedAt: String(row.recorded_at),
    sequenceNumber: Number(row.sequence_number),
    lifecycleClass: String(row.event_lifecycle_class),
    isCompensatingEvent: Boolean(row.is_compensating_event),
  })) satisfies KnowledgeBackfillEvent[];

  const proposals = buildProcessDiscoveryKnowledgeProposals(events, organizationId, projectId);
  const preview = proposals.map((proposal) => ({
    idempotencyKey: proposal.idempotencyKey,
    knowledgeType: proposal.knowledgeType,
    title: proposal.title,
    confidence: proposal.confidence,
    evidenceCount: proposal.evidence.length,
  }));

  if (!execute) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", projectId, events: events.length, proposals: preview }, null, 2)}\n`);
    process.exit(0);
  }

  const service = new KnowledgeLayerService(createSupabaseKnowledgeLayerRepository(client, client));
  const context = { organizationId, userId: actorId, role };
  const results = [];
  for (const proposal of proposals) results.push(await service.propose(context, proposal));
  process.stdout.write(`${JSON.stringify({ mode: "execute", projectId, events: events.length, proposals: preview, results }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
