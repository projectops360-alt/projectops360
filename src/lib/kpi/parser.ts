// ============================================================================
// ProjectOps360° — KPI Calculation Engine · sandboxed expression parser
// ============================================================================
// CAP-046 / PD-019 — Feature 3. Binding rule: NEVER `eval` / `new Function`.
// Expressions are parsed by expr-eval into an AST and validated symbol-by-
// symbol against an explicit allow-list (KPI functions + dataset variables)
// BEFORE evaluation. Defense in depth:
//   1. member access disabled (no prototype-chain escape),
//   2. assignment / custom function definition operators disabled,
//   3. parser built-ins replaced by our allow-listed function set only,
//   4. unknown symbols rejected pre-evaluation with a precise error.
// ============================================================================

import { Parser } from "expr-eval";
import {
  kpiAvg,
  kpiCorrelation,
  kpiCount,
  kpiForecast,
  kpiMedian,
  kpiMovingAverage,
  kpiPercentile,
  kpiSum,
  kpiTrend,
} from "./functions";

/** The complete KPI function allow-list (PD-019 §F3). */
export const KPI_FUNCTIONS: Record<string, (...args: never[]) => number> = {
  SUM: kpiSum,
  AVG: kpiAvg,
  COUNT: kpiCount,
  MEDIAN: kpiMedian,
  PERCENTILE: kpiPercentile as (...args: never[]) => number,
  CORRELATION: kpiCorrelation as (...args: never[]) => number,
  TREND: kpiTrend,
  MOVING_AVERAGE: kpiMovingAverage as (...args: never[]) => number,
  FORECAST: kpiForecast as (...args: never[]) => number,
  // Safe scalar helpers.
  ABS: Math.abs as (...args: never[]) => number,
  ROUND: Math.round as (...args: never[]) => number,
  MIN: Math.min as (...args: never[]) => number,
  MAX: Math.max as (...args: never[]) => number,
};

export type KpiExpressionValidation =
  | { valid: true; variables: string[] }
  | { valid: false; error: string };

function buildParser(): Parser {
  const parser = new Parser({
    // No member access (`a.b`), no assignment, no fn definition, no import-ish ops.
    allowMemberAccess: false,
    operators: {
      assignment: false,
      fndef: false,
      logical: true,
      comparison: true,
      concatenate: false,
      conditional: true,
      in: false,
      // No array literals/indexing: `x[...]` could reach properties by key.
      array: false,
    },
  } as ConstructorParameters<typeof Parser>[0]);
  // Replace built-in function table with the allow-list ONLY (drops random(), etc.).
  const functions = parser.functions as Record<string, unknown>;
  for (const key of Object.keys(functions)) delete functions[key];
  for (const [name, fn] of Object.entries(KPI_FUNCTIONS)) functions[name] = fn;
  // No ambient constants beyond numbers typed into the expression.
  const consts = parser.consts as Record<string, unknown>;
  for (const key of Object.keys(consts)) delete consts[key];
  return parser;
}

/**
 * Validate an expression against the allow-list: every referenced symbol must
 * be a KPI function or one of `allowedVariables`. Returns the dataset
 * variables the expression uses.
 */
export function validateKpiExpression(
  expression: string,
  allowedVariables: readonly string[],
): KpiExpressionValidation {
  if (!expression || expression.length > 500) {
    return { valid: false, error: "Expression is empty or too long (max 500 chars)." };
  }
  let symbols: string[];
  try {
    const parser = buildParser();
    const parsed = parser.parse(expression);
    symbols = parsed.variables({ withMembers: true });
  } catch (err) {
    return { valid: false, error: `Parse error: ${err instanceof Error ? err.message : "invalid expression"}` };
  }
  const allowed = new Set(allowedVariables);
  const variables: string[] = [];
  for (const symbol of symbols) {
    if (Object.prototype.hasOwnProperty.call(KPI_FUNCTIONS, symbol)) continue;
    if (!allowed.has(symbol)) {
      return { valid: false, error: `Unknown symbol "${symbol}" — not an allowed function or dataset variable.` };
    }
    variables.push(symbol);
  }
  return { valid: true, variables };
}

/**
 * Evaluate a VALIDATED expression against a dataset scope. Throws only on
 * runtime evaluation errors (caller converts to a safe result).
 */
export function evaluateKpiExpression(
  expression: string,
  scope: Record<string, number | readonly number[]>,
): number {
  const parser = buildParser();
  const parsed = parser.parse(expression);
  const result = parsed.evaluate(scope as never) as unknown;
  return typeof result === "number" ? result : NaN;
}
