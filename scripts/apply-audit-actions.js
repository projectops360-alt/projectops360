/**
 * Task 4.8 — Expand audit_logs action types for roadmap execution
 * Runs migration 20260622000000_expand_audit_actions.sql
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const envPath = path.resolve(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");
  const dbUrlLine = envContent.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  const DATABASE_URL = dbUrlLine.replace("DATABASE_URL=", "").trim();

  console.log("🔗 Connecting to Supabase...");
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("✅ Connected");

    // ── Run migration ─────────────────────────────────────────────────────
    console.log("\n📋 Applying migration 20260622000000_expand_audit_actions...");
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260622000000_expand_audit_actions.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    await client.query(migrationSQL);
    console.log("✅ Migration applied successfully");

    // ── Verify ─────────────────────────────────────────────────────────────
    console.log("\n🔍 Verifying constraint...");
    const { rows } = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'audit_logs_action_check'
        AND conrelid = 'public.audit_logs'::regclass;
    `);
    console.log("Constraint:", rows[0]?.definition ?? "NOT FOUND");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();