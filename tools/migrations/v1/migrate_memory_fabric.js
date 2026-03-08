'use strict';

const { getDb, serverTimestamp } = require('../../../src/infra/firestore');

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, Math.min(10000, Number(limitArg.split('=')[1]) || 500)) : 500;
  const db = getDb();
  const snap = await db.collection('user_context_snapshots').limit(limit).get();
  let migrated = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    const lineUserId = row.lineUserId || doc.id;
    const writes = [
      ['memory_task', { lane: 'task', data: row.tasks || [], lineUserId }],
      ['memory_session', { lane: 'session', data: { summary: row.summary || null, snapshotVersion: row.snapshotVersion || null }, lineUserId }],
      ['memory_profile', { lane: 'profile', data: row.profile || {}, lineUserId }],
      ['memory_compliance', { lane: 'compliance', data: row.compliance || {}, lineUserId }]
    ];
    if (!dryRun) {
      for (const [collection, payload] of writes) {
        // eslint-disable-next-line no-await-in-loop
        await db.collection(collection).doc(String(lineUserId)).set(Object.assign({}, payload, {
          updatedAt: serverTimestamp()
        }), { merge: true });
      }
    }
    migrated += 1;
  }
  console.log(JSON.stringify({ ok: true, dryRun, scanned: snap.size, migrated }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
