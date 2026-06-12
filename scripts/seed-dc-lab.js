#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// Seed script: Data Center Labor Risk Intelligence Lab
// Reads DATABASE_URL from .env.local (never hardcoded)
// Usage: node scripts/seed-dc-lab.js
// ═══════════════════════════════════════════════════════════════════════════════

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found at', envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    process.env[key] = val;
  }
}

async function main() {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not set in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Connected to Supabase');

    const sqlPath = path.resolve(__dirname, '..', 'supabase', 'seed_dc_labor_risk_lab.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('✓ Seed SQL executed successfully');

    // ── Verification ──────────────────────────────────────────
    const projectId = 'dc100000-0000-4000-8000-000000000000';

    const proj = await client.query(
      'SELECT id, title_i18n, status, start_date, target_end_date FROM projects WHERE id = $1',
      [projectId]
    );
    if (proj.rows.length === 0) {
      console.error('✗ Project not found!');
    } else {
      console.log('\n✓ Project:', JSON.stringify(proj.rows[0], null, 2));
    }

    const miles = await client.query(
      'SELECT count(*)::int as count FROM milestones WHERE project_id = $1 AND deleted_at IS NULL',
      [projectId]
    );
    console.log('✓ Milestones:', miles.rows[0].count, '(expected: 5)');

    const tasks = await client.query(
      "SELECT count(*)::int as count FROM roadmap_tasks WHERE project_id = $1 AND external_key LIKE 'DCL-%' AND deleted_at IS NULL",
      [projectId]
    );
    console.log('✓ Tasks:', tasks.rows[0].count, '(expected: 25)');

    const deps = await client.query(
      'SELECT count(*)::int as count FROM task_dependencies WHERE project_id = $1',
      [projectId]
    );
    console.log('✓ Dependencies:', deps.rows[0].count, '(expected: 24)');

    // Show milestone details
    const mileDetails = await client.query(
      'SELECT title, status, start_date, target_date, progress_percent, order_index FROM milestones WHERE project_id = $1 AND deleted_at IS NULL ORDER BY order_index',
      [projectId]
    );
    console.log('\n── Milestone Details ──');
    mileDetails.rows.forEach((m) => {
      console.log(`  ${m.title} | ${m.status} | ${m.start_date} → ${m.target_date} | ${m.progress_percent}%`);
    });

    // Show task summary per milestone
    const taskSummary = await client.query(
      `SELECT m.title as milestone, count(t.id)::int as task_count, sum(t.estimate_hours)::numeric as total_hours
       FROM milestones m
       LEFT JOIN roadmap_tasks t ON t.milestone_id = m.id AND t.deleted_at IS NULL
       WHERE m.project_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.title, m.order_index
       ORDER BY m.order_index`,
      [projectId]
    );
    console.log('\n── Task Summary per Milestone ──');
    taskSummary.rows.forEach((r) => {
      console.log(`  ${r.milestone}: ${r.task_count} tasks, ${r.total_hours}h estimated`);
    });

    await client.end();
    console.log('\n✓ All done. DC Labor Risk Lab project seeded.');
  } catch (err) {
    console.error('✗ Error:', err.message);
    if (err.detail) console.error('  Detail:', err.detail);
    process.exit(1);
  }
}

main();