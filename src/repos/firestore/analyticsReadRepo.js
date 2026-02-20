'use strict';

const { getDb } = require('../../infra/firestore');

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

function resolveLimit(value) {
  if (value === undefined || value === null) return DEFAULT_LIMIT;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(num), MAX_LIMIT);
}

async function listAllEvents(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('events').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllUsers(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllChecklists(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('checklists').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllUserChecklists(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('user_checklists').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllNotificationDeliveries(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('notification_deliveries').orderBy('sentAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

module.exports = {
  listAllEvents,
  listAllUsers,
  listAllChecklists,
  listAllUserChecklists,
  listAllNotificationDeliveries
};
