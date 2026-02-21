// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'phase22_kpi_snapshots';

async function upsertSnapshot(docId, record) {
  if (!docId) throw new Error('docId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(docId);
  const payload = Object.assign({}, record || {}, { createdAt: serverTimestamp() });
  await docRef.set(payload, { merge: true });
  return { id: docRef.id };
}

module.exports = {
  upsertSnapshot
};
