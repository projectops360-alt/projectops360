#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// Seed script: DCL-005 Baseline Labor Risk Scenarios & Living Graph Links
// Reads DATABASE_URL from .env.local (never hardcoded)
// Usage: node scripts/seed-dc-risk-scenarios.js
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

    const sqlPath = path.resolve(__dirname, '..', 'supabase', 'seed_dc_labor_risk_scenarios.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓ Risk scenarios seed SQL executed successfully');

    // ── Verification ──────────────────────────────────────────
    const projectId = 'dc100000-0000-4000-8000-000000000000';

    // Risk documents
    const docs = await client.query(
      "SELECT count(*)::int as count FROM documents WHERE project_id = $1 AND file_type = 'risk-register' AND deleted_at IS NULL",
      [projectId]
    );
    console.log(`✓ Risk register documents: ${docs.rows[0].count} (expected: 8)`);

    // Blocker event nodes
    const blockers = await client.query(
      "SELECT count(*)::int as count FROM process_nodes WHERE project_id = $1 AND node_type = 'blocker_event' AND deleted_at IS NULL",
      [projectId]
    );
    console.log(`✓ Blocker event nodes: ${blockers.rows[0].count} (expected: 8)`);

    // Milestone gate nodes
    const gates = await client.query(
      "SELECT count(*)::int as count FROM process_nodes WHERE project_id = $1 AND node_type = 'milestone_gate' AND deleted_at IS NULL",
      [projectId]
    );
    console.log(`✓ Milestone gate nodes: ${gates.rows[0].count} (expected: 5)`);

    // Risk edges
    const edges = await client.query(
      "SELECT count(*)::int as count FROM process_edges WHERE project_id = $1 AND metadata->>'dcl_task' = 'DCL-005'",
      [projectId]
    );
    console.log(`✓ Risk scenario edges: ${edges.rows[0].count} (expected: 12)`);

    // DCL-005 task status
    const task = await client.query(
      "SELECT status, progress FROM roadmap_tasks WHERE project_id = $1 AND external_key = 'DCL-005' AND deleted_at IS NULL",
      [projectId]
    );
    if (task.rows.length === 0) {
      console.error('✗ DCL-005 task not found!');
    } else {
      console.log(`✓ DCL-005 status: ${task.rows[0].status}, progress: ${task.rows[0].progress}% (expected: implemented, 100%)`);
    }

    // Risk scenario details
    const riskDetails = await client.query(
      `SELECT title, (metadata->>'risk_scenario_key') as key, (metadata->>'severity') as severity
       FROM process_nodes
       WHERE project_id = $1 AND node_type = 'blocker_event' AND deleted_at IS NULL
       ORDER BY source_entity_id`,
      [projectId]
    );
    console.log('\n── Risk Scenarios ──');
    riskDetails.rows.forEach(r => {
      console.log(`  [${r.severity}] ${r.key}: ${r.title}`);
    });

    // Edge summary
    const edgeSummary = await client.query(
      `SELECT edge_type, count(*)::int as count
       FROM process_edges
       WHERE project_id = $1 AND metadata->>'dcl_task' = 'DCL-005'
       GROUP BY edge_type
       ORDER BY count DESC`,
      [projectId]
    );
    console.log('\n── Edge Types ──');
    edgeSummary.rows.forEach(r => {
      console.log(`  ${r.edge_type}: ${r.count}`);
    });

    await client.end();
    console.log('\n✓ All done. DCL-005 baseline risk scenarios seeded.');
  } catch (err) {
    console.error('✗ Error:', err.message);
    if (err.detail) console.error('  Detail:', err.detail);
    if (err.position) console.error('  Position:', err.position);
    process.exit(1);
  }
}

main();