require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const sql = fs.readFileSync('supabase/migrations/20260626000000_create_living_graph.sql', 'utf8');

  // Extract function: find 'CREATE OR REPLACE FUNCTION' (not in a comment)
  const lines = sql.split('\n');
  let fnStartLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('CREATE OR REPLACE FUNCTION public.backfill_living_graph')) {
      fnStartLine = i;
      break;
    }
  }

  if (fnStartLine === -1) {
    throw new Error('Could not find function definition');
  }

  // Find the closing $$; — scan from fnStartLine forward
  let fnEndLine = -1;
  for (let i = fnStartLine + 1; i < lines.length; i++) {
    if (lines[i].trim() === '$$;') {
      fnEndLine = i;
      break;
    }
  }

  if (fnEndLine === -1) {
    throw new Error('Could not find closing $$;');
  }

  const fnSql = lines.slice(fnStartLine, fnEndLine + 1).join('\n');

  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // Drop existing function first (return type changed)
  console.log('Dropping old function...');
  await c.query('DROP FUNCTION IF EXISTS public.backfill_living_graph(uuid)');

  console.log('Creating new function...');
  await c.query(fnSql);
  console.log('Function created OK!');

  console.log('Running backfill_living_graph()...');
  const r = await c.query('SELECT * FROM backfill_living_graph()');
  console.log('Backfill result:', JSON.stringify(r.rows, null, 2));

  const nc = await c.query('SELECT node_type, count(*) FROM process_nodes GROUP BY node_type ORDER BY count(*) DESC');
  console.log('\nNodes by type:');
  nc.rows.forEach(row => console.log(`  ${row.node_type}: ${row.count}`));

  const ec = await c.query('SELECT edge_type, count(*) FROM process_edges GROUP BY edge_type ORDER BY count(*) DESC');
  console.log('\nEdges by type:');
  ec.rows.forEach(row => console.log(`  ${row.edge_type}: ${row.count}`));

  const total = await c.query('SELECT count(*) as nodes FROM process_nodes');
  console.log('\nTotal nodes:', total.rows[0].nodes);

  const totalE = await c.query('SELECT count(*) as edges FROM process_edges');
  console.log('Total edges:', totalE.rows[0].edges);

  await c.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });