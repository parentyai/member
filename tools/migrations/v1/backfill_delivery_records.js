'use strict';

const { getDb, serverTimestamp } = require('../../../src/infra/firestore');

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const db = getDb();
  const snap = await db.collection('notification_deliveries').limit(1000).get();
  let created = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    const traceId = row.traceId || `delivery_${doc.id}`;
    if (!dryRun) {
      // eslint-disable-next-line no-await-in-loop
      await db.collection('delivery_records').doc(doc.id).set({
        traceId,
        source: 'notification_deliveries',
        state: row.status || 'completed',
        lineUserId: row.lineUserId || null,
        createdAt: row.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    created += 1;
  }
  console.log(JSON.stringify({ ok: true, dryRun, scanned: snap.size, created }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
