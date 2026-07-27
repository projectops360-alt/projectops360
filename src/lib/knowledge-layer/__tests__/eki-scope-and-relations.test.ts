// ============================================================================
// EKI Macrophase 1 — knowledge scope and canonical relations
// Guards: EKI-SCOPE-EXPLICIT, EKI-RELATION-VOCABULARY, EKI-NO-PARALLEL-MODEL
// ============================================================================
// ADR-013 rejected a nullable `project_id` because NULL is the absence of a
// value, not the presence of a scope. The accepted model states the scope and
// lets a constraint govern the project. These tests pin that distinction on
// both sides — the validation layer and the migration — because the whole point
// of the decision is that an incoherent pair is REJECTED rather than
// interpreted.
//
// The relation specs are duplicated by necessity: TypeScript validates early so
// a caller gets a usable error, the database enforces so nothing can bypass it.
// Duplication that nobody checks is drift, so the migration is parsed and
// compared against the TypeScript table.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createKnowledgeObjectSchema,
  createKnowledgeRelationSchema,
  resolveKnowledgeRelationSchema,
  relationIsVersionSensitive,
  relationRequiresApproval,
  KNOWLEDGE_RELATION_SPECS,
} from "../contracts";
import {
  DELIVERY_KNOWLEDGE_TYPES,
  GOVERNANCE_KNOWLEDGE_TYPES,
  KNOWLEDGE_OBJECT_TYPES,
  KNOWLEDGE_RELATION_TYPES,
  KNOWLEDGE_SCOPES,
  isGovernanceKnowledgeType,
} from "../types";

// Line endings are normalised on read. The migration is checked out with CRLF on
// Windows and LF on CI, so a pattern containing "\n" silently matches nothing on
// one of the two — `indexOf` returns -1, `slice(-1)` yields a single character,
// and the assertion fails for a reason that has nothing to do with the migration.
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260863000000_eki_knowledge_scope_and_relations.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const uuid = (n: string) => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const OBJECT_A = uuid("1");
const OBJECT_B = uuid("2");
const PACKAGE_A = uuid("3");
const PROJECT = uuid("4");

const baseVersion = {
  title: "Privileged access requires MFA",
  summary: "Every privileged role authenticates with a second factor.",
  body: "The assertion, its scope and how it is verified.",
  confidence: "high" as const,
  confidenceReason: "Verified against the identity provider configuration.",
  provenance: { captureMethod: "direct" as const, sourceKind: "review", sourceRef: "access-review-1" },
  evidence: [{ type: "document" as const, ref: "policy-1", role: "supports" as const, confidence: "high" as const }],
  proposalRationale: "Proposed after the access review.",
};

describe("knowledge scope (EKI-SCOPE-EXPLICIT)", () => {
  it("offers exactly two scopes at v1", () => {
    // portfolio and platform are deferred with reasons recorded in ADR-013.
    // A vocabulary with speculative values invites speculative code.
    expect([...KNOWLEDGE_SCOPES]).toEqual(["organization", "project"]);
  });

  it("rejects project scope without a project", () => {
    const result = createKnowledgeObjectSchema.safeParse({
      ...baseVersion, scope: "project", projectId: null,
      knowledgeType: "control", idempotencyKey: "control-mfa-privileged",
    });
    expect(result.success).toBe(false);
  });

  it("rejects organization scope carrying a project", () => {
    // The pair that Option B could not distinguish from a defective write.
    const result = createKnowledgeObjectSchema.safeParse({
      ...baseVersion, scope: "organization", projectId: PROJECT,
      knowledgeType: "control", idempotencyKey: "control-mfa-privileged",
    });
    expect(result.success).toBe(false);
  });

  it("accepts each coherent pair", () => {
    expect(createKnowledgeObjectSchema.safeParse({
      ...baseVersion, scope: "organization", projectId: null,
      knowledgeType: "control", idempotencyKey: "control-mfa-privileged",
    }).success).toBe(true);

    expect(createKnowledgeObjectSchema.safeParse({
      ...baseVersion, scope: "project", projectId: PROJECT,
      knowledgeType: "finding", idempotencyKey: "finding-approval-delay",
    }).success).toBe(true);
  });

  it("the database governs project nullability by scope, not by convention", () => {
    // The constraint is what separates the accepted decision from the rejected
    // one. Without it the column is merely nullable.
    expect(migration).toContain("scope_type = 'project' and project_id is not null");
    expect(migration).toContain("scope_type = 'organization' and project_id is null");
  });

  it("adds the constraint before relaxing the column", () => {
    // Reversing the order opens a window in which the rejected semantics are
    // representable, and rows written in it would later need interpretation.
    const constraintAt = migration.indexOf("project_knowledge_objects_scope_coherent");
    const relaxAt = migration.indexOf("alter column project_id drop not null");
    expect(constraintAt).toBeGreaterThan(-1);
    expect(relaxAt).toBeGreaterThan(constraintAt);
  });

  it("keeps organization_id NOT NULL at every scope", () => {
    // The property that leaves tenant isolation untouched. No RLS policy may
    // acquire a null test on project_id.
    expect(migration).not.toMatch(/alter\s+column\s+organization_id\s+drop\s+not\s+null/i);
    const policySection = migration.slice(migration.indexOf("enable row level security"));
    expect(policySection).toContain("public.is_org_member(organization_id)");
    expect(policySection).not.toMatch(/project_id\s+is\s+null/i);
  });

  it("restores parent linkage that a nullable project would have silently removed", () => {
    // A composite FK is skipped entirely when any column is NULL (MATCH SIMPLE),
    // so relaxing project_id without acting would leave organization-scoped
    // children with no referential integrity at all.
    for (const child of ["versions", "evidence", "transitions"]) {
      expect(migration).toContain(`project_knowledge_${child}_parent_scope_fk`);
    }
    expect(migration).toContain("references public.project_knowledge_objects(id, organization_id, scope_type)");
  });

  it("preserves idempotency at organization scope", () => {
    // `unique (project_id, idempotency_key)` stops enforcing anything once the
    // project is NULL, because NULLs are distinct.
    expect(migration).toContain("project_knowledge_objects_org_idempotency_idx");
    expect(migration).toContain("where scope_type = 'organization'");
  });
});

