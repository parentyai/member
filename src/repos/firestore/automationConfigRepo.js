'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'automation_config';
const MODES = new Set(['OFF', 'DRY_RUN_ONLY', 'EXECUTE']);

function resolveTimestamp() {
  return serverTimestamp();
}

async function appendAutomationConfig(data) {
  const payload = data || {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: resolveTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function getLatestAutomationConfig() {
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

module.exports = {
  appendAutomationConfig,
  getLatestAutomationConfig,
  async listAutomationConfigs(limit) {
    const db = getDb();
    let query = db.collection(COLLECTION).orderBy('createdAt', 'desc');
    const cap = typeof limit === 'number' ? limit : 20;
    if (cap) query = query.limit(cap);
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  },
  async upsertAutomationConfig(data) {
    const payload = data || {};
    const db = getDb();
    const docRef = db.collection(COLLECTION).doc();
    const record = Object.assign({}, payload, { updatedAt: resolveTimestamp(), createdAt: resolveTimestamp() });
    await docRef.set(record, { merge: false });
    return { id: docRef.id };
  },
  normalizePhase48Config(record) {
    const config = record || {};
    const rawMode = typeof config.mode === 'string' ? config.mode.toUpperCase() : null;
    const mode = MODES.has(rawMode) ? rawMode : (config.enabled ? 'EXECUTE' : 'OFF');
    return {
      enabled: mode !== 'OFF',
      mode,
      allowScenarios: Array.isArray(config.allowScenarios) ? config.allowScenarios : [],
      allowSteps: Array.isArray(config.allowSteps) ? config.allowSteps : [],
      allowNextActions: Array.isArray(config.allowNextActions)
        ? config.allowNextActions
        : (Array.isArray(config.allowedActions) ? config.allowedActions : []),
      updatedAt: config.updatedAt || config.createdAt || null
    };
  }
};
