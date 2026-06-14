/**
 * Apply migration 20260714000000_project_memory_items.sql
 *
 * Runs the entire file as a single query so the dollar-quoted match_documents
 * function body (which contains semicolons) is preserved.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const envPath = path.resolve(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");
  const dbUrlLine = envContent.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  const DATABASE_URL = dbUrlLine.replace("DATABASE_URL=", "").trim();

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("✅ Connected to Supabase");

    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260714000000_project_memory_items.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("📋 Applying 20260714000000_project_memory_items…");
    await client.query(sql);
    console.log("✅ Migration applied");

    // Sanity checks
    const { rows: tbl } = await client.query(
      "SELECT to_regclass('public.project_memory_items') AS t"
    );
    console.log("   project_memory_items:", tbl[0].t ? "present" : "MISSING");

    const { rows: fn } = await client.query(
      "SELECT proname FROM pg_proc WHERE proname = 'match_documents'"
    );
    console.log("   match_documents fn:", fn.length ? "present" : "MISSING");

    const { rows: cons } = await client.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'traceability_links_source_type_check'"
    );
    console.log("   traceability source CHECK includes memory:", cons[0]?.def.includes("memory") ? "yes" : "no");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
