'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

const COLLECTION = 'city_pack_update_proposals';
const ALLOWED_STATUS = new Set(['draft', 'approved', 'rejected', 'applied']);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'draft';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cpp_${crypto.randomUUID()}`;
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: resolveId(payload),
    status: normalizeStatus(payload.status),
    cityPackId: normalizeString(payload.cityPackId),
    summary: normalizeString(payload.summary),
    proposalPatch: payload.proposalPatch && typeof payload.proposalPatch === 'object' ? payload.proposalPatch : null,
    traceId: normalizeString(payload.traceId),
    requestId: normalizeString(payload.requestId)
  };
}

async function createProposal(data) {
  const payload = normalizePayload(data);
  if (!payload.cityPackId) throw new Error('cityPackId required');
  if (!payload.summary) throw new Error('summary required');
  if (!payload.proposalPatch) throw new Error('proposalPatch required');
  if (!payload.traceId) throw new Error('traceId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    status: payload.status,
    cityPackId: payload.cityPackId,
    summary: payload.summary,
    proposalPatch: payload.proposalPatch,
    traceId: payload.traceId,
    requestId: payload.requestId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    approvedAt: null,
    appliedAt: null,
    llm_used: false,
    model: null,
    promptVersion: null
  }, { merge: false });
  return { id: payload.id };
}

async function getProposal(proposalId) {
  if (!proposalId) throw new Error('proposalId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(proposalId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateProposal(proposalId, patch) {
  if (!proposalId) throw new Error('proposalId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(proposalId).set(payload, { merge: true });
  return { id: proposalId };
}

async function listProposals(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 200) : 50;
  let baseQuery = getDb().collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', normalizeStatus(opts.status));
  let rows;
  try {
    const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'cityPackUpdateProposalsRepo',
      query: 'listProposals',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    const snap = await baseQuery.get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'updatedAt');
    rows = rows.slice(0, limit);
  }
  return rows;
}

module.exports = {
  normalizeStatus,
  createProposal,
  getProposal,
  updateProposal,
  listProposals
};
