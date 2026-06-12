#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// Seed script: DCL-006 Compute Labor Capacity
// Reads DATABASE_URL from .env.local
// Usage: node scripts/seed-dc-labor-capacity.js
// ═══════════════════════════════════════════════════════════════════════════════

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) { console.error('.env.local not found'); process.exit(1); }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnv();
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('✓ Connected');

    // Run seed SQL
    const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'seed_dc_labor_capacity.sql'), 'utf8');
    await client.query(sql);
    console.log('✓ Seed SQL executed');

    const projectId = 'dc100000-0000-4000-8000-000000000000';

    // Total rows
    const { rows: total } = await client.query(
      `SELECT count(*)::int as count FROM labor_weekly_capacity WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    console.log(`✓ Total capacity rows: ${total[0].count}`);

    // By shortage_risk
    const { rows: byRisk } = await client.query(
      `SELECT shortage_risk, count(*)::int as count FROM labor_weekly_capacity WHERE project_id = $1 AND deleted_at IS NULL GROUP BY shortage_risk ORDER BY count DESC`,
      [projectId]
    );
    console.log('\n── Shortage Risk Distribution ──');
    byRisk.forEach(r => console.log(`  ${r.shortage_risk}: ${r.count}`));

    // Sample data by trade
    const { rows: byTrade } = await client.query(
      `SELECT trade_key, count(*)::int as weeks, sum(required_headcount)::int as total_req, sum(available_headcount)::int as total_avail
       FROM labor_weekly_capacity WHERE project_id = $1 AND deleted_at IS NULL
       GROUP BY trade_key ORDER BY trade_key`,
      [projectId]
    );
    console.log('\n── By Trade ──');
    byTrade.forEach(r => console.log(`  ${r.trade_key}: ${r.weeks} weeks, req=${r.total_req}, avail=${r.total_avail}`));

    // Critical path impact
    const { rows: critical } = await client.query(
      `SELECT trade_key, week_label, required_headcount, available_headcount, gap_headcount, shortage_risk
       FROM labor_weekly_capacity
       WHERE project_id = $1 AND deleted_at IS NULL AND critical_path_impact = true
       ORDER BY week_label, trade_key`,
      [projectId]
    );
    console.log('\n── Critical Path Impact ──');
    critical.forEach(r => console.log(`  ${r.week_label} ${r.trade_key}: req=${r.required_headcount} avail=${r.available_headcount} gap=${r.gap_headcount} [${r.shortage_risk}]`));

    // DCL-006 status
    const { rows: task } = await client.query(
      `SELECT status, progress FROM roadmap_tasks WHERE project_id = $1 AND external_key = 'DCL-006' AND deleted_at IS NULL`,
      [projectId]
    );
    console.log(`\n✓ DCL-006: ${task[0]?.status}, ${task[0]?.progress}%`);

    await client.end();
  } catch (err) {
    console.error('✗ Error:', err.message);
    if (err.detail) console.error('  Detail:', err.detail);
    if (err.where) console.error('  Where:', err.where);
    process.exit(1);
  }
}

main();