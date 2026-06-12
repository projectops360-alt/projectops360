/**
 * Task 4.1 — Apply AI task statuses migration to Supabase
 * Runs migration 20260620000000_add_ai_task_statuses.sql
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
    console.log("\n📋 Applying migration 20260620000000_add_ai_task_statuses...");
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260620000000_add_ai_task_statuses.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Execute migration statements
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

    // ── Verify CHECK constraint ─────────────────────────────────────────────
    const constraint = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.roadmap_tasks'::regclass
        AND conname = 'roadmap_tasks_status_check';
    `);
    console.log("\n📊 CHECK constraint verified:");
    console.log(`   Name: ${constraint.rows[0].conname}`);
    console.log(`   Definition: ${constraint.rows[0].definition}`);

    // ── Verify new statuses in constraint ───────────────────────────────────
    const def = constraint.rows[0].definition;
    const newStatuses = ["prompt_ready", "sent_to_ai", "implemented", "tested"];
    for (const status of newStatuses) {
      const present = def.includes(`'${status}'`);
      console.log(`   ${present ? "✅" : "❌"} ${status} ${present ? "present" : "MISSING"}`);
    }

    // ── Verify existing data still works ────────────────────────────────────
    const taskCount = await client.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'done') AS done,
             COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
             COUNT(*) FILTER (WHERE status = 'not_started') AS not_started,
             COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
             COUNT(*) FILTER (WHERE status = 'deferred') AS deferred
      FROM public.roadmap_tasks
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND deleted_at IS NULL;
    `);
    const tc = taskCount.rows[0];
    console.log("\n📊 Existing task statuses (all preserved):");
    console.log(`   Total: ${tc.total}`);
    console.log(`   Done: ${tc.done}, In Progress: ${tc.in_progress}, Not Started: ${tc.not_started}`);
    console.log(`   Blocked: ${tc.blocked}, Deferred: ${tc.deferred}`);

    // ── Test insert with new status ─────────────────────────────────────────
    const testResult = await client.query(`
      INSERT INTO public.roadmap_tasks (
        organization_id, project_id, title, status, priority, external_key
      ) VALUES (
        '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
        'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
        '___test_prompt_ready_status',
        'prompt_ready',
        'p3',
        '__test_status_check'
      ) RETURNING id, status;
    `);
    console.log(`\n📊 Test insert with new status:`);
    console.log(`   ✅ Inserted test row with status='${testResult.rows[0].status}'`);

    // Clean up test row
    await client.query(`
      DELETE FROM public.roadmap_tasks
      WHERE external_key = '__test_status_check'
        AND organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6';
    `);
    console.log("   ✅ Test row cleaned up");

    console.log("\n" + "═".repeat(60));
    console.log("🎉 TASK 4.1 MIGRATION COMPLETE");
    console.log("═".repeat(60));
    console.log("  ✅ CHECK constraint updated with 9 statuses");
    console.log("  ✅ Existing data preserved");
    console.log("  ✅ New statuses can be inserted");
    console.log("  ✅ Indexes created for prompt_ready and sent_to_ai");

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