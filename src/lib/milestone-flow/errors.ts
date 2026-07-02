// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Errors (Phase 3, Task 1)
// ============================================================================
// Typed, testable engine failures. Every abnormal condition maps to a stable
// MpfErrorCode so callers, tests, and observability can branch deterministically
// instead of parsing message strings. Pure — no I/O.
// ============================================================================

import { MPF_ERROR_CODES } from "./constants";

export type MpfErrorCode = (typeof MPF_ERROR_CODES)[number];

/** Base engine error. Carries a stable code and optional structured context. */
export class MpfError extends Error {
  readonly code: MpfErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(code: MpfErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "MpfError";
    this.code = code;
    this.context = context;
    // Preserve prototype chain when compiled to ES5-ish targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MpfMissingProjectScopeError extends MpfError {
  constructor(context?: Record<string, unknown>) {
    super("MISSING_PROJECT_SCOPE", "A project scope (projectId) is required.", context);
    this.name = "MpfMissingProjectScopeError";
  }
}

export class MpfMissingOrganizationScopeError extends MpfError {
  constructor(context?: Record<string, unknown>) {
    super("MISSING_ORGANIZATION_SCOPE", "An organization scope (organizationId) is required.", context);
    this.name = "MpfMissingOrganizationScopeError";
  }
}

export class MpfUnauthorizedAccessError extends MpfError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super("UNAUTHORIZED_ACCESS", reason, context);
    this.name = "MpfUnauthorizedAccessError";
  }
}

export class MpfInvalidEventInputError extends MpfError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super("INVALID_EVENT_INPUT", reason, context);
    this.name = "MpfInvalidEventInputError";
  }
}

export class MpfInvalidMilestoneInputError extends MpfError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super("INVALID_MILESTONE_INPUT", reason, context);
    this.name = "MpfInvalidMilestoneInputError";
  }
}

export class MpfUnsupportedOperationError extends MpfError {
  constructor(operation: string, context?: Record<string, unknown>) {
    super(
      "UNSUPPORTED_ENGINE_OPERATION",
      `Operation "${operation}" is not implemented in this engine phase (Phase 3, Task 1 is architecture + contracts only).`,
      { operation, ...context },
    );
    this.name = "MpfUnsupportedOperationError";
  }
}

export class MpfMissingEvidenceError extends MpfError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super("MISSING_EVIDENCE", reason, context);
    this.name = "MpfMissingEvidenceError";
  }
}

export class MpfReplayIncompatibilityError extends MpfError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super("REPLAY_INCOMPATIBILITY", reason, context);
    this.name = "MpfReplayIncompatibilityError";
  }
}

export class MpfUnknownFailureError extends MpfError {
  constructor(reason = "An unknown engine failure occurred.", context?: Record<string, unknown>) {
    super("UNKNOWN_ENGINE_FAILURE", reason, context);
    this.name = "MpfUnknownFailureError";
  }
}

/** Narrowing guard for engine-originated errors. */
export function isMpfError(err: unknown): err is MpfError {
  return err instanceof MpfError;
}
