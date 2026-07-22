// ============================================================================
// ProjectOps360° — KPI Calculation Engine · bounded expression parser
// ============================================================================
// CAP-046 / PD-019 — Feature 3. Binding rule: NEVER `eval` / `new Function`.
// The grammar below accepts only numbers, allow-listed identifiers/functions,
// arithmetic, comparisons, logical operators and a numeric ternary. It has no
// strings, objects, arrays, member access, assignment or function definitions.
// ============================================================================

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

type KpiRuntimeValue = number | readonly number[];
type KpiFunction = (...args: KpiRuntimeValue[]) => number;

/** The complete KPI function allow-list (PD-019 §F3). */
export const KPI_FUNCTIONS: Record<string, KpiFunction> = {
  SUM: kpiSum as unknown as KpiFunction,
  AVG: kpiAvg as unknown as KpiFunction,
  COUNT: kpiCount as unknown as KpiFunction,
  MEDIAN: kpiMedian as unknown as KpiFunction,
  PERCENTILE: kpiPercentile as unknown as KpiFunction,
  CORRELATION: kpiCorrelation as unknown as KpiFunction,
  TREND: kpiTrend as unknown as KpiFunction,
  MOVING_AVERAGE: kpiMovingAverage as unknown as KpiFunction,
  FORECAST: kpiForecast as unknown as KpiFunction,
  ABS: Math.abs as unknown as KpiFunction,
  ROUND: Math.round as unknown as KpiFunction,
  MIN: Math.min as unknown as KpiFunction,
  MAX: Math.max as unknown as KpiFunction,
};

export type KpiExpressionValidation =
  | { valid: true; variables: string[] }
  | { valid: false; error: string };

type Token =
  | { kind: "number"; value: number }
  | { kind: "identifier"; value: string }
  | { kind: "operator"; value: string }
  | { kind: "lparen" | "rparen" | "comma" | "question" | "colon" | "eof" };

type ExpressionNode =
  | { kind: "number"; value: number }
  | { kind: "identifier"; name: string }
  | { kind: "call"; name: string; args: ExpressionNode[] }
  | { kind: "unary"; operator: string; operand: ExpressionNode }
  | { kind: "binary"; operator: string; left: ExpressionNode; right: ExpressionNode }
  | { kind: "conditional"; condition: ExpressionNode; whenTrue: ExpressionNode; whenFalse: ExpressionNode };

class KpiExpressionError extends Error {}

const MAX_EXPRESSION_LENGTH = 500;
const MAX_TOKENS = 256;
const MAX_AST_NODES = 256;
const MAX_NESTING = 32;
const MAX_FUNCTION_ARGUMENTS = 16;
const FORBIDDEN_IDENTIFIERS = new Set(["__proto__", "prototype", "constructor"]);

class Tokenizer {
  private index = 0;

  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (/\s/.test(character)) {
        this.index += 1;
        continue;
      }
      if (/\d/.test(character) || (character === "." && /\d/.test(this.source[this.index + 1] ?? ""))) {
        tokens.push({ kind: "number", value: this.readNumber() });
      } else if (/[A-Za-z_]/.test(character)) {
        tokens.push({ kind: "identifier", value: this.readIdentifier() });
      } else {
        const pair = this.source.slice(this.index, this.index + 2);
        if (["&&", "||", "<=", ">=", "==", "!="].includes(pair)) {
          tokens.push({ kind: "operator", value: pair });
          this.index += 2;
        } else if (["+", "-", "*", "/", "%", "^", "<", ">", "!"].includes(character)) {
          tokens.push({ kind: "operator", value: character });
          this.index += 1;
        } else {
          const punctuation: Record<string, Token["kind"]> = {
            "(": "lparen",
            ")": "rparen",
            ",": "comma",
            "?": "question",
            ":": "colon",
          };
          const kind = punctuation[character];
          if (!kind) throw new KpiExpressionError(`Unexpected character "${character}".`);
          tokens.push({ kind } as Token);
          this.index += 1;
        }
      }
      if (tokens.length > MAX_TOKENS) throw new KpiExpressionError("Expression is too complex.");
    }
    tokens.push({ kind: "eof" });
    return tokens;
  }

  private readNumber(): number {
    const rest = this.source.slice(this.index);
    const match = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) throw new KpiExpressionError("Invalid number.");
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) throw new KpiExpressionError(`Invalid number "${match[0]}".`);
    return value;
  }

  private readIdentifier(): string {
    const start = this.index;
    this.index += 1;
    while (/[A-Za-z0-9_]/.test(this.source[this.index] ?? "")) this.index += 1;
    return this.source.slice(start, this.index);
  }
}

