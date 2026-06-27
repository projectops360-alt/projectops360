// ============================================================================
// Backfill embeddings for ProjectOps Scribe traceability (run once, idempotent)
// ============================================================================
// The reverse links (project_backlog_items.source_memory_item_id / source_scribe_item_id)
// are backfilled by migration 20260810. This script generates the MISSING
// embeddings so historical Scribe work items + their notes become searchable:
//   1. project_backlog_items with source='projectops_scribe' AND embedding IS NULL
//   2. project_memory_items from Scribe with embedding IS NULL
//
// It never overwrites existing embeddings. Reports anything it cannot embed.
//
// Usage: node scripts/backfill-scribe-embeddings.mjs
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
// (read from the environment, or from .env.local if present).
// ============================================================================

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ── Load env (process.env first, then .env.local) ───────────────────────────
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local — rely on process.env */ }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = env.OPENAI_API_KEY;
if (!url || !key) { console.error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."); process.exit(1); }
if (!openaiKey) { console.error("Missing OPENAI_API_KEY."); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: openaiKey });

async function embed(text) {
  const r = await openai.embeddings.create({ model: "text-embedding-3-small", input: text, dimensions: 1536 });
  return r.data[0]?.embedding ?? null;
}

let embedded = 0, skipped = 0, failed = 0;

// ── 1. Generated work items ─────────────────────────────────────────────────
{
  const { data, error } = await supabase
    .from("project_backlog_items")
    .select("id, title, description, source_reference")
    .eq("source", "projectops_scribe")
    .is("embedding", null);
  if (error) { console.error("backlog query failed:", error.message); }
  for (const row of data ?? []) {
    const text = [row.title, row.description, row.source_reference].filter(Boolean).join("\n").trim();
    if (!text) { skipped++; continue; }
    try {
      const v = await embed(text);
      if (!v) { failed++; continue; }
      const { error: ue } = await supabase.from("project_backlog_items").update({ embedding: v }).eq("id", row.id);
      if (ue) { failed++; console.error("work_item update failed", row.id, ue.message); } else embedded++;
    } catch (e) { failed++; console.error("work_item embed failed", row.id, e.message); }
  }
  console.log(`Work items: embedded=${embedded} skipped=${skipped} failed=${failed} (of ${data?.length ?? 0})`);
}

// ── 2. Scribe memory notes missing an embedding ─────────────────────────────
{
  let m = 0, mf = 0;
  const { data, error } = await supabase
    .from("project_memory_items")
    .select("id, source_type, title, author_name, participants, tags, summary, content")
    .eq("source_system", "projectops_scribe")
    .is("embedding", null)
    .is("deleted_at", null);
  if (error) { console.error("memory query failed:", error.message); }
  for (const row of data ?? []) {
    const text = [row.source_type, row.title, row.author_name,
      Array.isArray(row.participants) ? row.participants.join(", ") : "",
      Array.isArray(row.tags) ? row.tags.join(", ") : "",
      row.summary, row.content].filter(Boolean).join("\n").trim();
    if (!text) continue;
    try {
      const v = await embed(text);
      if (!v) { mf++; continue; }
      const { error: ue } = await supabase.from("project_memory_items")
        .update({ embedding: v, index_status: "completed" }).eq("id", row.id);
      if (ue) { mf++; } else m++;
    } catch (e) { mf++; console.error("memory embed failed", row.id, e.message); }
  }
  console.log(`Memory notes: embedded=${m} failed=${mf} (of ${data?.length ?? 0})`);
}

console.log("Backfill complete.");
