// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'checklists';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveScenarioFilter(opts) {
  const data = opts || {};
  return {
    scenarioKey: normalizeString(data.scenarioKey),
    legacyScenario: normalizeString(data.scenario)
  };
}

async function listChecklistsByField({ scenario, step, limit }, fieldName) {
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (scenario) query = query.where(fieldName, '==', scenario);
  if (step) query = query.where('step', '==', step);
  query = query.orderBy('createdAt', 'desc');
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function createChecklist(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: serverTimestamp() });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function getChecklist(id) {
  if (!id) throw new Error('checklistId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listChecklists(params) {
  const opts = params || {};
  const step = normalizeString(opts.step);
  const { scenarioKey, legacyScenario } = resolveScenarioFilter(opts);
  const scenario = scenarioKey || legacyScenario;
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;

  let list = [];
  if (scenario) {
    list = await listChecklistsByField({ scenario, step, limit }, scenarioKey ? 'scenarioKey' : 'scenario');
    if (!list.length && scenarioKey && legacyScenario && legacyScenario !== scenario) {
      list = await listChecklistsByField({ scenario: legacyScenario, step, limit }, 'scenario');
    }
    return list;
  }

  const db = getDb();
  let query = db.collection(COLLECTION);
  if (step) query = query.where('step', '==', step);
  query = query.orderBy('createdAt', 'desc');
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  createChecklist,
  getChecklist,
  listChecklists
};
