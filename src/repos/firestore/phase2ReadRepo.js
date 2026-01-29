'use strict';

const { getDb } = require('../../infra/firestore');

async function listAllEvents() {
  const db = getDb();
  const snap = await db.collection('events').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllUsers() {
  const db = getDb();
  const snap = await db.collection('users').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllChecklists() {
  const db = getDb();
  const snap = await db.collection('checklists').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function listAllUserChecklists() {
  const db = getDb();
  const snap = await db.collection('user_checklists').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

module.exports = {
  listAllEvents,
  listAllUsers,
  listAllChecklists,
  listAllUserChecklists
};