class Parser {
  private position = 0;
  private nodeCount = 0;
  private nesting = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    const expression = this.conditional();
    if (this.peek().kind !== "eof") throw new KpiExpressionError("Unexpected trailing input.");
    return expression;
  }

  private peek(): Token {
    return this.tokens[this.position] ?? { kind: "eof" };
  }

  private take(): Token {
    const token = this.peek();
    this.position += 1;
    return token;
  }

  private node<T extends ExpressionNode>(node: T): T {
    this.nodeCount += 1;
    if (this.nodeCount > MAX_AST_NODES) throw new KpiExpressionError("Expression is too complex.");
    return node;
  }

  private nested<T>(parse: () => T): T {
    this.nesting += 1;
    if (this.nesting > MAX_NESTING) throw new KpiExpressionError("Expression nesting is too deep.");
    try {
      return parse();
    } finally {
      this.nesting -= 1;
    }
  }

  private conditional(): ExpressionNode {
    const condition = this.logicalOr();
    if (this.peek().kind !== "question") return condition;
    this.take();
    const whenTrue = this.nested(() => this.conditional());
    if (this.take().kind !== "colon") throw new KpiExpressionError("Expected ':' in conditional expression.");
    const whenFalse = this.nested(() => this.conditional());
    return this.node({ kind: "conditional", condition, whenTrue, whenFalse });
  }

  private logicalOr(): ExpressionNode {
    return this.leftAssociative(() => this.logicalAnd(), ["||"]);
  }

  private logicalAnd(): ExpressionNode {
    return this.leftAssociative(() => this.comparison(), ["&&"]);
  }

  private comparison(): ExpressionNode {
    return this.leftAssociative(() => this.additive(), ["<", "<=", ">", ">=", "==", "!="]);
  }

  private additive(): ExpressionNode {
    return this.leftAssociative(() => this.multiplicative(), ["+", "-"]);
  }

  private multiplicative(): ExpressionNode {
    return this.leftAssociative(() => this.exponent(), ["*", "/", "%"]);
  }

  private exponent(): ExpressionNode {
    const left = this.unary();
    if (!this.isOperator("^")) return left;
    this.take();
    return this.node({ kind: "binary", operator: "^", left, right: this.nested(() => this.exponent()) });
  }

  private unary(): ExpressionNode {
    const token = this.peek();
    if (token.kind === "operator" && ["+", "-", "!"].includes(token.value)) {
      this.take();
      return this.node({ kind: "unary", operator: token.value, operand: this.nested(() => this.unary()) });
    }
    return this.primary();
  }

  private primary(): ExpressionNode {
    const token = this.take();
    if (token.kind === "number") return this.node({ kind: "number", value: token.value });
    if (token.kind === "identifier") {
      if (FORBIDDEN_IDENTIFIERS.has(token.value.toLowerCase())) {
        throw new KpiExpressionError(`Forbidden identifier "${token.value}".`);
      }
      if (this.peek().kind !== "lparen") return this.node({ kind: "identifier", name: token.value });
      this.take();
      const args: ExpressionNode[] = [];
      if (this.peek().kind !== "rparen") {
        args.push(this.nested(() => this.conditional()));
        while (this.peek().kind === "comma") {
          this.take();
          if (args.length >= MAX_FUNCTION_ARGUMENTS) throw new KpiExpressionError("Too many function arguments.");
          args.push(this.nested(() => this.conditional()));
        }
      }
      if (this.take().kind !== "rparen") throw new KpiExpressionError("Expected ')'.");
      return this.node({ kind: "call", name: token.value, args });
    }
    if (token.kind === "lparen") {
      const expression = this.nested(() => this.conditional());
      if (this.take().kind !== "rparen") throw new KpiExpressionError("Expected ')'.");
      return expression;
    }
    throw new KpiExpressionError("Expected a number, variable, function or '('.");
  }

  private isOperator(operator: string): boolean {
    const token = this.peek();
    return token.kind === "operator" && token.value === operator;
  }

  private leftAssociative(parseOperand: () => ExpressionNode, operators: readonly string[]): ExpressionNode {
    let left = parseOperand();
    while (true) {
      const token = this.peek();
      if (token.kind !== "operator" || !operators.includes(token.value)) break;
      const operator = token.value;
      this.take();
      left = this.node({ kind: "binary", operator, left, right: parseOperand() });
    }
    return left;
  }
}

function parseExpression(expression: string): ExpressionNode {
  return new Parser(new Tokenizer(expression).tokenize()).parse();
}

