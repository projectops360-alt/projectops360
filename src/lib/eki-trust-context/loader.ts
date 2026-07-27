import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InstantiatedBinding,
  InstantiatedControl,
  NormativeStatement,
  ObservedControlState,
  ObservedEvaluation,
  ObservedFinding,
  TrustAuditReference,
  TrustContext,
  TruthLayer,
} from "./types";

/**
 * Reads the Enterprise Trust context out of the canonical model.
 *
 * Everything comes from tables that already existed: knowledge objects and their
 * relations, the EKI runtime, and the governance audit. There is no compliance
 * store and no second corpus — the whole point of ADR-014 is that a governance
 * object is a knowledge object, and a parallel reader would quietly undo that.
 *
 * The caller's client is used, so RLS decides what is visible. A trust context
 * assembled with the service role would happily cross tenants.
 */

const EVALUATION_WINDOW = 200;
const AUDIT_WINDOW = 100;

export interface TrustContextLoadResult {
  context: TrustContext;
  /** Layers that could not be read. Named, so absence is never mistaken for "nothing". */
  unavailable: TruthLayer[];
}

export async function loadTrustContext(
  client: SupabaseClient,
  organizationId: string,
  assembledAt: string,
): Promise<TrustContextLoadResult> {
  const unavailable: TruthLayer[] = [];

  const [objectsRes, controlsRes, bindingsRes, findingsRes, relationsRes] = await Promise.all([
    client
      .from("project_knowledge_object_current")
      .select("id, knowledge_type, owner_user_id, current_status, title, summary, structured_content")
      .eq("organization_id", organizationId)
      .eq("scope_type", "organization")
      .in("knowledge_type", ["control", "evidence_binding", "obligation", "control_mapping"])
      .limit(500),
    client
      .from("eki_control_runtime")
      .select("control_object_id, control_state, last_state_change_at, last_evaluated_at")
      .eq("organization_id", organizationId)
      .limit(500),
    client
      .from("eki_evidence_binding_runtime")
      .select(
        "binding_object_id, resolver_key, freshness_interval, evaluation_interval, evaluation_enabled, next_due_at",
      )
      .eq("organization_id", organizationId)
      .limit(500),
    client
      .from("eki_open_findings")
      .select("finding_object_id, target_object_id, condition_code, opened_at, last_seen_at, occurrence_count")
      .eq("organization_id", organizationId)
      .limit(500),
    client
      .from("project_knowledge_relations")
      .select("relation_type, source_object_id, target_object_id, basis, resolution_status")
      .eq("organization_id", organizationId)
      .limit(1000),
  ]);

  if (objectsRes.error) unavailable.push("instantiated");
  if (controlsRes.error || findingsRes.error) unavailable.push("observed");

  const objects = (objectsRes.data ?? []) as Array<Record<string, unknown>>;
  const controlObjects = objects.filter((o) => o.knowledge_type === "control");
  const bindingObjects = new Map(
    objects.filter((o) => o.knowledge_type === "evidence_binding").map((o) => [String(o.id), o]),
  );

  const relations = (relationsRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      relationType: String(r.relation_type),
      sourceObjectId: String(r.source_object_id),
      targetObjectId: String(r.target_object_id),
      basis: String(r.basis ?? "declared"),
      resolutionStatus: r.resolution_status == null ? null : String(r.resolution_status),
      contradictory: r.relation_type === "contradicts",
    };
  });

  const bindingRuntime = new Map(
    (bindingsRes.data ?? []).map((row) => {
      const b = row as Record<string, unknown>;
      return [String(b.binding_object_id), b];
    }),
  );

  // Which bindings support which control. `supports` is the canonical edge from
  // Macrophase 1; nothing else establishes the link.
  const bindingsByControl = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.relationType !== "supports") continue;
    if (!bindingRuntime.has(relation.targetObjectId)) continue;
    const list = bindingsByControl.get(relation.sourceObjectId) ?? [];
    list.push(relation.targetObjectId);
    bindingsByControl.set(relation.sourceObjectId, list);
  }

  const instantiated: InstantiatedControl[] = controlObjects.map((control) => {
    const controlId = String(control.id);
    const bindings: InstantiatedBinding[] = (bindingsByControl.get(controlId) ?? []).map((bindingId) => {
      const runtime = bindingRuntime.get(bindingId) ?? {};
      const spec = bindingObjects.get(bindingId) ?? {};
      return {
        bindingObjectId: bindingId,
        title: String(spec.title ?? bindingId),
        resolverKey: String(runtime.resolver_key ?? "unknown"),
        freshnessInterval: String(runtime.freshness_interval ?? ""),
        evaluationInterval: String(runtime.evaluation_interval ?? ""),
        evaluationEnabled: Boolean(runtime.evaluation_enabled ?? false),
        nextDueAt: runtime.next_due_at == null ? null : String(runtime.next_due_at),
      };
    });
    return {
      layer: "instantiated",
      controlObjectId: controlId,
      title: String(control.title ?? ""),
      summary: String(control.summary ?? ""),
      knowledgeStatus: String(control.current_status ?? "proposed"),
      ownerUserId: control.owner_user_id == null ? null : String(control.owner_user_id),
      ownerName: null,
      bindings,
    };
  });

  // Evaluations for the bindings actually in scope, newest first by SEQUENCE.
  const bindingIds = [...bindingRuntime.keys()];
  let evaluations: ObservedEvaluation[] = [];
  if (bindingIds.length > 0) {
    const evaluationsRes = await client
      .from("eki_evidence_evaluations")
      .select(
        "id, binding_object_id, sequence_no, evaluated_at, outcome, reason_code, evidence_count, latest_evidence_at, contradiction_count, detail",
      )
      .eq("organization_id", organizationId)
      .in("binding_object_id", bindingIds)
      .order("sequence_no", { ascending: false })
      .limit(EVALUATION_WINDOW);
    if (evaluationsRes.error) {
      if (!unavailable.includes("observed")) unavailable.push("observed");
    } else {
      evaluations = (evaluationsRes.data ?? []).map((row) => {
        const e = row as Record<string, unknown>;
        const detail = (e.detail ?? {}) as Record<string, unknown>;
        return {
          bindingObjectId: String(e.binding_object_id),
          evaluationId: String(e.id),
          sequenceNo: Number(e.sequence_no),
          evaluatedAt: String(e.evaluated_at),
          outcome: e.outcome as ObservedEvaluation["outcome"],
          reasonCode: String(e.reason_code),
          evidenceCount: Number(e.evidence_count ?? 0),
          latestEvidenceAt: e.latest_evidence_at == null ? null : String(e.latest_evidence_at),
          contradictionCount: Number(e.contradiction_count ?? 0),
          // Provenance travels with the measurement: which table answered.
          sourceTable: detail.source == null ? null : String(detail.source),
        };
      });
    }
  }

  const findings: ObservedFinding[] = (findingsRes.data ?? []).map((row) => {
    const f = row as Record<string, unknown>;
    return {
      findingObjectId: String(f.finding_object_id),
      targetObjectId: String(f.target_object_id),
      conditionCode: f.condition_code as ObservedFinding["conditionCode"],
      severity: null,
      openedAt: String(f.opened_at),
      lastSeenAt: String(f.last_seen_at),
      occurrenceCount: Number(f.occurrence_count ?? 1),
      ownerUserId: null,
    };
  });

  const evaluationsByControl = new Map<string, ObservedEvaluation[]>();
  for (const [controlId, ids] of bindingsByControl) {
    evaluationsByControl.set(
      controlId,
      evaluations.filter((e) => ids.includes(e.bindingObjectId)),
    );
  }

  const observed: ObservedControlState[] = (controlsRes.data ?? []).map((row) => {
    const c = row as Record<string, unknown>;
    const controlId = String(c.control_object_id);
    return {
      layer: "observed",
      controlObjectId: controlId,
      controlState: c.control_state as ObservedControlState["controlState"],
      lastStateChangeAt: String(c.last_state_change_at),
      lastEvaluatedAt: c.last_evaluated_at == null ? null : String(c.last_evaluated_at),
      // Derived from the evidence rather than restated: the authoritative gate
      // lives in SQL and is recomputed there, not mirrored here.
      gateReasons: deriveGateReasons(
        controlId,
        instantiated.find((i) => i.controlObjectId === controlId),
        evaluationsByControl.get(controlId) ?? [],
        relations,
      ),
      evaluations: evaluationsByControl.get(controlId) ?? [],
      findings: findings.filter((f) => f.targetObjectId === controlId),
    };
  });

  // Normative content lives in knowledge packages (ADR-015), never as objects
  // with an empty lifecycle. `obligation` objects are the mapping, not the text.
  const normative: NormativeStatement[] = objects
    .filter((o) => o.knowledge_type === "obligation")
    .map((o) => {
      const structured = (o.structured_content ?? {}) as Record<string, unknown>;
      const satisfiedBy = relations
        .filter((r) => r.relationType === "satisfies" && r.targetObjectId === String(o.id))
        .map((r) => r.sourceObjectId);
      return {
        layer: "normative" as const,
        packageId: String(structured.package_id ?? o.id),
        packageTitle: String(o.title ?? ""),
        requirement: String(o.summary ?? ""),
        satisfiedByControlIds: satisfiedBy,
      };
    });
  if (normative.length === 0) unavailable.push("normative");

  const auditRes = await client
    .from("platform_governance_audit")
    .select("event_id, sequence_number, event_type, decision, actor_role, occurred_at, reason_codes")
    .eq("organization_id", organizationId)
    .order("sequence_number", { ascending: false })
    .limit(AUDIT_WINDOW);

  const auditReferences: TrustAuditReference[] = auditRes.error
    ? []
    : (auditRes.data ?? []).map((row) => {
        const a = row as Record<string, unknown>;
        return {
          eventId: String(a.event_id),
          sequenceNumber: Number(a.sequence_number),
          eventType: String(a.event_type),
          decision: String(a.decision),
          actorRole: String(a.actor_role),
          occurredAt: String(a.occurred_at),
          reasonCodes: Array.isArray(a.reason_codes) ? a.reason_codes.map(String) : [],
        };
      });

  return {
    context: {
      organizationId,
      assembledAt,
      normative,
      instantiated,
      observed,
      relations,
      auditReferences,
      unavailableLayers: unavailable,
    },
    unavailable,
  };
}

