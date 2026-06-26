// One-off: generate embeddings for Living Guide knowledge chunks.
// Usage: node scripts/index-living-guide.mjs
// Reads SUPABASE + OPENAI creds from .env.local. Idempotent (only pending/null).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ── load .env.local ───────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = env.OPENAI_API_KEY;
if (!url || !key || !openaiKey) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY / OPENAI_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: openaiKey });

const { data: chunks, error } = await supabase
  .from("knowledge_chunks")
  .select("id, body")
  .is("embedding", null)
  .is("deleted_at", null)
  .in("index_status", ["pending", "failed"]);

if (error) { console.error(error); process.exit(1); }
console.log(`Chunks to embed: ${chunks.length}`);

let embedded = 0, failed = 0;
for (const c of chunks) {
  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: c.body,
      dimensions: 1536,
    });
    const embedding = res.data[0]?.embedding;
    if (!embedding) throw new Error("no embedding");
    const { error: upErr } = await supabase
      .from("knowledge_chunks")
      .update({ embedding, embedding_model: "text-embedding-3-small", embedding_dims: 1536, index_status: "completed" })
      .eq("id", c.id);
    if (upErr) throw upErr;
    embedded++;
  } catch (e) {
    failed++;
    await supabase.from("knowledge_chunks").update({ index_status: "failed" }).eq("id", c.id);
    console.error(`Failed ${c.id}:`, e.message);
  }
}
console.log(`Done. embedded=${embedded} failed=${failed}`);
