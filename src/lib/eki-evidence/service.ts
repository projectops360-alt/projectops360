import {
  assignOwnerSchema,
  authorizeEvidenceAction,
  bindingScheduleSchema,
  createEvidenceBindingSchema,
  resolveFindingSchema,
  type EvidenceAction,
} from "./contracts";
import type { EkiEvidenceRepository } from "./repository";
import type {
  AssignOwnerInput,
  BindingScheduleInput,
  CreateEvidenceBindingInput,
  EvidenceActorContext,
  ResolveFindingInput,
} from "./types";

export class EkiEvidenceError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
    this.name = "EkiEvidenceError";
  }
}

function assertAuthorized(context: EvidenceActorContext, action: EvidenceAction) {
  if (!authorizeEvidenceAction(context.role, action)) {
    throw new EkiEvidenceError("eki_evidence_action_forbidden");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, code: string) {
  if (!UUID.test(value)) throw new EkiEvidenceError(code);
}

/**
 * Domain services for the evidence engine.
 *
 * Every method fails closed. An input that cannot be validated, a role that
 * cannot be authorized and a database denial all end as an `EkiEvidenceError`;
 * none of them fall through to a permissive default. The engine reports what it
 * could establish, and reports the absence of evidence as absence — never as a
 * pass.
 */
export class EkiEvidenceService {
  constructor(private readonly repository: EkiEvidenceRepository) {}

  async defineBinding(context: EvidenceActorContext, input: CreateEvidenceBindingInput) {
    assertAuthorized(context, "define_binding");
    const parsed = createEvidenceBindingSchema.safeParse(input);
    if (!parsed.success) throw new EkiEvidenceError("invalid_evidence_binding", parsed.error.issues[0]?.message);
    return this.repository.createBinding(context, parsed.data);
  }

  /**
   * Activating a binding says the specification is ready to be measured against.
   * It does not say the control passes: the first evaluation decides that, and
   * until it runs the binding has produced no evidence at all.
   */
  async activateBinding(context: EvidenceActorContext, bindingObjectId: string) {
    assertAuthorized(context, "define_binding");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.setBindingState(context, bindingObjectId, "active");
  }

  /**
   * Retirement is terminal and does not erase history. Evaluations already
   * recorded stay recorded, because a binding that stopped being measured is
   * itself a fact an auditor needs.
   */
  async retireBinding(context: EvidenceActorContext, bindingObjectId: string) {
    assertAuthorized(context, "define_binding");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.setBindingState(context, bindingObjectId, "retired");
  }

  async getBinding(context: EvidenceActorContext, bindingObjectId: string) {
    assertAuthorized(context, "read");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.getBinding(context, bindingObjectId);
  }

  async listBindings(context: EvidenceActorContext) {
    assertAuthorized(context, "read");
    return this.repository.listBindings(context);
  }

  /**
   * Evaluate a binding and synchronise everything that follows from the result:
   * the evaluation record, the binding state, the control state and any finding.
   *
   * One call, because the four are a single fact about the control. Recording an
   * evaluation without updating the control would leave a system that knows the
   * evidence lapsed and still displays `operating`.
   */
  async evaluate(context: EvidenceActorContext, bindingObjectId: string) {
    assertAuthorized(context, "evaluate");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.evaluateAndSync(context, bindingObjectId);
  }

  async latestEvaluation(context: EvidenceActorContext, bindingObjectId: string) {
    assertAuthorized(context, "read");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.latestEvaluation(context, bindingObjectId);
  }

  async evidenceHistory(context: EvidenceActorContext, bindingObjectId: string, limit?: number) {
    assertAuthorized(context, "read");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.evaluationHistory(context, bindingObjectId, limit);
  }

  /**
   * The evidence status of a control: its recorded state, the gate that decides
   * whether it may operate, and the findings currently open against it.
   *
   * The gate is returned alongside the state rather than folded into it. A
   * control reading `degraded` and a control reading `degraded because its owner
   * is unassigned` demand different work, and a single state string cannot say
   * which.
   */
  async controlEvidenceStatus(context: EvidenceActorContext, controlObjectId: string) {
    assertAuthorized(context, "read");
    assertUuid(controlObjectId, "invalid_control_object_id");
    const runtime = await this.repository.getControlRuntime(context, controlObjectId);
    if (!runtime) return null;
    const [gate, findings] = await Promise.all([
      this.repository.controlGate(context, controlObjectId),
      this.repository.listOpenFindings(context, controlObjectId),
    ]);
    return { control: runtime, gate, openFindings: findings };
  }

  async recalculateControl(context: EvidenceActorContext, controlObjectId: string) {
    assertAuthorized(context, "evaluate");
    assertUuid(controlObjectId, "invalid_control_object_id");
    return this.repository.recalculateControl(context, controlObjectId);
  }

  async listOpenFindings(context: EvidenceActorContext, targetObjectId?: string) {
    assertAuthorized(context, "read");
    if (targetObjectId) assertUuid(targetObjectId, "invalid_target_object_id");
    return this.repository.listOpenFindings(context, targetObjectId);
  }

  /**
   * Close a finding on a named human's authority.
   *
   * The database returns denials instead of raising them, so the refusal is
   * recorded before this layer sees it. Converting that into an error here is
   * the last step, not the enforcement: the audit row exists either way.
   */
  async resolveFinding(context: EvidenceActorContext, input: ResolveFindingInput) {
    assertAuthorized(context, "resolve_finding");
    const parsed = resolveFindingSchema.safeParse(input);
    if (!parsed.success) throw new EkiEvidenceError("invalid_finding_resolution", parsed.error.issues[0]?.message);
    const result = await this.repository.resolveFinding(context, parsed.data);
    if (!result.authorized) throw new EkiEvidenceError(result.reason || "eki_finding_resolution_forbidden");
    return result.value ?? { controlState: null };
  }

  // ── Macrophase 3 — automation surface ─────────────────────────────────────

  /**
   * Set how often this binding is measured.
   *
   * The cadence is policy, so changing it needs define_binding authority, not
   * evaluate: lengthening an interval to a year hides a lapse, and nobody with
   * only the right to run a measurement should be able to decide that.
   */
  async setSchedule(context: EvidenceActorContext, bindingObjectId: string, input: BindingScheduleInput) {
    assertAuthorized(context, "define_binding");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    const parsed = bindingScheduleSchema.safeParse(input);
    if (!parsed.success) throw new EkiEvidenceError("invalid_binding_schedule", parsed.error.issues[0]?.message);
    return this.repository.setSchedule(context, bindingObjectId, parsed.data);
  }

  /**
   * Evaluate now, on a named human's request, whether or not the binding is due.
   *
   * An explicit request may bypass the cadence; the scheduler may not. The
   * cadence IS the policy, and a sweep that ignores it is not measuring on a
   * cadence at all.
   */
  async requestEvaluation(context: EvidenceActorContext, bindingObjectId: string) {
    assertAuthorized(context, "evaluate");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    const result = await this.repository.requestEvaluation(context, bindingObjectId);
    if (!result.authorized) throw new EkiEvidenceError(result.reason || "eki_evaluation_forbidden");
    return result.value ?? { evaluated: false };
  }

  async listRuns(context: EvidenceActorContext, limit?: number) {
    assertAuthorized(context, "read");
    return this.repository.listRuns(context, limit);
  }

  async runDetail(context: EvidenceActorContext, runId: string) {
    assertAuthorized(context, "read");
    assertUuid(runId, "invalid_run_id");
    return this.repository.listRunItems(context, runId);
  }

  async bindingRunHistory(context: EvidenceActorContext, bindingObjectId: string, limit?: number) {
    assertAuthorized(context, "read");
    assertUuid(bindingObjectId, "invalid_binding_object_id");
    return this.repository.bindingRunHistory(context, bindingObjectId, limit);
  }

  async assignOwner(context: EvidenceActorContext, input: AssignOwnerInput) {
    assertAuthorized(context, "assign_owner");
    const parsed = assignOwnerSchema.safeParse(input);
    if (!parsed.success) throw new EkiEvidenceError("invalid_owner_assignment", parsed.error.issues[0]?.message);
    const result = await this.repository.assignOwner(context, parsed.data);
    if (!result.authorized) throw new EkiEvidenceError(result.reason || "eki_owner_assignment_forbidden");
    return result.value ?? { previousOwner: null };
  }
}
