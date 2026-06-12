// ============================================================================
// One-off cleanup: soft-delete drawing intelligence rows whose parent
// drawing_file was already soft-deleted (orphans left by the pre-cascade
// archive action). Safe to re-run — only touches rows with deleted_at IS NULL.
//   node scripts/cleanup-orphaned-drawing-data.mjs          → dry run (report)
//   node scripts/cleanup-orphaned-drawing-data.mjs --apply  → soft-delete
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (no extra deps)
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf-8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const apply = process.argv.includes("--apply");

const CHILD_TABLES = [
  "drawing_processing_jobs",
  "drawing_pages",
  "drawing_extractions",
  "drawing_insights",
  "drawing_evidence",
  "drawing_versions",
];

// 1. All soft-deleted drawing files
const { data: deletedFiles, error: filesError } = await supabase
  .from("drawing_files")
  .select("id, file_name, deleted_at")
  .not("deleted_at", "is", null);
if (filesError) { console.error(filesError); process.exit(1); }

if (!deletedFiles?.length) {
  console.log("No soft-deleted drawing files — nothing to clean.");
  process.exit(0);
}
console.log(`Soft-deleted files: ${deletedFiles.length}`);
const fileIds = deletedFiles.map((f) => f.id);
const deletedAt = new Date().toISOString();

// 2. Per child table: count live orphans, then soft-delete with --apply
let totalOrphans = 0;
const insightIds = [];
for (const table of CHILD_TABLES) {
  const { data: orphans, error } = await supabase
    .from(table)
    .select("id")
    .in("drawing_file_id", fileIds)
    .is("deleted_at", null);
  if (error) { console.error(`${table}:`, error.message); continue; }
  const count = orphans?.length ?? 0;
  totalOrphans += count;
  if (table === "drawing_insights") insightIds.push(...(orphans ?? []).map((r) => r.id));
  console.log(`${table}: ${count} orphan row(s)${apply && count ? " → soft-deleting" : ""}`);
  if (apply && count > 0) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ deleted_at: deletedAt })
      .in("drawing_file_id", fileIds)
      .is("deleted_at", null);
    if (updateError) console.error(`${table} update:`, updateError.message);
  }
}

// 3. Living Graph nodes for deleted files + their orphaned insights
const orFilters = [
  `and(source_entity_type.eq.drawing_files,source_entity_id.in.(${fileIds.join(",")}))`,
];
if (insightIds.length > 0) {
  orFilters.push(`and(source_entity_type.eq.drawing_insights,source_entity_id.in.(${insightIds.join(",")}))`);
}
const { data: nodes, error: nodesError } = await supabase
  .from("process_nodes")
  .select("id")
  .is("deleted_at", null)
  .or(orFilters.join(","));
if (nodesError) {
  console.error("process_nodes:", nodesError.message);
} else {
  console.log(`process_nodes: ${nodes?.length ?? 0} orphan node(s)${apply && nodes?.length ? " → soft-deleting" : ""}`);
  if (apply && nodes?.length) {
    const { error: nodeUpdateError } = await supabase
      .from("process_nodes")
      .update({ deleted_at: deletedAt })
      .in("id", nodes.map((n) => n.id));
    if (nodeUpdateError) console.error("process_nodes update:", nodeUpdateError.message);
  }
}

console.log(apply
  ? `Done — cleaned ${totalOrphans} orphan row(s).`
  : `Dry run — ${totalOrphans} orphan row(s) found. Re-run with --apply to clean.`);
