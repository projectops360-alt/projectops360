require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const projectId = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936';

  // Find tasks with null external_key
  const { rows: nullExt } = await client.query(
    `SELECT id, external_key, title, status FROM roadmap_tasks WHERE project_id = $1 AND external_key IS NULL AND deleted_at IS NULL ORDER BY title`,
    [projectId]
  );
  console.log(`=== Tasks with NULL external_key (${nullExt.length}) ===`);
  nullExt.forEach(t => console.log(`  id=${t.id.substring(0,8)}... | ${t.title.substring(0, 60)}`));

  // Find tasks with external_key that look like Phase 0
  const { rows: phase0 } = await client.query(
    `SELECT id, external_key, title, status FROM roadmap_tasks WHERE project_id = $1 AND external_key LIKE '0.%' AND deleted_at IS NULL ORDER BY external_key`,
    [projectId]
  );
  console.log(`\n=== Phase 0 tasks with external_key (${phase0.length}) ===`);
  phase0.forEach(t => console.log(`  ext=${t.external_key} | id=${t.id.substring(0,8)}... | ${t.title.substring(0, 50)}`));

  // Check if titles match between null-ext and phase0 tasks
  console.log('\n=== Potential duplicates (same title, different external_key) ===');
  const allTasks = [...nullExt, ...phase0];
  const titleMap = new Map();
  for (const t of allTasks) {
    const normalized = t.title.replace(/^[0-9.]+\s*[-—]\s*/, '').trim().toLowerCase();
    if (titleMap.has(normalized)) {
      titleMap.get(normalized).push(t);
    } else {
      titleMap.set(normalized, [t]);
    }
  }
  for (const [title, tasks] of titleMap) {
    if (tasks.length > 1) {
      console.log(`  "${title.substring(0, 50)}" appears ${tasks.length} times:`);
      tasks.forEach(t => console.log(`    ext_key=${t.external_key} | id=${t.id.substring(0,8)}...`));
    }
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });