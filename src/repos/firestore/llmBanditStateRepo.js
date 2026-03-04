'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_bandit_state';

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function clampCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildDocId(segmentKey, armId) {
  const segment = normalizeString(segmentKey);
  const arm = normalizeString(armId);
  if (!segment || !arm) return '';
  return `${segment}__${arm}`;
}

function normalizeState(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const pulls = clampCount(payload.pulls);
  const totalReward = toNumber(payload.totalReward, 0);
  const avgReward = pulls > 0 ? Number((totalReward / pulls).toFixed(6)) : toNumber(payload.avgReward, 0);
  return {
    segmentKey: normalizeString(payload.segmentKey),
    armId: normalizeString(payload.armId),
    pulls,
    totalReward,
    avgReward,
    epsilon: toNumber(payload.epsilon, 0.1),
    version: normalizeString(payload.version) || 'v1',
    updatedAt: payload.updatedAt || null
  };
}

async function getBanditArmState(segmentKey, armId) {
  const id = buildDocId(segmentKey, armId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeState(Object.assign({ segmentKey, armId }, snap.data()));
}

async function listBanditArmStatesBySegment(segmentKey, limit) {
  const segment = normalizeString(segmentKey);
  if (!segment) return [];
  const cap = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(200, Math.floor(Number(limit)))) : 100;
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('segmentKey', '==', segment).limit(cap).get();
  return snap.docs.map((doc) => normalizeState(Object.assign({ id: doc.id }, doc.data())));
}

async function recordBanditReward(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const segmentKey = normalizeString(payload.segmentKey);
  const armId = normalizeString(payload.armId);
  if (!segmentKey || !armId) return { ok: false, reason: 'segment_or_arm_missing' };
  const reward = toNumber(payload.reward, 0);
  const epsilon = toNumber(payload.epsilon, 0.1);
  const id = buildDocId(segmentKey, armId);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  const current = snap.exists ? normalizeState(snap.data()) : normalizeState({ segmentKey, armId, pulls: 0, totalReward: 0, avgReward: 0, epsilon });
  const pulls = current.pulls + 1;
  const totalReward = Number((current.totalReward + reward).toFixed(6));
  const avgReward = Number((totalReward / pulls).toFixed(6));
  const next = {
    segmentKey,
    armId,
    pulls,
    totalReward,
    avgReward,
    epsilon,
    version: 'v1',
    updatedAt: payload.updatedAt || serverTimestamp()
  };
  await docRef.set(next, { merge: true });
  return { ok: true, state: next };
}

module.exports = {
  COLLECTION,
  buildDocId,
  normalizeState,
  getBanditArmState,
  listBanditArmStatesBySegment,
  recordBanditReward
};
