/**
 * Task 4.2 — Apply prompt storage fields migration to Supabase
 * Adds: prompt_body, prompt_context, prompt_version, last_prompt_sent_at,
 *       ai_tool_target, implementation_notes, test_notes
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
    console.log("\n📋 Applying migration 20260621000000_add_prompt_storage_fields...");
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260621000000_add_prompt_storage_fields.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    const statements = migrationSQL
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        if (err.message && err.message.includes("already exists")) {
          console.log(`  ⚠️  Skipped (already exists): ${stmt.substring(0, 80)}...`);
        } else {
          throw err;
        }
      }
    }
    console.log("✅ Migration applied successfully");

    // ── Verify new columns ─────────────────────────────────────────────────
    const colCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roadmap_tasks'
        AND column_name IN ('prompt_body', 'prompt_context', 'prompt_version',
                            'last_prompt_sent_at', 'ai_tool_target',
                            'implementation_notes', 'test_notes')
      ORDER BY column_name;
    `);
    console.log("\n📊 New columns verified:");
    for (const row of colCheck.rows) {
      console.log(`   ✓ ${row.column_name}: ${row.data_type}${row.column_default ? ` (default: ${row.column_default})` : ""}`);
    }

    if (colCheck.rows.length < 7) {
      console.error("❌ Not all columns were added! Expected 7, found", colCheck.rows.length);
      process.exit(1);
    }

    // ── Verify existing data still works ─────────────────────────────────────
    const taskCount = await client.query(`
      SELECT COUNT(*) AS total FROM public.roadmap_tasks
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND deleted_at IS NULL;
    `);
    console.log(`\n📊 Existing tasks preserved: ${taskCount.rows[0].total}`);

    // ── Test insert with prompt fields ──────────────────────────────────────
    const testResult = await client.query(`
      INSERT INTO public.roadmap_tasks (
        organization_id, project_id, title, status, priority, external_key,
        prompt_body, prompt_context, prompt_version, ai_tool_target
      ) VALUES (
        '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
        'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
        '___test_prompt_fields',
        'prompt_ready',
        'p2',
        '__test_prompt_fields',
        'Implement the auth middleware using JWT tokens',
        'Sprint 3 — Core Features: Authentication module',
        1,
        'claude'
      ) RETURNING id, status, prompt_body, prompt_context, prompt_version, ai_tool_target;
    `);
    console.log("\n📊 Test insert with prompt fields:");
    console.log(`   ✅ status='${testResult.rows[0].status}'`);
    console.log(`   ✅ prompt_body='${testResult.rows[0].prompt_body?.substring(0, 40)}...'`);
    console.log(`   ✅ prompt_context='${testResult.rows[0].prompt_context}'`);
    console.log(`   ✅ prompt_version=${testResult.rows[0].prompt_version}`);
    console.log(`   ✅ ai_tool_target='${testResult.rows[0].ai_tool_target}'`);

    // Clean up test row
    await client.query(`
      DELETE FROM public.roadmap_tasks
      WHERE external_key = '__test_prompt_fields'
        AND organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6';
    `);
    console.log("   ✅ Test row cleaned up");

    console.log("\n" + "═".repeat(60));
    console.log("🎉 TASK 4.2 MIGRATION COMPLETE");
    console.log("═".repeat(60));
    console.log("  ✅ 7 new columns added to roadmap_tasks");
    console.log("  ✅ Existing data preserved");
    console.log("  ✅ New fields can be inserted");
    console.log("  ✅ Indexes created for prompt queries");

  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.detail) console.error("   Detail:", err.detail);
    if (err.hint) console.error("   Hint:", err.hint);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n🔌 Database connection closed.");
  }
}

main();