// ============================================================================
// ProjectOps360° — Drawing Intelligence → Material Requirements Bridge
// ============================================================================
// Converts material/quantity extractions from drawings into evidence-first
// material_requirement candidates. Quantities are never invented: a candidate
// is only created when the extraction carries a name, and low-confidence
// candidates are flagged needs_review.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { DrawingExtraction } from "@/types/drawing-intelligence";

/** Confidence below this marks the candidate needs_review. */
const REVIEW_THRESHOLD = 0.85;

/** Extraction types that can yield material requirement candidates. */
const MATERIAL_EXTRACTION_TYPES = new Set([
  "material_takeoff",
  "quantity_takeoff",
  "mep_elements",
  "equipment",
]);

interface MaterialCandidate {
  material_name: string;
  estimated_quantity: number | null;
  unit: string | null;
  discipline: string | null;
  spec_reference: string | null;
}

/** Parse extracted_json into material candidates. Supports both the
 *  { items: [...] } list shape and a single-object shape. Unknown shapes
 *  yield no candidates — never guess. */
export function parseMaterialCandidates(
  extraction: Pick<DrawingExtraction, "extraction_type" | "extracted_json">,
): MaterialCandidate[] {
  if (!MATERIAL_EXTRACTION_TYPES.has(extraction.extraction_type)) return [];

  const json = extraction.extracted_json;
  const rawItems = Array.isArray(json.items)
    ? json.items
    : Array.isArray(json.materials)
      ? json.materials
      : typeof json.material_name === "string" || typeof json.name === "string"
        ? [json]
        : [];

  const candidates: MaterialCandidate[] = [];
  for (const raw of rawItems) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const name =
      (typeof item.material_name === "string" && item.material_name) ||
      (typeof item.name === "string" && item.name) ||
      (typeof item.description === "string" && item.description) ||
      null;
    if (!name) continue;

    const qty =
      typeof item.estimated_quantity === "number"
        ? item.estimated_quantity
        : typeof item.quantity === "number"
          ? item.quantity
          : null;

    candidates.push({
      material_name: name.trim(),
      estimated_quantity: qty,
      unit:
        (typeof item.unit === "string" && item.unit) ||
        (typeof item.unit_of_measure === "string" && item.unit_of_measure) ||
        null,
      discipline: (typeof item.discipline === "string" && item.discipline) || null,
      spec_reference:
        (typeof item.spec_reference === "string" && item.spec_reference) ||
        (typeof item.spec === "string" && item.spec) ||
        null,
    });
  }
  return candidates;
}

export interface MaterialExtractionResult {
  candidatesCreated: number;
  skippedExisting: number;
}

/**
 * Generate material_requirements candidates from a drawing's completed
 * extractions. Idempotent per (source_extraction_id, name).
 */
export async function extractMaterialsFromDrawing(
  organizationId: string,
  projectId: string,
  drawingFileId: string,
): Promise<MaterialExtractionResult> {
  const supabase = createAdminClient();

  const { data: extractions } = await supabase
    .from("drawing_extractions")
    .select("id, extraction_type, extracted_json, confidence_score, evidence_json, drawing_page_id")
    .eq("drawing_file_id", drawingFileId)
    .eq("extraction_status", "completed")
    .is("deleted_at", null);

  const { data: existing } = await supabase
    .from("material_requirements")
    .select("source_extraction_id, name")
    .eq("project_id", projectId)
    .eq("source_drawing_id", drawingFileId)
    .is("deleted_at", null);

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.source_extraction_id}::${e.name.toLowerCase()}`),
  );

  let candidatesCreated = 0;
  let skippedExisting = 0;

  for (const extraction of extractions ?? []) {
    const candidates = parseMaterialCandidates(extraction);
    for (const c of candidates) {
      const key = `${extraction.id}::${c.material_name.toLowerCase()}`;
      if (existingKeys.has(key)) {
        skippedExisting++;
        continue;
      }
      existingKeys.add(key);

      const confidence = extraction.confidence_score ?? null;
      const { error } = await supabase.from("material_requirements").insert({
        organization_id: organizationId,
        project_id: projectId,
        name: c.material_name,
        spec_reference: c.spec_reference,
        discipline: c.discipline,
        quantity: c.estimated_quantity,
        unit_of_measure: c.unit,
        status: "planned",
        source_drawing_id: drawingFileId,
        source_extraction_id: extraction.id,
        confidence_score: confidence,
        evidence_json: {
          extraction_type: extraction.extraction_type,
          drawing_page_id: extraction.drawing_page_id,
          source_evidence: extraction.evidence_json,
        },
        needs_review: confidence == null || confidence < REVIEW_THRESHOLD,
        origin: "drawing_extraction",
      });
      if (!error) candidatesCreated++;
    }
  }

  return { candidatesCreated, skippedExisting };
}
