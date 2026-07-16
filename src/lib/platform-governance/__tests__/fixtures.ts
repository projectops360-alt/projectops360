import type { PlatformResourceScope, TrustedPlatformSession } from "../types";

export const denverDataCenter = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Denver Data Center Expansion",
};

export const phoenixHospital = {
  organizationId: "22222222-2222-4222-8222-222222222222",
  projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Phoenix Hospital Modernization",
};

export const projectManagerSession: TrustedPlatformSession = {
  actorId: "33333333-3333-4333-8333-333333333333",
  actorType: "human",
  actorRole: "admin",
  organizationId: denverDataCenter.organizationId,
  projectIds: [denverDataCenter.projectId],
  active: true,
  capabilities: ["communications:read", "memory:read", "knowledge:propose"],
};

export const isabellaSession: TrustedPlatformSession = {
  actorId: "isabella",
  actorType: "ai",
  actorRole: "service",
  organizationId: denverDataCenter.organizationId,
  projectIds: [denverDataCenter.projectId],
  active: true,
  capabilities: ["communications:analyze", "memory:analyze", "knowledge:propose"],
};

export const ownerEmailThread: PlatformResourceScope = {
  organizationId: denverDataCenter.organizationId,
  projectId: denverDataCenter.projectId,
  resourceKind: "communication",
  sensitivity: "confidential",
  containsRawPayload: true,
};
