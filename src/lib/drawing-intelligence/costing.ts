// ============================================================================
// ProjectOps360° — Takeoff Costing & Quantification (server-only)
// ============================================================================
// Promotes the AI material/quantity takeoff (drawing_extractions) into the
// estimating layer (material_requirements) with quantities and costs:
//   • quantity  — carried from the AI takeoff, or derived by a light rule
//   • unit_cost — matched from the cost library via a pluggable CostProvider
//   • total     — quantity × unit_cost
// The estimate lives in material_requirements (origin='drawing_extraction'),
// so it flows into the existing budget + Reports. Idempotent per drawing.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

type Supabase = ReturnType<typeof createAdminClient>;

export interface UnitCost {
  unitCost: number;
  unit: string;
  currency: string;
  source: string;
}

// ── Cost provider abstraction ───────────────────────────────────────────────
// ManualCostLibrary (the cost_library_items table) is the default. Live
// providers (1build, BigBox) implement the same interface and are selected
// when an API key is configured — no caller changes needed.

export interface CostProvider {
  readonly name: string;
  /** Resolve a unit cost for a takeoff line, or null when unknown. */
  lookup(input: { category: string; item: string; specification: string; unit: string | null }): UnitCost | null;
}

interface LibraryRow {
  organization_id: string | null;
  category: string;
  keyword: string | null;
  unit: string;
  unit_cost: number;
  currency: string;
  source: string;
}

/** Cost library backed by cost_library_items (org rows override global seed). */
class ManualCostLibrary implements CostProvider {
  readonly name = "cost_library";
  constructor(private readonly rows: LibraryRow[]) {}

  lookup(input: { category: string; item: string; specification: string; unit: string | null }): UnitCost | null {
    const cat = input.category.trim().toLowerCase();
    const haystack = `${input.item} ${input.specification}`.toLowerCase();
    const candidates = this.rows.filter((r) => r.category.toLowerCase() === cat);
    if (candidates.length === 0) return null;

    const score = (r: LibraryRow): number => {
      let s = 0;
      if (r.organization_id) s += 100; // org override beats global seed
      if (r.keyword && haystack.includes(r.keyword.toLowerCase())) s += 50; // keyword hit
      else if (r.keyword) s -= 1000; // keyword set but not matched → not applicable
      if (input.unit && r.unit.toLowerCase() === input.unit.toLowerCase()) s += 10;
      return s;
    };

    let best: LibraryRow | null = null;
    let bestScore = -Infinity;
    for (const r of candidates) {
      const s = score(r);
      if (s > bestScore && s > -1000) { best = r; bestScore = s; }
    }
    if (!best) return null;
    return { unitCost: Number(best.unit_cost), unit: best.unit, currency: best.currency, source: best.source };
  }
}

async function loadCostProvider(supabase: Supabase, organizationId: string): Promise<CostProvider> {
  // Org rows + global seed defaults (organization_id IS NULL).
  const { data } = await supabase
    .from("cost_library_items")
    .select("organization_id, category, keyword, unit, unit_cost, currency, source")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .is("deleted_at", null);
  return new ManualCostLibrary((data ?? []) as LibraryRow[]);
}

// ── Quantification (manual + light rules) ───────────────────────────────────

/** Derive a quantity for a takeoff line. Conservative: trust the AI quantity
 *  when present; otherwise parse an explicit area ("234 sqft") from the spec.
 *  Returns null when no reliable basis exists → the estimator fills it in. */
