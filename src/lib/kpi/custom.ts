// ============================================================================
// ProjectOps360° — KPI Engine · custom KPI definitions (pure core, CAP-046 F3.2)
// ============================================================================
// Validation and shaping of user-defined KPI definitions BEFORE they touch the
// database. Human-approved NL-to-KPI flow: Isabella (or the user) proposes an
// expression → this validator re-checks it against the sandbox allow-list →
// the user saves it explicitly. The DB stores text; the sandbox decides.
// ============================================================================

import { KPI_DATASET_VARIABLES } from "./catalog";
import { validateKpiExpression } from "./parser";

export type KpiTargetDirection = "at_or_above" | "at_or_below";

/** A persisted custom KPI definition (kpi_definitions row, camelCase). */
export interface CustomKpiDefinition {
  id: string;
  slug: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string | null;
  descriptionEs: string | null;
  expression: string;
  unit: string | null;
  precision: number;
  target: number | null;
  targetDirection: KpiTargetDirection | null;
  nlSource: string | null;
  version: number;
  projectId: string | null;
}

export interface CustomKpiInput {
  slug?: string;
  nameEn: string;
  nameEs: string;
  descriptionEn?: string;
  descriptionEs?: string;
  expression: string;
  unit?: string;
  precision?: number;
  target?: number | null;
  targetDirection?: KpiTargetDirection | null;
  nlSource?: string;
}

export type CustomKpiValidation =
  | { valid: true; normalized: Required<Omit<CustomKpiInput, "target" | "targetDirection">> & {
      target: number | null;
      targetDirection: KpiTargetDirection | null;
    } }
  | { valid: false; error: string };

const SLUG_RE = /^[a-z][a-z0-9_]{1,63}$/;

/** Derive a slug from a display name (lowercase, underscores, ascii-safe). */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "k$1")
    .slice(0, 64);
}

/** Validate + normalize a custom KPI before persisting (never trusts input). */
export function validateCustomKpiInput(input: CustomKpiInput): CustomKpiValidation {
  const nameEn = input.nameEn?.trim() ?? "";
  const nameEs = input.nameEs?.trim() ?? "";
  if (nameEn.length < 3 || nameEn.length > 120) {
    return { valid: false, error: "English name must be 3–120 characters." };
  }
  if (nameEs.length < 3 || nameEs.length > 120) {
    return { valid: false, error: "Spanish name must be 3–120 characters." };
  }

  const slug = (input.slug?.trim() || slugFromName(nameEn)).toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { valid: false, error: `Invalid slug "${slug}" (a-z, 0-9, _; 2–64 chars, letter first).` };
  }

  const expressionCheck = validateKpiExpression(input.expression ?? "", KPI_DATASET_VARIABLES);
  if (!expressionCheck.valid) {
    return { valid: false, error: expressionCheck.error };
  }

  const precision = input.precision ?? 1;
  if (!Number.isInteger(precision) || precision < 0 || precision > 4) {
    return { valid: false, error: "Precision must be an integer between 0 and 4." };
  }

  const target = input.target ?? null;
  if (target !== null && !Number.isFinite(target)) {
    return { valid: false, error: "Target must be a finite number." };
  }
  const targetDirection = input.targetDirection ?? null;
  if (targetDirection !== null && targetDirection !== "at_or_above" && targetDirection !== "at_or_below") {
    return { valid: false, error: "Target direction must be at_or_above or at_or_below." };
  }
  if (target !== null && targetDirection === null) {
    return { valid: false, error: "A target requires a target direction." };
  }

  const unit = input.unit?.trim() ?? "";
  if (unit.length > 20) return { valid: false, error: "Unit must be at most 20 characters." };

  return {
    valid: true,
    normalized: {
      slug,
      nameEn,
      nameEs,
      descriptionEn: input.descriptionEn?.trim() ?? "",
      descriptionEs: input.descriptionEs?.trim() ?? "",
      expression: input.expression.trim(),
      unit,
      precision,
      target,
      targetDirection,
      nlSource: input.nlSource?.trim() ?? "",
    },
  };
}

/** Whether a computed value meets the definition's target (null = no verdict). */
export function isOnTarget(
  value: number,
  target: number | null,
  direction: KpiTargetDirection | null,
): boolean | null {
  if (target === null || direction === null || !Number.isFinite(value)) return null;
  return direction === "at_or_above" ? value >= target : value <= target;
}
