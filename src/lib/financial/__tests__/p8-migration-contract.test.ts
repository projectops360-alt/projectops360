import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260859000000_financial_workflows_cockpit.sql"),
  "utf8",
);

describe("P8 workflow migration contract", () => {
  it("keeps the cockpit a security-invoker projection", () => {
    expect(sql).toContain("view public.financial_project_cockpit");
    expect(sql).toContain("security_invoker = true");
    expect(sql).toContain("financial_funding_positions");
    expect(sql).toContain("financial_commitment_positions");
    expect(sql).toContain("financial_measurement_snapshots");
  });

  it("posts approved changes through a new immutable baseline version", () => {
    expect(sql).toContain("v_new_baseline_id := gen_random_uuid()");
    expect(sql).toContain("source_change_id");
    expect(sql).toContain("set status = 'superseded'");
    expect(sql).toContain("set treatment = 'posted'");
  });

  it("keeps transitions and controlled actuals atomic with the canonical event log", () => {
    expect(sql).toContain("transition_financial_record_atomic");
    expect(sql).toContain("capture_financial_actual_atomic");
    expect(sql.match(/public\._append_event_atomic/g)?.length).toBe(2);
    expect(sql).toContain("financial_actual_is_append_only");
    expect(sql).not.toMatch(/create\s+table\s+.*event/i);
  });
});
