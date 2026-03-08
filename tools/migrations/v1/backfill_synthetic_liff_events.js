'use strict';

const { getDb, serverTimestamp } = require('../../../src/infra/firestore');

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const db = getDb();
  const snap = await db.collection('events').where('type', '==', 'liff.synthetic_event').limit(1000).get();
  let copied = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    if (!dryRun) {
      // eslint-disable-next-line no-await-in-loop
      await db.collection('liff_synthetic_events').doc(doc.id).set(Object.assign({}, row, {
        copiedAt: serverTimestamp()
      }), { merge: true });
    }
    copied += 1;
  }
  console.log(JSON.stringify({ ok: true, dryRun, scanned: snap.size, copied }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
