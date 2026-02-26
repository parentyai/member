'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'emergency_providers';
const ALLOWED_STATUS = new Set(['enabled', 'disabled']);

function normalizeProviderKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!status) return 'disabled';
  return ALLOWED_STATUS.has(status) ? status : 'disabled';
}

function normalizeScheduleMinutes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 10;
  return Math.min(Math.max(Math.floor(num), 1), 24 * 60);
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function getProvider(providerKey) {
  const normalizedKey = normalizeProviderKey(providerKey);
  if (!normalizedKey) throw new Error('providerKey required');
  const snap = await getDb().collection(COLLECTION).doc(normalizedKey).get();
  if (!snap.exists) return null;
  return Object.assign({ providerKey: snap.id }, snap.data());
}

async function upsertProvider(providerKey, patch) {
  const normalizedKey = normalizeProviderKey(providerKey);
  if (!normalizedKey) throw new Error('providerKey required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const record = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) record.status = normalizeStatus(payload.status);
  if (Object.prototype.hasOwnProperty.call(payload, 'scheduleMinutes')) record.scheduleMinutes = normalizeScheduleMinutes(payload.scheduleMinutes);
  if (Object.prototype.hasOwnProperty.call(payload, 'officialLinkRegistryId')) {
    record.officialLinkRegistryId = normalizeString(payload.officialLinkRegistryId);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'lastRunAt')) record.lastRunAt = payload.lastRunAt || null;
  if (Object.prototype.hasOwnProperty.call(payload, 'lastSuccessAt')) record.lastSuccessAt = payload.lastSuccessAt || null;
  if (Object.prototype.hasOwnProperty.call(payload, 'lastError')) record.lastError = normalizeString(payload.lastError);
  if (Object.prototype.hasOwnProperty.call(payload, 'lastPayloadHash')) record.lastPayloadHash = normalizeString(payload.lastPayloadHash);
  if (Object.prototype.hasOwnProperty.call(payload, 'lastEtag')) record.lastEtag = normalizeString(payload.lastEtag);
  if (Object.prototype.hasOwnProperty.call(payload, 'lastModified')) record.lastModified = normalizeString(payload.lastModified);
  if (Object.prototype.hasOwnProperty.call(payload, 'traceId')) record.traceId = normalizeString(payload.traceId);
  record.updatedAt = serverTimestamp();

  const docRef = getDb().collection(COLLECTION).doc(normalizedKey);
  await docRef.set(record, { merge: true });
  return { providerKey: normalizedKey };
}

async function createProviderIfMissing(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const providerKey = normalizeProviderKey(payload.providerKey);
  if (!providerKey) throw new Error('providerKey required');
  const existing = await getProvider(providerKey);
  if (existing) return { providerKey, created: false };

  await getDb().collection(COLLECTION).doc(providerKey).set({
    providerKey,
    status: normalizeStatus(payload.status),
    scheduleMinutes: normalizeScheduleMinutes(payload.scheduleMinutes),
    officialLinkRegistryId: normalizeString(payload.officialLinkRegistryId),
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastPayloadHash: null,
    lastEtag: null,
    lastModified: null,
    traceId: normalizeString(payload.traceId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });

  return { providerKey, created: true };
}

async function listProviders(limit) {
  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 200) : 100;
  const snap = await getDb().collection(COLLECTION).limit(max).get();
  return snap.docs
    .map((doc) => Object.assign({ providerKey: doc.id }, doc.data()))
    .sort((a, b) => String(a.providerKey || '').localeCompare(String(b.providerKey || '')));
}

module.exports = {
  normalizeProviderKey,
  normalizeStatus,
  normalizeScheduleMinutes,
  getProvider,
  upsertProvider,
  createProviderIfMissing,
  listProviders
};
