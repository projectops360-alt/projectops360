import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  join(process.cwd(), "supabase/migrations/20260858000000_financial_domain_foundation.sql"),
  "utf8",
);
const controls = readFileSync(
  join(process.cwd(), "supabase/migrations/20260858010000_financial_security_atomicity_projections.sql"),
  "utf8",
);

describe("financial migration contract", () => {
  it("stays additive and does not introduce another event ledger", () => {
    expect(foundation).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.financial_event/i);
    expect(`${foundation}\n${controls}`).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from/i);
    expect(foundation).toContain("references public.project_event_log(event_id)");
  });

  it("protects movement facts as append-only and project-scoped", () => {
    for (const table of [
      "funding_movements",
      "commitment_movements",
      "accrual_movements",
      "payment_movements",
      "reserve_movements",
    ]) {
      expect(controls).toContain(`'${table}'`);
    }
    expect(controls).toContain("before update or delete");
    expect(controls).toContain("public.is_org_member(organization_id)");
    expect(controls).toContain("public.can_access_project(project_id)");
    expect(controls).toContain("revoke insert, update, delete");
  });

  it("keeps event append and movement insert in one service-only transaction", () => {
    expect(controls).toContain("capture_financial_movement_atomic");
    expect(controls).toContain("public._append_event_atomic");
    expect(controls).toContain("financial_service_role_required");
    expect(controls).toContain("idempotency_payload_conflict");
    expect(controls).toContain("financial_project_scope_conflict");
    expect(controls).toContain("to service_role");
  });
});
