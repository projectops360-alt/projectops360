require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const projectId = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936';

  // Check distinct organization_ids for this project's tasks
  const { rows: orgIds } = await client.query(
    `SELECT organization_id, COUNT(*) as count FROM roadmap_tasks WHERE project_id = $1 AND deleted_at IS NULL GROUP BY organization_id`,
    [projectId]
  );
  console.log('=== organization_ids in roadmap_tasks ===');
  orgIds.forEach(r => console.log(`  org=${r.organization_id} | count=${r.count}`));

  // Check if there are tasks with wrong project_id but same titles
  const { rows: allOrgs } = await client.query(
    `SELECT organization_id, COUNT(*) as count FROM roadmap_tasks WHERE deleted_at IS NULL GROUP BY organization_id`
  );
  console.log('\n=== All organization_ids across all tasks ===');
  allOrgs.forEach(r => console.log(`  org=${r.organization_id} | count=${r.count}`));

  // Check the user's org membership
  const expectedOrgId = '4f00f16b-96d8-4fd6-9375-20e2b11564a6';
  const { rows: members } = await client.query(
    `SELECT user_id, role FROM organization_members WHERE organization_id = $1`,
    [expectedOrgId]
  );
  console.log(`\n=== Members of org ${expectedOrgId} ===`);
  members.forEach(m => console.log(`  user=${m.user_id} | role=${m.role}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });