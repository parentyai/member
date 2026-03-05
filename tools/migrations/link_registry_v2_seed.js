'use strict';

const { getDb, serverTimestamp } = require('../../src/infra/firestore');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  return {
    apply: args.includes('--apply'),
    limit: Math.max(1, Math.min(1000, Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 200)))
  };
}

function normalizePatch(item) {
  const row = item && typeof item === 'object' ? item : {};
  return {
    intentTag: row.intentTag || null,
    audienceTag: row.audienceTag || null,
    regionScope: row.regionScope || null,
    riskLevel: row.riskLevel || null
  };
}

async function run() {
  const options = parseArgs(process.argv);
  const db = getDb();
  const snap = await db.collection('link_registry').orderBy('createdAt', 'desc').limit(options.limit).get();
  const items = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const candidates = items.map((row) => ({
    id: row.id,
    patch: normalizePatch(row.data)
  }));
  const summary = {
    total: items.length,
    candidateCount: candidates.length,
    apply: options.apply
  };
  if (!options.apply) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', summary, candidates: candidates.slice(0, 20) }, null, 2));
    return;
  }
  for (const row of candidates) {
    // eslint-disable-next-line no-await-in-loop
    await db.collection('link_registry').doc(row.id).set(Object.assign({}, row.patch, {
      updatedAt: serverTimestamp()
    }), { merge: true });
  }
  console.log(JSON.stringify({ ok: true, mode: 'apply', summary }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'error' }));
  process.exitCode = 1;
});