function deriveQuantity(json: Record<string, unknown>): { quantity: number | null; source: "ai" | "rule" | "manual" } {
  const aiQty = Number(json.quantity);
  const spec = String(json.specification ?? "");
  const item = String(json.item ?? "");
  const text = `${item} ${spec}`;

  // 1. AI quantity — unless it's a schedule row index (standalone leading
  //    number that equals the quantity, e.g. "40 1⅛"-1¼" 10d common…" → 40).
  //    Standalone = followed by whitespace, so "4x4 POST" (qty 4) is kept.
  if (Number.isFinite(aiQty) && aiQty > 0) {
    const lead = spec.match(/^\s*(\d+)\s+/);
    const isRowIndex = lead != null && Number(lead[1]) === aiQty;
    if (!isRowIndex) return { quantity: aiQty, source: "ai" };
  }

  // 2. "(N)" count notation at the start → N pieces. Very common in framing
  //    callouts: "(2) 2x10", "(2) 1.75 x 11.875 MICROLAM" → 2. Must be leading
  //    so mid-spec counts ("…W/ (2) #4 REBARS") don't mislabel the parent item.
  const paren = spec.match(/^\s*\((\d{1,3})\)\s*\D/) ?? item.match(/^\s*\((\d{1,3})\)\s*\D/);
  if (paren) {
    const n = Number(paren[1]);
    if (n > 0 && n <= 500) return { quantity: n, source: "rule" };
  }

  // 3. Explicit area in the text: "234 sqft", "1,515 SF", "548 S.F.".
  const area = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s?ft|sf|s\.f\.|square\s+feet)\b/i);
  if (area) {
    const n = Number(area[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { quantity: n, source: "rule" };
  }

  // 4. Explicit count / qty notation: "8 EA", "5 each", "QTY: 4".
  const count =
    spec.match(/\b(\d{1,4})\s*(?:ea\b|each\b|units?\b|pcs?\b)/i) ??
    spec.match(/\bqty\.?\s*[:=]?\s*(\d{1,4})\b/i);
  if (count) {
    const n = Number(count[1]);
    if (n > 0) return { quantity: n, source: "rule" };
  }

  // No reliable basis — area/length needs geometry; the estimator fills it in.
  return { quantity: null, source: "manual" };
}

/** Stable content key for matching an estimate line across regenerations
 *  (extraction ids change each run, so we match on category|item|spec). */
function estimateKey(category: string, item: string, spec: string): string {
  return `${category}|${item}|${spec}`.toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Public: generate the costed estimate for one drawing ────────────────────

export interface EstimateSummary {
  ok: boolean;
  lineItems: number;
  withQuantity: number;
  withUnitCost: number;
  totalCost: number;
  currency: string;
  unmatchedCategories: string[];
  error?: string;
}

/**
 * Build/refresh the cost estimate for a drawing's takeoff. Reads the AI takeoff
 * rows and upserts them into material_requirements with quantity + unit cost +
 * total. Idempotent: previous drawing-derived rows for this file are replaced.
 */
export async function generateTakeoffEstimate(input: {
  organizationId: string;
  projectId: string;
  fileId: string;
}): Promise<EstimateSummary> {
  const { organizationId, projectId, fileId } = input;
  const supabase = createAdminClient();

  const { data: takeoff } = await supabase
    .from("drawing_extractions")
    .select("id, extracted_json, confidence_score")
    .eq("drawing_file_id", fileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("extraction_type", ["material_takeoff", "quantity_takeoff"]);

  if (!takeoff || takeoff.length === 0) {
    return { ok: false, lineItems: 0, withQuantity: 0, withUnitCost: 0, totalCost: 0, currency: "USD", unmatchedCategories: [], error: "no_takeoff" };
  }

  const provider = await loadCostProvider(supabase, organizationId);

  // Preserve human edits across regenerations: load the previous drawing-derived
  // rows and remember the quantity/unit-cost of any line the estimator edited,
  // keyed by content (category|item|spec) since extraction ids change per run.
  const { data: prevRows } = await supabase
    .from("material_requirements")
    .select("name, description, quantity, estimated_unit_cost, metadata")
    .eq("organization_id", organizationId)
    .eq("source_drawing_id", fileId)
    .eq("origin", "drawing_extraction")
    .is("deleted_at", null);

  const editedByKey = new Map<string, { quantity: number | null; unitCost: number | null }>();
  for (const r of prevRows ?? []) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    if (meta.manually_edited === true) {
      const key = estimateKey(String(meta.category ?? ""), r.name ?? "", r.description ?? "");
      editedByKey.set(key, {
        quantity: r.quantity != null ? Number(r.quantity) : null,
        unitCost: r.estimated_unit_cost != null ? Number(r.estimated_unit_cost) : null,
      });
    }
  }

  // Idempotency: clear previous drawing-derived estimate rows for this file.
  await supabase
    .from("material_requirements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("source_drawing_id", fileId)
    .eq("origin", "drawing_extraction")
    .is("deleted_at", null);

  const rows: Record<string, unknown>[] = [];
  const unmatched = new Set<string>();
  let withQuantity = 0;
  let withUnitCost = 0;
  let totalCost = 0;
  let currency = "USD";

  for (const t of takeoff) {
    const json = (t.extracted_json ?? {}) as Record<string, unknown>;
    const category = String(json.category ?? "").trim() || "Uncategorized";
    const item = String(json.item ?? "").trim() || "Material";
    const specification = String(json.specification ?? "").trim();
    // Sanitize unit — the AI sometimes returns the string "null"/"undefined".
    const rawUnit = json.unit ? String(json.unit).trim() : "";
    const aiUnit = rawUnit && !/^(null|undefined|n\/a|-)$/i.test(rawUnit) ? rawUnit : null;

    const auto = deriveQuantity(json);
    const cost = provider.lookup({ category, item, specification, unit: aiUnit });
    if (!cost) unmatched.add(category);

    const unit = aiUnit || cost?.unit || "EA";

    // Apply preserved human edits (match by content key) over the auto values.
    const edited = editedByKey.get(estimateKey(category, item, specification));
    let quantity = auto.quantity;
    let qtySource = auto.source;
    let unitCost = cost?.unitCost ?? null;
    let manuallyEdited = false;
    if (edited) {
      manuallyEdited = true;
      if (edited.quantity != null) { quantity = edited.quantity; qtySource = "manual"; }
      if (edited.unitCost != null) { unitCost = edited.unitCost; }
    }

    const extended = quantity != null && unitCost != null ? Math.round(quantity * unitCost * 100) / 100 : null;

    if (quantity != null) withQuantity++;
    if (unitCost != null) withUnitCost++;
    if (extended != null) totalCost += extended;
    if (cost?.currency) currency = cost.currency;

    rows.push({
      organization_id: organizationId,
      project_id: projectId,
      name: item.slice(0, 200),
      description: specification.slice(0, 1000) || null,
      spec_reference: json.sheet_ref ? String(json.sheet_ref).slice(0, 80) : null,
      quantity,
      unit_of_measure: unit,
      estimated_unit_cost: unitCost,
      estimated_total_cost: extended,
      status: "required",
      source_drawing_id: fileId,
      source_extraction_id: t.id,
      confidence_score: t.confidence_score ?? null,
      origin: "drawing_extraction",
      needs_review: manuallyEdited ? false : ((Number(t.confidence_score ?? 1) < 0.7) || unitCost == null || quantity == null),
      metadata: { category, quantity_source: qtySource, cost_source: cost?.source ?? "unmatched", manually_edited: manuallyEdited },
    });
  }

  const { error } = await supabase.from("material_requirements").insert(rows);
  if (error) {
    console.error("[costing] material_requirements insert failed:", error);
    return { ok: false, lineItems: 0, withQuantity: 0, withUnitCost: 0, totalCost: 0, currency, unmatchedCategories: [...unmatched], error: "insert_failed" };
  }

  return {
    ok: true,
    lineItems: rows.length,
    withQuantity,
    withUnitCost,
    totalCost: Math.round(totalCost * 100) / 100,
    currency,
    unmatchedCategories: [...unmatched],
  };
}
