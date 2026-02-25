'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'rich_menu_phase_profiles';
const ALLOWED_STATUS = Object.freeze(['active', 'deprecated']);
const ALLOWED_PHASE_IDS = Object.freeze(['pre_departure', 'arrival', 'launch', 'stabilize', 'repatriation']);
const ALLOWED_JOURNEY_STAGE = Object.freeze(['unspecified', 'pre_departure', 'departure_ready', 'assigned', 'arrived']);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizePhaseId(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) return '';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_PHASE_IDS.includes(lowered)) return '';
  return lowered;
}

function normalizeStatus(value, fallback) {
  const normalized = normalizeText(value, fallback || 'active');
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STATUS.includes(lowered)) return null;
  return lowered;
}

function normalizeMatchers(values) {
  if (!Array.isArray(values)) return null;
  const out = [];
  values.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    const lowered = normalized.toLowerCase();
    if (!ALLOWED_JOURNEY_STAGE.includes(lowered)) return;
    if (!out.includes(lowered)) out.push(lowered);
  });
  if (!out.length) return null;
  return out;
}

function normalizeRichMenuPhaseProfile(input, idHint) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const phaseId = normalizePhaseId(input.phaseId || idHint);
  if (!phaseId) return null;
  const status = normalizeStatus(input.status, 'active');
  const journeyStageMatchers = normalizeMatchers(input.journeyStageMatchers);
  if ([status, journeyStageMatchers].includes(null)) return null;

  return {
    phaseId,
    status,
    label: normalizeText(input.label, phaseId) || phaseId,
    journeyStageMatchers,
    description: normalizeText(input.description, '') || ''
  };
}

function normalizeProfileDoc(docId, data) {
  const normalized = normalizeRichMenuPhaseProfile(Object.assign({}, data || {}, { phaseId: docId }), docId);
  if (!normalized) return null;
  const payload = data && typeof data === 'object' ? data : {};
  return Object.assign({}, normalized, {
    createdAt: payload.createdAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedAt: payload.updatedAt || null,
    updatedBy: normalizeText(payload.updatedBy, null)
  });
}

async function getRichMenuPhaseProfile(phaseId) {
  const id = normalizePhaseId(phaseId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeProfileDoc(id, snap.data());
}

async function upsertRichMenuPhaseProfile(profile, actor) {
  const normalized = normalizeRichMenuPhaseProfile(profile, profile && profile.phaseId);
  if (!normalized) throw new Error('invalid richMenuPhaseProfile');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(normalized.phaseId);
  const existing = await docRef.get();
  const existingData = existing.exists ? (existing.data() || {}) : {};
  const createdAt = existingData.createdAt || serverTimestamp();
  const createdBy = normalizeText(existingData.createdBy, '') || (typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown');
  const updatedBy = typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown';
  await docRef.set(Object.assign({}, normalized, {
    createdAt,
    createdBy,
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getRichMenuPhaseProfile(normalized.phaseId);
}

async function listRichMenuPhaseProfiles(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const statusFilter = normalizeText(payload.status, '') || null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  const rows = snap.docs
    .map((doc) => normalizeProfileDoc(doc.id, doc.data()))
    .filter(Boolean)
    .sort((a, b) => String(a.phaseId).localeCompare(String(b.phaseId), 'ja'));
  if (!statusFilter) return rows;
  return rows.filter((row) => row.status === statusFilter.toLowerCase());
}

module.exports = {
  COLLECTION,
  ALLOWED_PHASE_IDS,
  ALLOWED_JOURNEY_STAGE,
  normalizeRichMenuPhaseProfile,
  getRichMenuPhaseProfile,
  upsertRichMenuPhaseProfile,
  listRichMenuPhaseProfiles
};
