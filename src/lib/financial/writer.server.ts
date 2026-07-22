import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  prepareAtomicEvent,
  type EmitEventInput,
  type EmitResult,
} from "@/lib/events/ingestion";
import { getFinancialFeatureStateFromProcess } from "./flags";

export type FinancialMovementDomain =
  | "funding"
  | "commitment"
  | "actual"
  | "accrual"
  | "payment"
  | "reserve";

const DOMAIN_EVENT_TYPES: Record<FinancialMovementDomain, ReadonlySet<string>> = {
  funding: new Set(["funding_released", "financial_record_reversed"]),
  commitment: new Set(["commitment_posted", "financial_record_reversed"]),
  actual: new Set(["actual_posted", "financial_record_reversed"]),
  accrual: new Set(["accrual_posted", "financial_record_reversed"]),
  payment: new Set(["payment_settled", "financial_record_reversed"]),
  reserve: new Set(["reserve_released", "financial_record_reversed"]),
};

export interface FinancialMovementCaptureInput {
  domain: FinancialMovementDomain;
  parentId: string;
  movement: Record<string, unknown> & { id: string };
  operationKey: string;
  event: Omit<EmitEventInput, "idempotencyKey" | "subjectId">;
}

export interface PreparedFinancialMovementCapture {
  p_domain: FinancialMovementDomain;
  p_parent_id: string;
  p_movement: Record<string, unknown>;
  p_event: Record<string, unknown>;
  p_payload_text: string;
  p_refs: { object_type: string; object_id: string; role: string }[];
  p_operation_key: string;
  p_fingerprint: string;
}

type PrepareResult =
  | { ok: true; data: PreparedFinancialMovementCapture }
  | { ok: false; errors: string[] };

interface FinancialRpcResult {
  ok?: boolean;
  deduped?: boolean;
  event_id?: string;
  error?: string;
}

export function prepareFinancialMovementCapture(
  input: FinancialMovementCaptureInput,
): PrepareResult {
  const errors: string[] = [];
  if (!input.parentId) errors.push("parent_id is required");
  if (!input.movement.id) errors.push("movement.id is required");
  if (!input.operationKey.trim()) errors.push("operation_key is required");
  if (!DOMAIN_EVENT_TYPES[input.domain].has(input.event.eventType)) {
    errors.push(`event_type ${input.event.eventType} is not allowed for ${input.domain}`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const prepared = prepareAtomicEvent({
    ...input.event,
    subjectId: input.movement.id,
    idempotencyKey: input.operationKey,
  });
  if (!prepared.ok) return prepared;

  const provenance = prepared.data.event.provenance as Record<string, unknown> | undefined;
  const fingerprint = provenance?.idempotency_fingerprint;
  if (typeof fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(fingerprint)) {
    return { ok: false, errors: ["idempotency_fingerprint was not generated"] };
  }

  return {
    ok: true,
    data: {
      p_domain: input.domain,
      p_parent_id: input.parentId,
      p_movement: input.movement,
      p_event: prepared.data.event,
      p_payload_text: prepared.data.payloadText,
      p_refs: prepared.data.refs,
      p_operation_key: input.operationKey,
      p_fingerprint: fingerprint,
    },
  };
}

export async function captureFinancialMovementAtomic(
  input: FinancialMovementCaptureInput,
): Promise<EmitResult> {
  if (!getFinancialFeatureStateFromProcess(input.event.projectId).writers) {
    return { ok: false, error: "financial_writers_disabled" };
  }

  const prepared = prepareFinancialMovementCapture(input);
  if (!prepared.ok) {
    return { ok: false, error: "validation_failed", errors: prepared.errors };
  }

  try {
    const rpcName = input.domain === "actual"
      ? "capture_financial_actual_atomic"
      : "capture_financial_movement_atomic";
    const { data, error } = await createAdminClient().rpc(
      rpcName,
      prepared.data,
    );
    if (error) {
      console.error("[financial] atomic movement capture failed:", error.message);
      return { ok: false, error: error.message || "financial_capture_failed" };
    }
    const result = data as FinancialRpcResult | null;
    if (!result?.ok || !result.event_id) {
      return { ok: false, error: result?.error ?? "financial_capture_failed" };
    }
    return {
      ok: true,
      eventId: result.event_id,
      deduped: result.deduped === true,
    };
  } catch (error) {
    console.error("[financial] atomic movement capture exception:", error);
    return { ok: false, error: "exception" };
  }
}
