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

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

async function listAllEvents(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('events').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listEventsByCreatedAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('events');
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
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

async function listNotificationDeliveriesBySentAtRange(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const fromAt = toDate(options.fromAt);
  const toAt = toDate(options.toAt);
  const db = getDb();
  let query = db.collection('notification_deliveries');
  if (fromAt) query = query.where('sentAt', '>=', fromAt);
  if (toAt) query = query.where('sentAt', '<=', toAt);
  const snap = await query.orderBy('sentAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllNotifications(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveLimit(options.limit);
  const db = getDb();
  const snap = await db.collection('notifications').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

module.exports = {
  listAllEvents,
  listEventsByCreatedAtRange,
  listAllUsers,
  listAllChecklists,
  listAllUserChecklists,
  listAllNotificationDeliveries,
  listNotificationDeliveriesBySentAtRange,
  listAllNotifications
};
