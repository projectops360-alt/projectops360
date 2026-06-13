// Un-archives the demo project (and any historically archived children) so it
// can be opened again. Scoped to one project id + org. Safe / idempotent.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const POOLER_HOST = 'aws-1-us-west-2.pooler.supabase.com';
const PROJECT_REF = 'ocopmlnkvidvmxgiwvxw';
const PROJECT_ID = 'de300000-0000-4000-8000-000000000001';
const ORG_ID = '4f00f16b-96d8-4fd6-9375-20e2b11564a6';
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const c = new Client({ host: POOLER_HOST, port: 5432, user: `postgres.${PROJECT_REF}`, password: decodeURIComponent(url.password), database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  const proj = await c.query(`update projects set deleted_at = null where id=$1 and organization_id=$2 returning id`, [PROJECT_ID, ORG_ID]);
  console.log('project un-archived rows:', proj.rowCount);
  const childTables = ['roadmap_tasks','milestones','risks','material_requirements','rfis','budget_items','decisions','resources'];
  for (const t of childTables) {
    const r = await c.query(`update ${t} set deleted_at = null where project_id=$1 and organization_id=$2 and deleted_at is not null returning id`, [PROJECT_ID, ORG_ID]);
    console.log(`  ${t}: restored ${r.rowCount}`);
  }
  await c.end();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