/**
 * The reasons a control is not operating, derived from what was read.
 *
 * A mirror of the SQL gate, not a replacement for it: `eki_control_can_operate`
 * remains authoritative and is what actually moves the state. This exists so a
 * reader can be told WHY without a round trip, and it is tested against the same
 * six conditions so the two cannot silently disagree.
 */
export function deriveGateReasons(
  controlObjectId: string,
  control: InstantiatedControl | undefined,
  evaluations: readonly ObservedEvaluation[],
  relations: readonly { relationType: string; sourceObjectId: string; targetObjectId: string; resolutionStatus: string | null }[],
): string[] {
  const reasons: string[] = [];
  if (!control) return ["control_runtime_missing"];
  if (control.knowledgeStatus !== "active") reasons.push("control_specification_not_active");
  if (!control.ownerUserId) reasons.push("owner_not_assigned");
  if (control.bindings.length === 0) reasons.push("no_evidence_binding");

  const latest = new Map<string, ObservedEvaluation>();
  for (const evaluation of evaluations) {
    const current = latest.get(evaluation.bindingObjectId);
    if (!current || evaluation.sequenceNo > current.sequenceNo) latest.set(evaluation.bindingObjectId, evaluation);
  }
  const healthy = [...latest.values()].filter(
    (e) => e.outcome === "current" || e.outcome === "approaching_stale",
  );
  if (control.bindings.length > 0 && healthy.length === 0) reasons.push("no_fresh_evidence");

  const contradicted = relations.some(
    (r) =>
      r.relationType === "contradicts" &&
      r.resolutionStatus === "unresolved" &&
      (r.sourceObjectId === controlObjectId || r.targetObjectId === controlObjectId),
  );
  if (contradicted) reasons.push("unresolved_contradiction");

  return reasons;
}
