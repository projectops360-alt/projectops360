// ============================================================================
// ProjectOps360° — Calculated field formula engine (pure, safe)
// ============================================================================
// A tiny arithmetic expression evaluator for report "calculated fields".
// No eval(): a hand-written tokenizer + recursive-descent parser over a fixed
// grammar. Identifiers resolve to numeric column values per row. Used for both
// user-written formulas and AI-suggested formulas (the AI only produces the
// expression text — evaluation is always this deterministic engine).
//
// Grammar:
//   expr        := comparison
//   comparison  := additive ( (>|<|>=|<=|==|!=) additive )?
//   additive    := multiplicative ( (+|-) multiplicative )*
//   multiplicative := unary ( (*|/|%) unary )*
//   unary       := '-' unary | primary
//   primary     := number | identifier | call | '(' expr ')'
//   call        := name '(' [expr (',' expr)*] ')'
// Functions: round(x[,n]), abs(x), min(...), max(...), coalesce(...), if(c,a,b)
// ============================================================================

export type FormulaValue = number | null;

interface Token { type: "num" | "id" | "op" | "lparen" | "rparen" | "comma"; value: string }

const FUNCTIONS = new Set(["round", "abs", "min", "max", "coalesce", "if"]);

class Tokenizer {
  private i = 0;
  constructor(private src: string) {}
  tokens(): Token[] {
    const out: Token[] = [];
    const s = this.src;
    while (this.i < s.length) {
      const c = s[this.i];
      if (c === " " || c === "\t" || c === "\n") { this.i++; continue; }
      if (c >= "0" && c <= "9") { out.push({ type: "num", value: this.number() }); continue; }
      if (/[a-zA-Z_]/.test(c)) { out.push({ type: "id", value: this.ident() }); continue; }
      if (c === "(") { out.push({ type: "lparen", value: c }); this.i++; continue; }
      if (c === ")") { out.push({ type: "rparen", value: c }); this.i++; continue; }
      if (c === ",") { out.push({ type: "comma", value: c }); this.i++; continue; }
      // multi-char operators
      const two = s.slice(this.i, this.i + 2);
      if ([">=", "<=", "==", "!="].includes(two)) { out.push({ type: "op", value: two }); this.i += 2; continue; }
      if ("+-*/%<>".includes(c)) { out.push({ type: "op", value: c }); this.i++; continue; }
      throw new FormulaError(`Unexpected character "${c}"`);
    }
    return out;
  }
  private number(): string {
    const start = this.i;
    while (this.i < this.src.length && /[0-9.]/.test(this.src[this.i])) this.i++;
    return this.src.slice(start, this.i);
  }
  private ident(): string {
    const start = this.i;
    while (this.i < this.src.length && /[a-zA-Z0-9_]/.test(this.src[this.i])) this.i++;
    return this.src.slice(start, this.i);
  }
}

export class FormulaError extends Error {}

// ── AST ───────────────────────────────────────────────────────────────────────

type Node =
  | { k: "num"; v: number }
  | { k: "id"; name: string }
  | { k: "unary"; op: string; x: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; name: string; args: Node[] };

class Parser {
  private p = 0;
  constructor(private toks: Token[]) {}
  parse(): Node {
    const node = this.comparison();
    if (this.p < this.toks.length) throw new FormulaError("Unexpected trailing input");
    return node;
  }
  private peek(): Token | undefined { return this.toks[this.p]; }
  private eat(): Token { const t = this.toks[this.p++]; if (!t) throw new FormulaError("Unexpected end of formula"); return t; }
  private comparison(): Node {
    let a = this.additive();
    const t = this.peek();
    if (t && t.type === "op" && [">", "<", ">=", "<=", "==", "!="].includes(t.value)) {
      this.eat();
      a = { k: "bin", op: t.value, a, b: this.additive() };
    }
    return a;
  }
  private additive(): Node {
    let a = this.multiplicative();
    while (this.peek()?.type === "op" && ["+", "-"].includes(this.peek()!.value)) {
      const op = this.eat().value;
      a = { k: "bin", op, a, b: this.multiplicative() };
    }
    return a;
  }
  private multiplicative(): Node {
    let a = this.unary();
    while (this.peek()?.type === "op" && ["*", "/", "%"].includes(this.peek()!.value)) {
      const op = this.eat().value;
      a = { k: "bin", op, a, b: this.unary() };
    }
    return a;
  }
  private unary(): Node {
    if (this.peek()?.type === "op" && this.peek()!.value === "-") { this.eat(); return { k: "unary", op: "-", x: this.unary() }; }
    return this.primary();
  }
  private primary(): Node {
    const t = this.eat();
    if (t.type === "num") { const v = parseFloat(t.value); if (!Number.isFinite(v)) throw new FormulaError(`Invalid number "${t.value}"`); return { k: "num", v }; }
    if (t.type === "lparen") { const e = this.comparison(); const close = this.eat(); if (close.type !== "rparen") throw new FormulaError("Expected ')'"); return e; }
    if (t.type === "id") {
      if (this.peek()?.type === "lparen") {
        const fn = t.value.toLowerCase();
        if (!FUNCTIONS.has(fn)) throw new FormulaError(`Unknown function "${t.value}"`);
        this.eat(); // (
        const args: Node[] = [];
        if (this.peek()?.type !== "rparen") {
          args.push(this.comparison());
          while (this.peek()?.type === "comma") { this.eat(); args.push(this.comparison()); }
        }
        const close = this.eat(); if (close.type !== "rparen") throw new FormulaError("Expected ')'");
        return { k: "call", name: fn, args };
      }
      return { k: "id", name: t.value };
    }
    throw new FormulaError(`Unexpected token "${t.value}"`);
  }
}

