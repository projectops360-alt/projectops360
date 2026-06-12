/**
 * Phase 0 DB Sync — Idempotent upsert of all 18 Phase 0 tasks to Supabase
 *
 * Usage: node scripts/sync-phase0.js
 *
 * Reads DATABASE_URL from .env.local
 * Safe to re-run: uses ON CONFLICT upserts for idempotency.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const ORG_ID = "4f00f16b-96d8-4fd6-9375-20e2b11564a6";
const PROJECT_ID = "a30e3eb9-528e-46ce-b6d6-9ed80086b936";
const EXPECTED_TASKS = 18;

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

    // ── STEP 1: Run seed sync ──────────────────────────────────────────────
    console.log("\n📋 STEP 1: Running Phase 0 seed sync...");
    const seedPath = path.resolve(__dirname, "../supabase/seed_phase0_sync.sql");
    const seedSQL = fs.readFileSync(seedPath, "utf8");

    // Remove comment-only lines and execute as a single transaction
    await client.query("BEGIN");

    try {
      const seedStatements = seedSQL
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let inserted = 0;
      let updated = 0;

      for (const stmt of seedStatements) {
        const result = await client.query(stmt);
        // Track upsert outcomes for task inserts
        if (stmt.includes("ON CONFLICT") && stmt.includes("roadmap_tasks")) {
          // pg result doesn't easily distinguish insert vs update with ON CONFLICT
          // We'll verify counts separately
        }
      }

      await client.query("COMMIT");
      console.log("✅ Seed data applied successfully");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    // ── STEP 2: Verification ────────────────────────────────────────────────
    console.log("\n📋 STEP 2: Verification...\n");

    // V1: Milestone
    const v1 = await client.query(`
      SELECT id, title, status
      FROM public.milestones
      WHERE organization_id = '${ORG_ID}'
        AND project_id     = '${PROJECT_ID}'
        AND title          = 'Phase 0 — Foundation & Setup'
        AND deleted_at IS NULL;
    `);
    console.log("V1 — Phase 0 Milestone:");
    if (v1.rows.length === 0) {
      console.log("  ❌ NOT FOUND");
    } else {
      const m = v1.rows[0];
      console.log(`  ✓ Title: ${m.title}`);
      console.log(`  ✓ Status: ${m.status}`);
    }

    // V2: Tasks
    const v2 = await client.query(`
      SELECT external_key, title, status, priority, sprint_name, estimate_hours, completed_at, progress
      FROM public.roadmap_tasks
      WHERE organization_id = '${ORG_ID}'
        AND project_id     = '${PROJECT_ID}'
        AND external_key   LIKE '0.%'
        AND deleted_at IS NULL
      ORDER BY order_index;
    `);
    console.log("\nV2 — Phase 0 Tasks:");
    for (const t of v2.rows) {
      const completed = t.completed_at ? "✓" : "✗";
      console.log(`  ${completed} ${t.external_key.padEnd(4)} | ${t.status.padEnd(12)} | ${t.priority} | ${t.sprint_name.padEnd(8)} | ${t.estimate_hours}h | ${t.progress}% | ${t.title}`);
    }
    console.log(`  Total: ${v2.rows.length}/${EXPECTED_TASKS}`);

    // V3: Duplicates
    const v3 = await client.query(`
      SELECT external_key, COUNT(*) AS cnt
      FROM public.roadmap_tasks
      WHERE organization_id = '${ORG_ID}'
        AND project_id     = '${PROJECT_ID}'
        AND external_key   LIKE '0.%'
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

    // V4: Milestone linkage
    const v4 = await client.query(`
      SELECT rt.external_key, rt.title, m.title AS milestone_title
      FROM public.roadmap_tasks rt
      JOIN public.milestones m ON rt.milestone_id = m.id
      WHERE rt.organization_id = '${ORG_ID}'
        AND rt.project_id     = '${PROJECT_ID}'
        AND rt.external_key   LIKE '0.%'
        AND rt.deleted_at IS NULL
      ORDER BY rt.order_index;
    `);
    console.log("\nV4 — Task → Milestone linkage:");
    const allLinked = v4.rows.every((r) => r.milestone_title === "Phase 0 — Foundation & Setup");
    console.log(`  ${allLinked ? "✓" : "❌"} All ${v4.rows.length} tasks linked to Phase 0 milestone`);

    // V5: Dependencies
    const v5 = await client.query(`
      SELECT COUNT(*) AS dep_count
      FROM public.task_dependencies
      WHERE organization_id = '${ORG_ID}'
        AND project_id     = '${PROJECT_ID}';
    `);
    console.log("\nV5 — Task dependencies:");
    console.log(`  ✓ ${v5.rows[0].dep_count} dependency edges exist`);

    // V6: Summary
    const v6 = await client.query(`
      SELECT
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'done') AS done_tasks,
        COUNT(*) FILTER (WHERE status = 'not_started') AS pending_tasks,
        COALESCE(SUM(estimate_hours), 0)::numeric(6,2) AS total_estimate_hours,
        ROUND(AVG(progress)::numeric, 1) AS avg_progress
      FROM public.roadmap_tasks
      WHERE organization_id = '${ORG_ID}'
        AND project_id     = '${PROJECT_ID}'
        AND external_key   LIKE '0.%'
        AND deleted_at IS NULL;
    `);
    console.log("\nV6 — Phase 0 Summary:");
    const s = v6.rows[0];
    console.log(`  Tasks:    ${s.done_tasks}/${s.total_tasks} done, ${s.pending_tasks} pending`);
    console.log(`  Hours:    ${s.total_estimate_hours}`);
    console.log(`  Progress: ${s.avg_progress}%`);

    // ── Final verdict ─────────────────────────────────────────────────────
    const milestoneOk = v1.rows.length === 1;
    const tasksOk = v2.rows.length === EXPECTED_TASKS;
    const noDupes = v3.rows.length === 0;
    const allLinkedOk = allLinked;

    console.log("\n" + "═".repeat(60));
    console.log("🏁 PHASE 0 SYNC VERDICT");
    console.log("═".repeat(60));
    console.log(`  Milestone:   ${milestoneOk ? "✅" : "❌"} ${v1.rows.length === 1 ? v1.rows[0].status : "NOT FOUND"}`);
    console.log(`  Tasks:       ${tasksOk ? "✅" : "❌"} ${v2.rows.length}/${EXPECTED_TASKS}`);
    console.log(`  Duplicates:  ${noDupes ? "✅" : "❌"} ${v3.rows.length} found`);
    console.log(`  Linkage:     ${allLinkedOk ? "✅" : "❌"}`);
    console.log(`  Done:        ${Number(s.done_tasks)} tasks`);
    console.log(`  Pending:     ${Number(s.pending_tasks)} tasks`);
    console.log("═".repeat(60));

    if (milestoneOk && tasksOk && noDupes && allLinkedOk) {
      console.log("\n🎉 Phase 0 is fully synced!");
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