require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  // List all projects
  const { rows: projects } = await client.query(
    `SELECT id, slug, title_i18n, organization_id, deleted_at FROM projects WHERE deleted_at IS NULL ORDER BY created_at`
  );
  console.log('=== All active projects ===');
  for (const p of projects) {
    const { rows: taskCount } = await client.query(
      `SELECT status, COUNT(*) as count FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL GROUP BY status ORDER BY count DESC`,
      [p.id]
    );
    const statusStr = taskCount.map(r => `${r.status}=${r.count}`).join(', ');
    const title = p.title_i18n && typeof p.title_i18n === 'object' ? (p.title_i18n.en || p.title_i18n.es || JSON.stringify(p.title_i18n)) : p.title_i18n;
    console.log(`  id=${p.id} | slug=${p.slug} | title=${title}`);
    console.log(`    tasks: ${statusStr || 'none'}`);
  }

  // Check the specific project the user is viewing
  const dcProjectId = 'dc100000-0000-4000-8000-000000000000';
  const { rows: dcTasks } = await client.query(
    `SELECT id, title, status, external_key FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL ORDER BY status, order_index`,
    [dcProjectId]
  );
  console.log(`\n=== Tasks in dc100000 project (${dcTasks.length}) ===`);
  dcTasks.forEach(t => console.log(`  ${t.status} | ext=${t.external_key} | ${t.title.substring(0, 50)}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });