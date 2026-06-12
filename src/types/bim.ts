// ============================================================================
// ProjectOps360° — BIM Type Scaffolding (Prompt 5 — types only, NO tables yet)
// ============================================================================
// Prepared shapes for Autodesk Model Derivative / AEC Data Model output.
// TODO(prompt-5+): create the bim_models / bim_elements / bim_properties
// tables (same conventions: org+project scoping, soft delete, RLS) only when
// the Model Derivative pipeline is implemented. Creating them now would be
// dead schema — deliberate decision per the "only if needed" instruction.
// ============================================================================

export interface BimModelRef {
  id: string;
  organization_id: string;
  project_id: string;
  drawing_file_id: string | null;
  source_system: string; // autodesk_aps | ifc_upload | …
  external_urn: string; // Model Derivative URN
  translation_status: "pending" | "translating" | "complete" | "failed";
  metadata: Record<string, unknown>;
}

export interface BimElementRef {
  id: string;
  bim_model_id: string;
  external_object_id: string;
  category: string | null; // e.g. Walls, Ducts, Equipment
  family: string | null;
  level: string | null;
  system: string | null;
  /** Flattened key properties; full property set stays in the source */
  properties: Record<string, unknown>;
  /** Links back into Drawing Intelligence / Living Graph */
  linked_insight_id: string | null;
  linked_task_id: string | null;
}