describe("governance vocabulary (EKI-NO-PARALLEL-MODEL)", () => {
  it("extends the existing vocabulary rather than replacing it", () => {
    for (const type of DELIVERY_KNOWLEDGE_TYPES) {
      expect(KNOWLEDGE_OBJECT_TYPES).toContain(type);
    }
  });

  it("does not duplicate finding as a governance type", () => {
    // A finding is a finding. Scope and relationships distinguish governance
    // from delivery; a second type would begin the divergence ADR-014 prevents.
    expect(GOVERNANCE_KNOWLEDGE_TYPES).not.toContain("finding" as never);
    expect(DELIVERY_KNOWLEDGE_TYPES).toContain("finding");
  });

  it("excludes the normative kinds, which live in knowledge packages", () => {
    // ADR-015. They have no lifecycle, no evidence and no owner.
    for (const normative of ["principle", "policy", "standard", "obligation"]) {
      expect(KNOWLEDGE_OBJECT_TYPES).not.toContain(normative as never);
      expect(migration).not.toContain(`'${normative}'`);
    }
  });

  it("excludes evidence_record, which is a projection and not a store", () => {
    // Charter P5: a copy is not tamper-evident because its original was.
    expect(KNOWLEDGE_OBJECT_TYPES).not.toContain("evidence_record" as never);
    expect(migration).not.toContain("'evidence_record'");
  });

  it("classifies each kind exactly once", () => {
    for (const type of KNOWLEDGE_OBJECT_TYPES) {
      const governance = isGovernanceKnowledgeType(type);
      expect(governance).toBe((GOVERNANCE_KNOWLEDGE_TYPES as readonly string[]).includes(type));
    }
  });

  it("the migration accepts every vocabulary member and nothing else", () => {
    const check = migration.slice(migration.indexOf("project_knowledge_objects_knowledge_type_check\n  check"));
    for (const type of KNOWLEDGE_OBJECT_TYPES) {
      expect(check).toContain(`'${type}'`);
    }
  });

  it("creates no parallel knowledge table", () => {
    // Charter P12. The only new table is the relation graph.
    const created = [...migration.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
    expect(created).toEqual(["project_knowledge_relations"]);
  });
});

describe("canonical relations (EKI-RELATION-VOCABULARY)", () => {
  it("the TypeScript and SQL vocabularies agree", () => {
    // Duplication nobody checks is drift.
    for (const relation of KNOWLEDGE_RELATION_TYPES) {
      expect(migration).toContain(`'${relation}'`);
    }
    // The SQL aligns its CASE arms, so the whitespace between the literal and
    // `then` varies. Matching it loosely keeps the guard about vocabulary drift
    // rather than about formatting.
    const declared = new Set(
      [...migration.matchAll(/when '(\w+)'\s+then expected_source/g)].map((match) => match[1]),
    );
    expect([...declared].sort()).toEqual([...KNOWLEDGE_RELATION_TYPES].sort());
  });

  it("has no relation to a person", () => {
    // owned_by is an attribute, approved_by is the actor on a transition,
    // generated_by is provenance. An edge would add a join to every ownership
    // question and a lifecycle to a fact.
    for (const forbidden of ["owned_by", "approved_by", "generated_by", "observed_by"]) {
      expect(KNOWLEDGE_RELATION_TYPES).not.toContain(forbidden as never);
    }
  });

  it("requires a version on a version-sensitive relation", () => {
    // A control's new assertion does not inherit the old assertion's evidence.
    expect(relationIsVersionSensitive("satisfies")).toBe(true);
    const result = createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "satisfies",
      source: { kind: "knowledge_object", id: OBJECT_A },
      target: { kind: "knowledge_package", id: PACKAGE_A },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a version-sensitive relation when the version is stated", () => {
    expect(createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "satisfies",
      source: { kind: "knowledge_object", id: OBJECT_A, versionNo: 3 },
      target: { kind: "knowledge_package", id: PACKAGE_A },
    }).success).toBe(true);
  });

  it("rejects an endpoint kind the relation does not accept", () => {
    // `satisfies` binds a control to an obligation. An obligation is a package.
    expect(createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "satisfies",
      source: { kind: "knowledge_object", id: OBJECT_A, versionNo: 1 },
      target: { kind: "knowledge_object", id: OBJECT_B, versionNo: 1 },
    }).success).toBe(false);
  });

  it("rejects a self-relation", () => {
    expect(createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "contradicts",
      source: { kind: "knowledge_object", id: OBJECT_A, versionNo: 1 },
      target: { kind: "knowledge_object", id: OBJECT_A, versionNo: 1 },
    }).success).toBe(false);
    expect(migration).toContain("project_knowledge_relations_no_self");
  });

  it("supersedes joins two endpoints of the same kind", () => {
    expect(createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "supersedes",
      source: { kind: "knowledge_object", id: OBJECT_A, versionNo: 2 },
      target: { kind: "knowledge_package", id: PACKAGE_A },
    }).success).toBe(false);
  });

  it("records the basis, so an inferred relation is distinguishable", () => {
    // An inferred relation may never change a compliance status. Recording the
    // basis is what lets a consumer enforce that.
    const parsed = createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "mitigates",
      source: { kind: "knowledge_object", id: OBJECT_A },
      target: { kind: "knowledge_object", id: OBJECT_B },
      basis: "inferred",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.basis).toBe("inferred");
    expect(migration).toContain("'declared', 'derived', 'observed', 'inferred'");
  });

  it("defaults the basis to declared rather than leaving it unknown", () => {
    const parsed = createKnowledgeRelationSchema.safeParse({
      scope: "organization", projectId: null, relationType: "mitigates",
      source: { kind: "knowledge_object", id: OBJECT_A },
      target: { kind: "knowledge_object", id: OBJECT_B },
    });
    expect(parsed.success && parsed.data.basis).toBe("declared");
  });

  it("a contradiction cannot be resolved without a rationale", () => {
    expect(resolveKnowledgeRelationSchema.safeParse({
      relationId: OBJECT_A, resolution: "accepted", rationale: "  ",
    }).success).toBe(false);
    expect(migration).toContain("project_knowledge_relations_resolution_rationale");
  });

  it("a contradiction cannot return to unresolved", () => {
    // It is resolved or accepted, never un-noticed. Reopening is a new relation.
    expect(resolveKnowledgeRelationSchema.safeParse({
      relationId: OBJECT_A, resolution: "unresolved", rationale: "Changed my mind",
    }).success).toBe(false);
  });

  it("every relation type declares whether it needs a human approver", () => {
    for (const relation of KNOWLEDGE_RELATION_TYPES) {
      expect(typeof KNOWLEDGE_RELATION_SPECS[relation].humanApproval).toBe("boolean");
    }
    // The compliance-bearing claims do.
    expect(relationRequiresApproval("satisfies")).toBe(true);
    expect(relationRequiresApproval("maps_to")).toBe(true);
    // Observation does not.
    expect(relationRequiresApproval("supports")).toBe(false);
  });

  it("enforces relation semantics in the database, not only in TypeScript", () => {
    expect(migration).toContain("project_knowledge_assert_relation");
    expect(migration).toContain("knowledge_relation_invalid_source_kind");
    expect(migration).toContain("knowledge_relation_source_version_required");
    expect(migration).toContain("project_knowledge_relations_guard_trigger");
  });

  it("refuses a package endpoint from another tenant", () => {
    // Global packages (organization_id null) and the organization's own are
    // readable; anything else is a cross-tenant reference.
    expect(migration).toContain("knowledge_relation_source_package_out_of_scope");
    expect(migration).toContain("knowledge_relation_target_package_out_of_scope");
    expect(migration).toContain("p.organization_id is null or p.organization_id = new.organization_id");
  });
});

describe("relation persistence security", () => {
  it("relations are readable by members and writable only by the service role", () => {
    expect(migration).toContain('create policy "Members read project_knowledge_relations"');
    expect(migration).toContain("using (public.is_org_member(organization_id))");
    expect(migration).toContain("revoke insert, update, delete on public.project_knowledge_relations from anon, authenticated");
  });

  it("enables row level security on the new table", () => {
    expect(migration).toContain("alter table public.project_knowledge_relations enable row level security");
  });
});
