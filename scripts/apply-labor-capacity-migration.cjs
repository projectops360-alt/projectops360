require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected');

  // Apply migration
  const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', '20260628000000_create_labor_capacity.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration applied');

  // Verify table exists
  const { rows } = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'labor_weekly_capacity' ORDER BY ordinal_position`
  );
  console.log('Columns:', rows.map(r => `${r.column_name}(${r.data_type})`).join(', '));

  await client.end();
}

main().catch(e => { console.error(e.message, e.detail); process.exit(1); });