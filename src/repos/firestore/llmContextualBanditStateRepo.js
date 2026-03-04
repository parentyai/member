'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_contextual_bandit_state';

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function buildDocId(segmentKey, contextSignature, armId) {
  const segment = normalizeString(segmentKey);
  const signature = normalizeString(contextSignature);
  const arm = normalizeString(armId);
  if (!segment || !signature || !arm) return '';
  return `${segment}__${signature}__${arm}`;
}

function normalizeState(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const pulls = clampCount(payload.pulls);
  const totalReward = toNumber(payload.totalReward, 0);
  const avgReward = pulls > 0 ? Number((totalReward / pulls).toFixed(6)) : toNumber(payload.avgReward, 0);
  return {
    segmentKey: normalizeString(payload.segmentKey),
    contextSignature: normalizeString(payload.contextSignature),
    armId: normalizeString(payload.armId),
    pulls,
    totalReward,
    avgReward,
    epsilon: toNumber(payload.epsilon, 0.1),
    version: normalizeString(payload.version) || 'v1',
    updatedAt: payload.updatedAt || null
  };
}

async function listBanditArmStatesByContext(segmentKey, contextSignature, limit) {
  const segment = normalizeString(segmentKey);
  const signature = normalizeString(contextSignature);
  if (!segment || !signature) return [];
  const cap = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(200, Math.floor(Number(limit)))) : 100;
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('segmentKey', '==', segment)
    .where('contextSignature', '==', signature)
    .limit(cap)
    .get();
  return snap.docs.map((doc) => normalizeState(Object.assign({ id: doc.id }, doc.data())));
}

async function recordBanditReward(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const segmentKey = normalizeString(payload.segmentKey);
  const contextSignature = normalizeString(payload.contextSignature);
  const armId = normalizeString(payload.armId);
  if (!segmentKey || !contextSignature || !armId) return { ok: false, reason: 'segment_or_context_or_arm_missing' };

  const reward = toNumber(payload.reward, 0);
  const epsilon = toNumber(payload.epsilon, 0.1);
  const id = buildDocId(segmentKey, contextSignature, armId);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  const current = snap.exists
    ? normalizeState(snap.data())
    : normalizeState({ segmentKey, contextSignature, armId, pulls: 0, totalReward: 0, avgReward: 0, epsilon });

  const pulls = current.pulls + 1;
  const totalReward = Number((current.totalReward + reward).toFixed(6));
  const avgReward = Number((totalReward / pulls).toFixed(6));

  const next = {
    segmentKey,
    contextSignature,
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
  listBanditArmStatesByContext,
  recordBanditReward
};