function collectAndValidate(
  node: ExpressionNode,
  allowedVariables: ReadonlySet<string>,
  variables: string[],
  seen: Set<string>,
): void {
  if (node.kind === "identifier") {
    if (!allowedVariables.has(node.name)) throw new KpiExpressionError(`Unknown symbol "${node.name}" — not an allowed function or dataset variable.`);
    if (!seen.has(node.name)) {
      seen.add(node.name);
      variables.push(node.name);
    }
    return;
  }
  if (node.kind === "call") {
    if (!Object.prototype.hasOwnProperty.call(KPI_FUNCTIONS, node.name)) {
      throw new KpiExpressionError(`Unknown symbol "${node.name}" — not an allowed function or dataset variable.`);
    }
    node.args.forEach((argument) => collectAndValidate(argument, allowedVariables, variables, seen));
    return;
  }
  if (node.kind === "unary") collectAndValidate(node.operand, allowedVariables, variables, seen);
  if (node.kind === "binary") {
    collectAndValidate(node.left, allowedVariables, variables, seen);
    collectAndValidate(node.right, allowedVariables, variables, seen);
  }
  if (node.kind === "conditional") {
    collectAndValidate(node.condition, allowedVariables, variables, seen);
    collectAndValidate(node.whenTrue, allowedVariables, variables, seen);
    collectAndValidate(node.whenFalse, allowedVariables, variables, seen);
  }
}

/** Validate and collect the allow-listed dataset variables used by an expression. */
export function validateKpiExpression(
  expression: string,
  allowedVariables: readonly string[],
): KpiExpressionValidation {
  if (!expression || expression.length > MAX_EXPRESSION_LENGTH) {
    return { valid: false, error: "Expression is empty or too long (max 500 chars)." };
  }
  try {
    const ast = parseExpression(expression);
    const variables: string[] = [];
    collectAndValidate(ast, new Set(allowedVariables), variables, new Set());
    return { valid: true, variables };
  } catch (error) {
    return { valid: false, error: `Parse error: ${error instanceof Error ? error.message : "invalid expression"}` };
  }
}

function numeric(value: KpiRuntimeValue): number {
  if (typeof value !== "number") throw new KpiExpressionError("Array values require an aggregate function.");
  return value;
}

function truthy(value: KpiRuntimeValue): boolean {
  return numeric(value) !== 0;
}

function evaluateNode(
  node: ExpressionNode,
  scope: Record<string, number | readonly number[]>,
  budget: { remaining: number },
): KpiRuntimeValue {
  budget.remaining -= 1;
  if (budget.remaining < 0) throw new KpiExpressionError("Evaluation budget exceeded.");
  if (node.kind === "number") return node.value;
  if (node.kind === "identifier") {
    if (!Object.prototype.hasOwnProperty.call(scope, node.name)) throw new KpiExpressionError(`Missing variable "${node.name}".`);
    const value = scope[node.name];
    if (typeof value === "number") return value;
    if (Array.isArray(value) && value.every((item) => typeof item === "number")) return value;
    throw new KpiExpressionError(`Invalid value for "${node.name}".`);
  }
  if (node.kind === "call") {
    const fn = Object.prototype.hasOwnProperty.call(KPI_FUNCTIONS, node.name) ? KPI_FUNCTIONS[node.name] : null;
    if (!fn) throw new KpiExpressionError(`Unknown function "${node.name}".`);
    return fn(...node.args.map((argument) => evaluateNode(argument, scope, budget)));
  }
  if (node.kind === "unary") {
    const operand = numeric(evaluateNode(node.operand, scope, budget));
    if (node.operator === "+") return operand;
    if (node.operator === "-") return -operand;
    return operand === 0 ? 1 : 0;
  }
  if (node.kind === "conditional") {
    return truthy(evaluateNode(node.condition, scope, budget))
      ? evaluateNode(node.whenTrue, scope, budget)
      : evaluateNode(node.whenFalse, scope, budget);
  }
  if (node.operator === "&&") {
    return truthy(evaluateNode(node.left, scope, budget)) && truthy(evaluateNode(node.right, scope, budget)) ? 1 : 0;
  }
  if (node.operator === "||") {
    return truthy(evaluateNode(node.left, scope, budget)) || truthy(evaluateNode(node.right, scope, budget)) ? 1 : 0;
  }
  const left = numeric(evaluateNode(node.left, scope, budget));
  const right = numeric(evaluateNode(node.right, scope, budget));
  switch (node.operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return left / right;
    case "%": return left % right;
    case "^": return left ** right;
    case "<": return left < right ? 1 : 0;
    case "<=": return left <= right ? 1 : 0;
    case ">": return left > right ? 1 : 0;
    case ">=": return left >= right ? 1 : 0;
    case "==": return left === right ? 1 : 0;
    case "!=": return left !== right ? 1 : 0;
    default: throw new KpiExpressionError(`Unsupported operator "${node.operator}".`);
  }
}

/** Evaluate a previously validated expression against a numeric dataset scope. */
export function evaluateKpiExpression(
  expression: string,
  scope: Record<string, number | readonly number[]>,
): number {
  const result = evaluateNode(parseExpression(expression), scope, { remaining: MAX_AST_NODES });
  return typeof result === "number" ? result : NaN;
}
