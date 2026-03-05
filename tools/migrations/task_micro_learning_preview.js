'use strict';

const { getDb } = require('../../src/infra/firestore');
const { generateTaskSummary } = require('../../src/usecases/tasks/generateTaskSummary');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  return {
    limit: Math.max(1, Math.min(500, Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 100)))
  };
}

async function run() {
  const options = parseArgs(process.argv);
  const db = getDb();
  const snap = await db.collection('task_contents').orderBy('updatedAt', 'desc').limit(options.limit).get();
  const items = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const preview = items.map((row) => {
    const generated = generateTaskSummary({ taskContent: row.data, task: {} });
    return {
      taskKey: row.id,
      existing: {
        summaryShort: Array.isArray(row.data.summaryShort) ? row.data.summaryShort.length : 0,
        topMistakes: Array.isArray(row.data.topMistakes) ? row.data.topMistakes.length : 0,
        contextTips: Array.isArray(row.data.contextTips) ? row.data.contextTips.length : 0
      },
      generated
    };
  });
  console.log(JSON.stringify({
    ok: true,
    mode: 'dry-run',
    total: items.length,
    preview: preview.slice(0, 30)
  }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'error' }));
  process.exitCode = 1;
});
