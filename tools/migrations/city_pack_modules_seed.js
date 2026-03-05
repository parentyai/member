'use strict';

const { getDb, serverTimestamp } = require('../../src/infra/firestore');
const { normalizeModules } = require('../../src/repos/firestore/cityPacksRepo');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const modulesArg = args.find((arg) => arg.startsWith('--modules='));
  const modules = modulesArg
    ? modulesArg.split('=')[1].split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  return {
    apply: args.includes('--apply'),
    limit: Math.max(1, Math.min(500, Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 200))),
    modules: normalizeModules(modules)
  };
}

async function run() {
  const options = parseArgs(process.argv);
  const db = getDb();
  const snap = await db.collection('city_packs').orderBy('updatedAt', 'desc').limit(options.limit).get();
  const items = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const candidates = items.map((row) => {
    const existing = normalizeModules(row.data.modules);
    const merged = normalizeModules(existing.concat(options.modules));
    return {
      id: row.id,
      existingModules: existing,
      mergedModules: merged
    };
  });
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
    await db.collection('city_packs').doc(row.id).set({
      modules: row.mergedModules,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  console.log(JSON.stringify({ ok: true, mode: 'apply', summary }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'error' }));
  process.exitCode = 1;
});
