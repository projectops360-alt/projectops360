require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PID = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936';

// Task title map for readable references
const TASK_TITLES = {
  'PI-001': 'Define Living Graph Data Model',
  'PI-002': 'Create Living Graph Supabase Migration',
  'PI-003': 'Build Process Event Ingestion Pipeline',
  'PI-004': 'Implement Graph Traversal & Query API',
  'PI-005': 'Build Living Graph Visualization Component',
  'PI-006': 'Design Process Interpretation Architecture',
  'PI-007': 'Implement Process Timeline Reconstruction',
  'PI-008': 'Build Behavior Pattern Detection',
  'PI-009': 'Create Process Interpretation API & UI Panel',
  'PI-010': 'Implement Bottleneck Detection Algorithm',
  'PI-011': 'Build Bottleneck Visualization & Highlighting',
  'PI-012': 'Create Bottleneck Alerting & Recommendations',
  'PI-013': 'Implement SOP Opportunity Detection',
  'PI-014': 'Build SOP Draft Generation Service',
  'PI-015': 'Design Retrospective Data Model & Triggers',
  'PI-016': 'Implement AI Retrospective Generation',
  'PI-017': 'Build Retrospective UI & Export',
  'PI-018': 'Implement Improvement Backlog Item Creation',
  'PI-019': 'Build Improvement Backlog UI & Roadmap Integration',
  'PI-020': 'Design Insight-to-Action Approval Workflow',
  'PI-021': 'Implement Action Generation from Process Insights',
  'PI-022': 'Build Insight-to-Action UI with Approval Flow',
};

async function update() {
  console.log('🔄 Updating prompt_body with dependency context...\n');

  // Fetch tasks and dependencies
  const { data: tasks } = await sb.from('roadmap_tasks')
    .select('id, external_key, title, status, prompt_body, prompt_context')
    .eq('project_id', PID).like('external_key', 'PI-%').is('deleted_at', null).order('order_index');

  const { data: deps } = await sb.from('task_dependencies')
    .select('predecessor:roadmap_tasks!task_dependencies_predecessor_id_fkey(external_key,title),successor:roadmap_tasks!task_dependencies_successor_id_fkey(external_key,title)')
    .eq('project_id', PID);

  // Build maps
  const predecessors = {};
  const successors = {};
  const taskMap = {};
  for (const t of tasks) taskMap[t.external_key] = t;
  for (const d of deps) {
    const pred = d.predecessor.external_key;
    const succ = d.successor.external_key;
    if (!predecessors[succ]) predecessors[succ] = [];
    if (!successors[pred]) successors[pred] = [];
    predecessors[succ].push(pred);
    successors[pred].push(succ);
  }

  // Update each task
  for (const task of tasks) {
    const key = task.external_key;
    const preds = predecessors[key] || [];
    const succs = successors[key] || [];

    // Build PREREQUISITES section
    let prereqSection = '';
    if (preds.length > 0) {
      const predLines = preds.map(p => `- ${p}: ${TASK_TITLES[p] || taskMap[p]?.title || p}`).join('\n');
      prereqSection = `PRERREQUISITOS (deben estar completados antes):\n${predLines}\n\n`;
    } else {
      prereqSection = `PRERREQUISITOS: Ninguno — esta es la primera tarea del sprint.\n\n`;
    }

    // Build NEXT STEPS section
    let nextSection = '';
    if (succs.length > 0) {
      const succLines = succs.map(s => `- ${s}: ${TASK_TITLES[s] || taskMap[s]?.title || s}`).join('\n');
      nextSection = `\n\nDESPUÉS DE ESTA TAREA, ejecutar:\n${succLines}`;
    }

    // Prepend PREREQUISITES and append NEXT STEPS to prompt_body
    const newPromptBody = prereqSection + task.prompt_body + nextSection;

    // Update prompt_context to show execution position
    const position = preds.length === 0
      ? 'START — Primera tarea, sin prerrequisitos'
      : `After ${preds.join(', ')}`;
    const nextContext = succs.length > 0
      ? `Next: ${succs.join(', ')}`
      : 'END — Última tarea en esta cadena';
    const newPromptContext = `${position} → ${key} → ${nextContext}`;

    // Update in Supabase
    const { error } = await sb.from('roadmap_tasks')
      .update({
        prompt_body: newPromptBody,
        prompt_context: newPromptContext,
      })
      .eq('id', task.id);

    if (error) {
      console.error(`❌ ${key} error:`, error.message);
    } else {
      console.log(`✅ ${key} | ${newPromptContext}`);
    }
  }

  console.log('\n✨ All prompts updated with dependency context!');
}

update().catch(e => { console.error('Fatal:', e); process.exit(1); });