export function parseFormula(expr: string): Node {
  if (!expr.trim()) throw new FormulaError("Empty formula");
  return new Parser(new Tokenizer(expr).tokens()).parse();
}

// ── Evaluation ──────────────────────────────────────────────────────────────

function num(v: unknown): FormulaValue {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function evalNode(node: Node, row: Record<string, unknown>): FormulaValue {
  switch (node.k) {
    case "num": return node.v;
    case "id": return num(row[node.name]);
    case "unary": { const x = evalNode(node.x, row); return x === null ? null : -x; }
    case "bin": {
      const a = evalNode(node.a, row), b = evalNode(node.b, row);
      switch (node.op) {
        case "+": return a === null || b === null ? null : a + b;
        case "-": return a === null || b === null ? null : a - b;
        case "*": return a === null || b === null ? null : a * b;
        case "/": return a === null || b === null || b === 0 ? null : a / b;
        case "%": return a === null || b === null || b === 0 ? null : a % b;
        case ">": return a === null || b === null ? null : a > b ? 1 : 0;
        case "<": return a === null || b === null ? null : a < b ? 1 : 0;
        case ">=": return a === null || b === null ? null : a >= b ? 1 : 0;
        case "<=": return a === null || b === null ? null : a <= b ? 1 : 0;
        case "==": return a === b ? 1 : 0;
        case "!=": return a !== b ? 1 : 0;
        default: return null;
      }
    }
    case "call": {
      const args = node.args.map((a) => evalNode(a, row));
      switch (node.name) {
        case "abs": return args[0] === null ? null : Math.abs(args[0]!);
        case "round": { const x = args[0]; if (x === null) return null; const d = args[1] ?? 0; const f = 10 ** (d ?? 0); return Math.round(x * f) / f; }
        case "min": { const ns = args.filter((a): a is number => a !== null); return ns.length ? Math.min(...ns) : null; }
        case "max": { const ns = args.filter((a): a is number => a !== null); return ns.length ? Math.max(...ns) : null; }
        case "coalesce": { const first = args.find((a) => a !== null); return first ?? null; }
        case "if": { const c = args[0]; return c !== null && c !== 0 ? args[1] ?? null : args[2] ?? null; }
        default: return null;
      }
    }
  }
}

export function evaluateFormula(expr: string, row: Record<string, unknown>): FormulaValue {
  try {
    const v = evalNode(parseFormula(expr), row);
    if (v === null || !Number.isFinite(v)) return null;
    return Math.round(v * 10000) / 10000;
  } catch {
    return null;
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

export function collectIdentifiers(node: Node, acc: Set<string> = new Set()): Set<string> {
  if (node.k === "id") acc.add(node.name);
  else if (node.k === "unary") collectIdentifiers(node.x, acc);
  else if (node.k === "bin") { collectIdentifiers(node.a, acc); collectIdentifiers(node.b, acc); }
  else if (node.k === "call") node.args.forEach((a) => collectIdentifiers(a, acc));
  return acc;
}

export interface FormulaValidation {
  ok: boolean;
  error?: string;
  identifiers: string[];
}

/** Validate a formula: parseable + every identifier is an allowed numeric column. */
export function validateFormula(expr: string, allowedColumns: Set<string>): FormulaValidation {
  let ast: Node;
  try { ast = parseFormula(expr); }
  catch (e) { return { ok: false, error: e instanceof FormulaError ? e.message : "Invalid formula", identifiers: [] }; }
  const ids = [...collectIdentifiers(ast)];
  const unknown = ids.filter((id) => !allowedColumns.has(id));
  if (unknown.length > 0) return { ok: false, error: `Unknown column(s): ${unknown.join(", ")}`, identifiers: ids };
  return { ok: true, identifiers: ids };
}
