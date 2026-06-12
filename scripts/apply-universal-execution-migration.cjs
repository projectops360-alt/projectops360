// Applies a migration file to the remote database.
//   node scripts/apply-universal-execution-migration.cjs [migration-file.sql]
// Defaults to 20260708000000_universal_execution_model.sql.
// Uses the Supavisor session pooler (IPv4) because the direct db.<ref> host
// only publishes an IPv6 address.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const POOLER_HOST = 'aws-1-us-west-2.pooler.supabase.com';
const PROJECT_REF = 'ocopmlnkvidvmxgiwvxw';

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const client = new Client({
    host: POOLER_HOST,
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
    password: decodeURIComponent(url.password),
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected via session pooler');

  const migrationFile = process.argv[2] || '20260708000000_universal_execution_model.sql';
  const sql = fs.readFileSync(
    path.resolve(__dirname, '..', 'supabase', 'migrations', migrationFile),
    'utf8'
  );
  await client.query(sql);
  console.log(`Migration applied: ${migrationFile}`);

  if (migrationFile !== '20260708000000_universal_execution_model.sql') {
    await client.end();
    return;
  }

  // Verify new tables
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      'suppliers','resources','budget_items','cost_actuals','material_requirements',
      'procurement_items','risks','rfis','submittals','inspections','permits',
      'resource_assignments','critical_path_snapshots'
    ) ORDER BY table_name`);
  console.log(`New tables (${rows.length}/13):`, rows.map(r => r.table_name).join(', '));

  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name IN ('project_type','enabled_modules')`);
  console.log('projects columns:', cols.map(r => r.column_name).join(', '));

  const { rows: taskCols } = await client.query(`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roadmap_tasks'
      AND column_name IN ('assigned_to','assigned_resource_id','assignment_type','required_skills',
        'required_crew_size','estimated_labor_hours','location_zone','discipline','trade_key',
        'cost_code','budget_item_id','source_drawing_id','source_insight_id')`);
  console.log('roadmap_tasks new columns:', `${taskCols[0].n}/13`);

  const { rows: backfill } = await client.query(
    `SELECT count(*)::int AS n FROM public.resources WHERE legacy_labor_resource_id IS NOT NULL`
  );
  console.log('labor_resources backfilled into resources:', backfill[0].n);

  await client.end();
}

main().catch(e => { console.error('ERROR:', e.message, e.detail ?? ''); process.exit(1); });
