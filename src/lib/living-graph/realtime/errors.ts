// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Errors (Phase 4, Task 1)
// ============================================================================
// Typed, testable failure modes. The engine fails loudly and specifically —
// it never degrades into fabricated output (mirrors src/lib/milestone-flow/errors.ts).
// ============================================================================

import type { LivingGraphRealtimeErrorCode } from "./types";

export class LgreError extends Error {
  readonly code: LivingGraphRealtimeErrorCode;

  constructor(code: LivingGraphRealtimeErrorCode, message: string) {
    super(message);
    this.name = "LgreError";
    this.code = code;
  }
}

export class LgreMissingProjectScopeError extends LgreError {
  constructor(message = "A project-level scope with projectId is required.") {
    super("MISSING_PROJECT_SCOPE", message);
    this.name = "LgreMissingProjectScopeError";
  }
}

export class LgreMissingOrganizationScopeError extends LgreError {
  constructor(message = "An organizationId is required on every scope.") {
    super("MISSING_ORGANIZATION_SCOPE", message);
    this.name = "LgreMissingOrganizationScopeError";
  }
}

export class LgreUnauthorizedAccessError extends LgreError {
  constructor(message = "Caller is not authorized for realtime access to this scope.") {
    super("UNAUTHORIZED_REALTIME_ACCESS", message);
    this.name = "LgreUnauthorizedAccessError";
  }
}

export class LgreInvalidSubscriptionTopicError extends LgreError {
  constructor(message = "Subscription topic is not in the registered topic set.") {
    super("INVALID_SUBSCRIPTION_TOPIC", message);
    this.name = "LgreInvalidSubscriptionTopicError";
  }
}

export class LgreInvalidChangeNoticeError extends LgreError {
  constructor(message = "Change notice is malformed or missing required fields.") {
    super("INVALID_CHANGE_NOTICE", message);
    this.name = "LgreInvalidChangeNoticeError";
  }
}

export class LgreStaleBaseVersionError extends LgreError {
  constructor(message = "Consumer base version diverged from the delta base; full resync required.") {
    super("STALE_BASE_VERSION", message);
    this.name = "LgreStaleBaseVersionError";
  }
}

export class LgreDeltaLimitExceededError extends LgreError {
  constructor(message = "Delta exceeds the operation budget; a full resync must be issued instead.") {
    super("DELTA_LIMIT_EXCEEDED", message);
    this.name = "LgreDeltaLimitExceededError";
  }
}

export class LgreSubscriptionChannelFailureError extends LgreError {
  constructor(message = "Realtime subscription channel failed.") {
    super("SUBSCRIPTION_CHANNEL_FAILURE", message);
    this.name = "LgreSubscriptionChannelFailureError";
  }
}

export class LgreUnsupportedOperationError extends LgreError {
  constructor(operation: string) {
    super(
      "UNSUPPORTED_ENGINE_OPERATION",
      `Operation "${operation}" is not implemented in this foundation task. The engine never fabricates output.`,
    );
    this.name = "LgreUnsupportedOperationError";
  }
}

export function isLgreError(value: unknown): value is LgreError {
  return value instanceof LgreError;
}
