require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const projectId = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936';

  // Find duplicate Phase 0 tasks: those with external_key = NULL whose title
  // matches a task with an external_key starting with "0."
  const { rows: dupes } = await client.query(`
    SELECT
      null_ext.id AS null_id,
      null_ext.title AS null_title,
      null_ext.external_key AS null_ext_key,
      with_ext.id AS ext_id,
      with_ext.external_key AS ext_key,
      with_ext.title AS ext_title
    FROM roadmap_tasks null_ext
    JOIN roadmap_tasks with_ext
      ON null_ext.project_id = with_ext.project_id
      AND null_ext.organization_id = with_ext.organization_id
      AND null_ext.deleted_at IS NULL
      AND with_ext.deleted_at IS NULL
      AND null_ext.external_key IS NULL
      AND with_ext.external_key IS NOT NULL
      AND with_ext.external_key LIKE '0.%'
      WHERE null_ext.project_id = $1
      AND LOWER(REGEXP_REPLACE(null_ext.title, '^[0-9.]+\\s*[-—]+\\s*', ''))
        = LOWER(REGEXP_REPLACE(with_ext.title, '^[0-9.]+\\s*[-—]+\\s*', ''))
  `, [projectId]);

  console.log(`Found ${dupes.length} duplicates to soft-delete:`);
  dupes.forEach(d => console.log(`  NULL id=${d.null_id.substring(0,8)}... "${d.null_title}"  <->  ext=${d.ext_key} id=${d.ext_id.substring(0,8)}... "${d.ext_title}"`));

  if (dupes.length === 0) {
    console.log('No duplicates found. Exiting.');
    await client.end();
    return;
  }

  // Soft-delete the duplicates (the ones with NULL external_key)
  const idsToDelete = dupes.map(d => d.null_id);
  const { rowCount } = await client.query(`
    UPDATE roadmap_tasks
    SET deleted_at = NOW()
    WHERE id = ANY($1)
  `, [idsToDelete]);

  console.log(`\nSoft-deleted ${rowCount} duplicate tasks.`);

  // Also check for orphan dependencies referencing deleted tasks
  const { rows: orphDeps } = await client.query(`
    SELECT COUNT(*) as count FROM task_dependencies
    WHERE (task_id = ANY($1) OR depends_on_task_id = ANY($1))
      AND deleted_at IS NULL
  `, [idsToDelete]);
  console.log(`Dependencies referencing soft-deleted tasks: ${orphDeps[0].count}`);

  if (Number(orphDeps[0].count) > 0) {
    const { rowCount: depDeleted } = await client.query(`
      UPDATE task_dependencies
      SET deleted_at = NOW()
      WHERE (task_id = ANY($1) OR depends_on_task_id = ANY($1))
        AND deleted_at IS NULL
    `, [idsToDelete]);
    console.log(`Soft-deleted ${depDeleted} orphan dependencies.`);
  }

  // Verify
  const { rows: byStatus } = await client.query(
    `SELECT status, COUNT(*) as count FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL GROUP BY status ORDER BY count DESC`,
    [projectId]
  );
  console.log('\n=== Remaining tasks by status ===');
  byStatus.forEach(r => console.log(`  ${r.status}: ${r.count}`));

  const { rows: total } = await client.query(
    `SELECT COUNT(*) as count FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  console.log(`Total: ${total[0].count}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });