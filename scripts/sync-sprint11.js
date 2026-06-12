/**
 * Sprint 11 — Seed AI-Assisted Execution Controls data into Supabase
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

    console.log("\n📋 Seeding Sprint 11 data...");
    const seedPath = path.resolve(__dirname, "../supabase/seed_sprint11_sync.sql");
    const seedSQL = fs.readFileSync(seedPath, "utf8");

    await client.query(seedSQL);
    console.log("✅ Sprint 11 data seeded");

    // Verify
    console.log("\n📊 Verification:");
    const { rows: mRows } = await client.query(`
      SELECT title, status, progress_percent
      FROM public.milestones
      WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
        AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND title LIKE '%Sprint 11%'
        AND deleted_at IS NULL;
    `);
    console.log("Milestone:", mRows);

    const { rows: tRows } = await client.query(`
      SELECT external_key, title, status, priority
      FROM public.roadmap_tasks
      WHERE project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
        AND external_key LIKE '4.%'
        AND deleted_at IS NULL
      ORDER BY order_index;
    `);
    console.log("Tasks:", tRows.length, "rows");
    for (const t of tRows) {
      console.log(`  ${t.external_key} | ${t.status.padEnd(15)} | ${t.priority} | ${t.title}`);
    }

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();