// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT — sources / RBAC / response
// ============================================================================
// Approved vs forbidden sources, the deny-by-default access resolver, the
// response policy validator, and the guarantee that an evidence packet needs no
// raw payload. Plus a source-level boundary: the contract is read-only (no DB
// client, no event-log/process-graph writes).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  APPROVED_DATA_SOURCES,
  FORBIDDEN_DATA_SOURCES,
  isApprovedSource,
  isAvailableSource,
  isForbiddenSource,
} from "@/lib/isabella/process-intelligence/data-sources";
import { resolveIsabellaAccess } from "@/lib/isabella/process-intelligence/security-contract";
import { validateIsabellaResponse } from "@/lib/isabella/process-intelligence/response-policy";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";

describe("approved / forbidden data sources", () => {
  it("marks deterministic project data + living graph as available now", () => {
    expect(isApprovedSource("deterministic_project_data")).toBe(true);
    expect(isAvailableSource("deterministic_project_data")).toBe(true);
    expect(isAvailableSource("living_graph")).toBe(true);
  });

  it("enables governed event, Product Brain, and screen/program sources", () => {
    expect(isApprovedSource("project_event_graph")).toBe(true);
    expect(isAvailableSource("project_event_graph")).toBe(true);
    expect(isAvailableSource("product_brain_knowledge")).toBe(true);
    expect(isAvailableSource("screen_program_context")).toBe(true);
    expect(isAvailableSource("observability_realtime_state")).toBe(false);
  });

  it("forbids raw project_event_log and raw Supabase payloads as sources", () => {
    expect(isForbiddenSource("raw_project_event_log_rows")).toBe(true);
    expect(isForbiddenSource("raw_supabase_realtime_payload")).toBe(true);
    expect(isForbiddenSource("synthetic_milestone_chain_as_dependency")).toBe(true);
    expect(FORBIDDEN_DATA_SOURCES.length).toBeGreaterThan(0);
    expect(APPROVED_DATA_SOURCES.length).toBeGreaterThan(0);
  });
});

describe("RBAC access resolver (deny-by-default)", () => {
  const base = {
    sessionOrganizationId: "org1",
    authorizedProjectId: "p1",
    requestedProjectId: "p1",
    requestedProjectOrganizationId: "org1",
  };

  it("authorizes only same-org, same-project requests", () => {
    expect(resolveIsabellaAccess(base)).toBe("authorized");
  });

  it("needs context when no project is selected", () => {
    expect(resolveIsabellaAccess({ ...base, authorizedProjectId: null, requestedProjectId: null })).toBe("needs_context");
  });

  it("denies cross-org requests without disclosing existence", () => {
    expect(resolveIsabellaAccess({ ...base, requestedProjectOrganizationId: "orgX" })).toBe("denied");
  });

  it("denies a project outside the caller's authorized scope", () => {
    expect(resolveIsabellaAccess({ ...base, requestedProjectId: "p2", requestedProjectOrganizationId: "org1" })).toBe("denied");
  });

  it("denies when the session has no org", () => {
    expect(resolveIsabellaAccess({ ...base, sessionOrganizationId: null })).toBe("denied");
  });
});

describe("response policy validator", () => {
  const okReport = {
    intent: "deterministic_project_report" as const,
    retrievalSucceeded: true,
    dataExists: true,
    confidence: "verified" as const,
    statesScope: true,
    statesSortOrFilter: true,
    includesCount: true,
    usedGenericRefusal: false,
    claimsCited: true,
  };

  it("passes a verified, scoped, counted, cited deterministic report", () => {
    expect(validateIsabellaResponse(okReport)).toEqual([]);
  });

  it("flags a generic refusal / low-confidence label on a successful report", () => {
    const bad = validateIsabellaResponse({ ...okReport, usedGenericRefusal: true, confidence: "low" });
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.join(" ")).toMatch(/generic|low-confidence/i);
  });

  it("flags missing scope/count on a report that has data", () => {
    const bad = validateIsabellaResponse({ ...okReport, statesScope: false, includesCount: false });
    expect(bad.join(" ")).toMatch(/scope/i);
    expect(bad.join(" ")).toMatch(/count/i);
  });
});

describe("evidence packet needs no raw payload + contract is read-only", () => {
  it("an evidence packet is a sanitized projection (no payload field required)", () => {
    const packet: IsabellaEvidencePacket = {
      evidenceId: "e1",
      evidenceType: "task",
      sourceKind: "deterministic_project_data",
      sourceId: "task:abc",
      projectId: "p1",
      organizationId: "org1",
      title: "Zoning review",
      summary: "Task status: in_progress",
      citationLabel: "Workboard task status",
      confidence: "verified",
      visibility: "project",
    };
    expect(packet.title).toBe("Zoning review");
    expect("payload" in packet).toBe(false);
  });

  it("no contract file imports a DB client or writes the event log / process graph", () => {
    const dir = fileURLToPath(new URL("../", import.meta.url));
    for (const f of [
      "types.ts",
      "data-sources.ts",
      "intent-contract.ts",
      "confidence.ts",
      "claim-policy.ts",
      "security-contract.ts",
      "response-policy.ts",
      "index.ts",
    ]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/supabase/);
      expect(src, f).not.toMatch(/createAdminClient\s*\(|createClient\s*\(/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
      expect(src, f).not.toMatch(/\.from\(["'](?:project_event_log|process_nodes|process_edges)["']\)/);
    }
  });
});
