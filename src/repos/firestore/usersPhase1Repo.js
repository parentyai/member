'use strict';

const { getDb } = require('../../infra/firestore');

const COLLECTION = 'users';

async function listUsersByScenario(scenario, limit) {
  if (!scenario) throw new Error('scenario required');
  const db = getDb();
  let query = db.collection(COLLECTION).where('scenario', '==', scenario).orderBy('createdAt', 'desc');
  const max = typeof limit === 'number' ? limit : 500;
  if (max) query = query.limit(max);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  listUsersByScenario
};
