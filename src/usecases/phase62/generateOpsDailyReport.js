'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { listOpsConsole } = require('../phase26/listOpsConsole');

const COLLECTION = 'ops_daily_reports';
const MAX_ITEMS = 200;
const TOP_READY_LIMIT = 10;

function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDate(dateStr, now) {
  if (!dateStr) return formatDateUTC(now || new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) throw new Error('invalid date');
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('invalid date');
  return dateStr;
}

async function generateOpsDailyReport(params, deps) {
  const payload = params || {};
  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const date = resolveDate(payload.date, now);
  const listFn = deps && deps.listOpsConsole ? deps.listOpsConsole : listOpsConsole;

  const list = await listFn({ status: 'ALL', limit: MAX_ITEMS }, deps);
  const items = Array.isArray(list.items) ? list.items : [];
  const readyItems = items.filter((item) => item.readiness && item.readiness.status === 'READY');
  const notReadyItems = items.filter((item) => !item.readiness || item.readiness.status !== 'READY');

  const counts = {
    ready: readyItems.length,
    notReady: notReadyItems.length,
    needsAttention: notReadyItems.length
  };

  const topReady = readyItems.slice(0, TOP_READY_LIMIT).map((item) => item.lineUserId);

  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(date);
  const record = {
    date,
    generatedAt: serverTimestamp(),
    counts,
    topReady
  };
  await docRef.set(record, { merge: true });

  return {
    ok: true,
    date,
    counts,
    topReady
  };
}

module.exports = {
  generateOpsDailyReport
};
