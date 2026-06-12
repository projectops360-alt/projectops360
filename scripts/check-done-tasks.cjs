require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const projectId = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936';

  // Tasks by status
  const { rows: byStatus } = await client.query(
    `SELECT status, COUNT(*) as count FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL GROUP BY status ORDER BY count DESC`,
    [projectId]
  );
  console.log('=== Tasks by status ===');
  byStatus.forEach(r => console.log(`  ${r.status}: ${r.count}`));

  // Done tasks
  const { rows: doneTasks } = await client.query(
    `SELECT id, external_key, title, status FROM roadmap_tasks WHERE project_id = $1 AND status = 'done' AND deleted_at IS NULL ORDER BY external_key`,
    [projectId]
  );
  console.log(`\n=== Done tasks (${doneTasks.length}) ===`);
  doneTasks.forEach(t => console.log(`  ${t.external_key} | ${t.title.substring(0, 60)}`));

  // Total
  const { rows: total } = await client.query(
    `SELECT COUNT(*) as count FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  console.log(`\nTotal tasks: ${total[0].count}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });