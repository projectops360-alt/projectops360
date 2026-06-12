/**
 * Sprint 10 DB Sync — Applies migration + seed data to Supabase
 *
 * Usage: node scripts/sync-sprint10.js
 *
 * Reads DATABASE_URL from .env.local
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  // ── Read DATABASE_URL from .env.local ────────────────────────────────────
  const envPath = path.resolve(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");
  const dbUrlLine = envContent.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!dbUrlLine) {
    console.error("❌ DATABASE_URL not found in .env.local");
    process.exit(1);
  }
  const DATABASE_URL = dbUrlLine.replace("DATABASE_URL=", "").trim();
  console.log("🔗 Connecting to Supabase PostgreSQL...");

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // ── STEP 1: Run migration ─────────────────────────────────────────────
    console.log("\n📋 STEP 1: Running migration 20260619000000...");
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260619000000_add_roadmap_task_tracking_fields.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split by semicolons and execute each statement
    const migrationStatements = migrationSQL
      .split("\n")
      .filter((line) => !line.trim().startsWith("--")) // strip full-line comments
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of migrationStatements) {
      try {
        await client.query(stmt);
      } catch (err) {
        // IF NOT EXISTS should handle most conflicts, but log if not
        if (err.code === "42701" || err.message.includes("already exists")) {
          console.log(`  ⚠️  Skipped (already exists): ${stmt.substring(0, 80)}...`);
        } else {
          throw err;
        }
      }
    }
    console.log("✅ Migration applied successfully");

    // ── Verify new columns exist ───────────────────────────────────────────
    const colCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roadmap_tasks'
        AND column_name IN ('external_key', 'execution_notes', 'completed_at')
      ORDER BY column_name;
    `);
    console.log("\n📊 New columns verified:");
    for (const row of colCheck.rows) {
      console.log(`   ✓ ${row.column_name}: ${row.data_type}`);
    }

    if (colCheck.rows.length < 3) {
      console.error("❌ Not all columns were added! Expected 3, found", colCheck.rows.length);
      process.exit(1);
    }

    // ── STEP 2: Run seed sync ──────────────────────────────────────────────
    console.log("\n📋 STEP 2: Running Sprint 10 seed sync...");
    const seedPath = path.resolve(__dirname, "../supabase/seed_sprint10_sync.sql");
    const seedSQL = fs.readFileSync(seedPath, "utf8");

    // Remove comment lines and verification queries (everything after VERIFICATION QUERIES header)
    const seedMain = seedSQL
      .split("-- ══════════════════════════════════════════════════════════════════════════════\n-- VERIFICATION QUERIES")[0];

    // Execute as a single transaction
    await client.query("BEGIN");

    try {
      // Process the seed SQL: split by statements but handle the subqueries properly
      // We'll execute in smaller chunks to avoid issues with subqueries
      const seedStatements = seedMain
        .split("\n")
        .filter((line) => !line.trim().startsWith("--")) // strip comments
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of seedStatements) {
        await client.query(stmt);
      }

      await client.query("COMMIT");
      console.log("✅ Seed data applied successfully");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    // ── STEP 3: Verification queries ───────────────────────────────────────
    console.log("\n📋 STEP 3: Verification...\n");

    // V1: Milestone
    const v1 = await client.query(`
      SELECT id, title, status, progress_percent, completed_date, icon_key, color_key, order_index
      FROM public.milestones
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND title          = 'Sprint 10 — Visual Roadmap Module'
        AND deleted_at IS NULL;
    `);
    console.log("V1 — Sprint 10 Milestone:");
    if (v1.rows.length === 0) {
      console.log("  ❌ NOT FOUND");
    } else {
      const m = v1.rows[0];
      console.log(`  ✓ Title: ${m.title}`);
      console.log(`  ✓ Status: ${m.status}`);
      console.log(`  ✓ Progress: ${m.progress_percent}%`);
      console.log(`  ✓ Completed: ${m.completed_date}`);
      console.log(`  ✓ Icon: ${m.icon_key}, Color: ${m.color_key}`);
      console.log(`  ✓ Order: ${m.order_index}`);
    }

    // V2: Tasks
    const v2 = await client.query(`
      SELECT external_key, title, status, priority, sprint_name, estimate_hours, completed_at
      FROM public.roadmap_tasks
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND external_key   LIKE '3.%'
        AND deleted_at IS NULL
      ORDER BY order_index;
    `);
    console.log("\nV2 — Sprint 10 Tasks:");
    for (const t of v2.rows) {
      const completed = t.completed_at ? "✓" : "✗";
      console.log(`  ${completed} ${t.external_key} | ${t.status.padEnd(12)} | ${t.priority} | ${t.sprint_name} | ${t.estimate_hours}h | ${t.title}`);
    }
    console.log(`  Total: ${v2.rows.length}/12`);

    // V3: Duplicates
    const v3 = await client.query(`
      SELECT external_key, COUNT(*) AS cnt
      FROM public.roadmap_tasks
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND external_key   LIKE '3.%'
        AND deleted_at IS NULL
      GROUP BY external_key
      HAVING COUNT(*) > 1;
    `);
    console.log("\nV3 — Duplicates:");
    if (v3.rows.length === 0) {
      console.log("  ✓ No duplicates found");
    } else {
      for (const d of v3.rows) {
        console.log(`  ❌ ${d.external_key}: ${d.cnt} duplicates`);
      }
    }

    // V4: Milestone link
    const v4 = await client.query(`
      SELECT rt.external_key, rt.title, m.title AS milestone_title
      FROM public.roadmap_tasks rt
      JOIN public.milestones m ON rt.milestone_id = m.id
      WHERE rt.organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND rt.project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND rt.external_key   LIKE '3.%'
        AND rt.deleted_at IS NULL
      ORDER BY rt.order_index;
    `);
    console.log("\nV4 — Task → Milestone linkage:");
    const allLinked = v4.rows.every((r) => r.milestone_title === "Sprint 10 — Visual Roadmap Module");
    console.log(`  ${allLinked ? "✓" : "❌"} All tasks linked to Sprint 10 milestone`);

    // V5: Summary
    const v5 = await client.query(`
      SELECT
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'done') AS done_tasks,
        COALESCE(SUM(estimate_hours), 0)::numeric(6,2) AS total_estimate_hours,
        ROUND(AVG(CASE WHEN status = 'done' THEN 100 ELSE 0 END)) AS completion_pct
      FROM public.roadmap_tasks
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND external_key   LIKE '3.%'
        AND deleted_at IS NULL;
    `);
    console.log("\nV5 — Sprint 10 Summary:");
    const s = v5.rows[0];
    console.log(`  Tasks:    ${s.done_tasks}/${s.total_tasks}`);
    console.log(`  Hours:    ${s.total_estimate_hours}`);
    console.log(`  Progress: ${s.completion_pct}%`);

    // ── Final verdict ─────────────────────────────────────────────────────
    const milestoneOk = v1.rows.length === 1 && v1.rows[0].status === "completed" && v1.rows[0].progress_percent === 100;
    const tasksOk = v2.rows.length === 12 && v2.rows.every((t) => t.status === "done");
    const noDupes = v3.rows.length === 0;
    const allLinkedOk = allLinked;
    const pctOk = Number(s.completion_pct) === 100;

    console.log("\n" + "═".repeat(60));
    console.log("🏁 SPRINT 10 SYNC VERDICT");
    console.log("═".repeat(60));
    console.log(`  Milestone:  ${milestoneOk ? "✅" : "❌"} ${v1.rows.length === 1 ? v1.rows[0].status : "NOT FOUND"}`);
    console.log(`  Tasks:       ${tasksOk ? "✅" : "❌"} ${v2.rows.length}/12 done`);
    console.log(`  Duplicates:  ${noDupes ? "✅" : "❌"} ${v3.rows.length} found`);
    console.log(`  Linkage:     ${allLinkedOk ? "✅" : "❌"}`);
    console.log(`  Completion:  ${pctOk ? "✅" : "❌"} ${s.completion_pct}%`);
    console.log("═".repeat(60));

    if (milestoneOk && tasksOk && noDupes && allLinkedOk && pctOk) {
      console.log("\n🎉 Sprint 10 is fully synced and closed at 100%!");
    } else {
      console.log("\n⚠️  Some checks failed — review the output above.");
    }
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