'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');
const { sortByTimestampDesc } = require('./queryFallback');
const {
  normalizeText,
  normalizeStringList,
  normalizeIssueProvenance,
  normalizeBacklogStatus,
  normalizeBacklogPriority
} = require('../../domain/qualityPatrol/issueModel');
const {
  buildBacklogRecord,
  pickHigherPriority
} = require('../../domain/qualityPatrol/buildBacklogRecord');

const COLLECTION = 'quality_improvement_backlog';

function resolveTimestamp(value) {
  return value || serverTimestamp();
}

function normalizeLooseList(values, limit) {
  const rows = Array.isArray(values) ? values : (values ? [values] : []);
  const out = [];
  const seen = new Set();
  rows.forEach((item) => {
    if (out.length >= limit) return;
    const normalized = typeof item === 'string'
      ? normalizeText(item)
      : (item && typeof item === 'object' && !Array.isArray(item) ? Object.assign({}, item) : null);
    if (!normalized) return;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function buildRecordEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const createdAt = payload.createdAt || new Date().toISOString();
  return buildUniversalRecordEnvelope({
    recordId: payload.backlogId,
    recordType: 'quality_improvement_backlog_record',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: 'snapshot:quality_improvement_backlog',
    effectiveFrom: createdAt,
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'RECOMMENDED',
    status: 'active',
    retentionTag: 'quality_improvement_backlog_indefinite',
    piiClass: 'none',
    accessScope: ['operator', 'quality_patrol'],
    maskingPolicy: 'quality_patrol_registry_structured_v1',
    deletionPolicy: 'retention_policy_v1',
    createdAt,
    updatedAt: payload.updatedAt || createdAt
  });
}

function normalizeBacklogRow(payload, recordEnvelope) {
  const source = buildBacklogRecord(payload);
  return Object.assign({}, source, {
    createdAt: resolveTimestamp(source.createdAt),
    updatedAt: resolveTimestamp(source.updatedAt),
    status: normalizeBacklogStatus(source.status),
    priority: normalizeBacklogPriority(source.priority),
    issueIds: normalizeStringList(source.issueIds, { limit: 16 }),
    targetFiles: normalizeStringList(source.targetFiles, { limit: 24 }),
    dependency: normalizeStringList(source.dependency, { limit: 12 }),
    provenance: normalizeIssueProvenance(source.provenance),
    expectedKpiMovement: normalizeLooseList(source.expectedKpiMovement, 12),
    recordEnvelope
  });
}

function mergeBacklogRecords(existing, incoming) {
  const current = existing && typeof existing === 'object' ? existing : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  return buildBacklogRecord({
    backlogId: next.backlogId || current.backlogId,
    createdAt: current.createdAt || next.createdAt,
    updatedAt: next.updatedAt || next.createdAt || new Date().toISOString(),
    status: next.status || current.status,
    priority: pickHigherPriority(current.priority, next.priority),
    issueIds: []
      .concat(Array.isArray(current.issueIds) ? current.issueIds : [])
      .concat(Array.isArray(next.issueIds) ? next.issueIds : []),
    proposedPrName: next.proposedPrName || current.proposedPrName,
    objective: next.objective || current.objective,
    whyNow: next.whyNow || current.whyNow,
    targetFiles: []
      .concat(Array.isArray(current.targetFiles) ? current.targetFiles : [])
      .concat(Array.isArray(next.targetFiles) ? next.targetFiles : []),
    expectedKpiMovement: []
      .concat(Array.isArray(current.expectedKpiMovement) ? current.expectedKpiMovement : [])
      .concat(Array.isArray(next.expectedKpiMovement) ? next.expectedKpiMovement : []),
    risk: next.risk || current.risk,
    rollbackPlan: next.rollbackPlan || current.rollbackPlan,
    dependency: []
      .concat(Array.isArray(current.dependency) ? current.dependency : [])
      .concat(Array.isArray(next.dependency) ? next.dependency : []),
    owner: next.owner || current.owner,
    provenance: next.provenance || current.provenance
  });
}

async function getImprovementBacklog(backlogId) {
  if (!backlogId) throw new Error('backlogId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(backlogId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function upsertImprovementBacklog(data) {
  const payload = buildBacklogRecord(data);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.backlogId);
  const result = { id: payload.backlogId, created: false };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) {
      const recordEnvelope = buildRecordEnvelope({
        backlogId: payload.backlogId,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt
      });
      assertRecordEnvelopeCompliance({ dataClass: 'quality_improvement_backlog', recordEnvelope });
      tx.set(docRef, normalizeBacklogRow(payload, recordEnvelope), { merge: false });
      result.created = true;
      return;
    }

    const existing = Object.assign({ id: snap.id }, snap.data());
    const merged = mergeBacklogRecords(existing, payload);
    const recordEnvelope = buildRecordEnvelope({
      backlogId: merged.backlogId,
      createdAt: existing.recordEnvelope && existing.recordEnvelope.created_at
        ? existing.recordEnvelope.created_at
        : (existing.createdAt || merged.createdAt),
      updatedAt: merged.updatedAt
    });
    assertRecordEnvelopeCompliance({ dataClass: 'quality_improvement_backlog', recordEnvelope });
    tx.set(docRef, normalizeBacklogRow(merged, recordEnvelope), { merge: true });
    result.created = false;
  });

  return result;
}

async function listImprovementBacklog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 100) : 30;
  const statuses = normalizeStringList(payload.statuses || (payload.status ? [payload.status] : []), { limit: 6, transform: 'token' });
  const db = getDb();
  const snap = await db.collection(COLLECTION).limit(Math.min(limit * 3, 200)).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  sortByTimestampDesc(rows, 'updatedAt');
  const rank = { p0: 0, p1: 1, p2: 2, p3: 3 };
  return rows
    .filter((row) => !statuses.length || statuses.includes(normalizeBacklogStatus(row && row.status)))
    .sort((left, right) => {
      const leftRank = rank[normalizeBacklogPriority(left && left.priority)] || 9;
      const rightRank = rank[normalizeBacklogPriority(right && right.priority)] || 9;
      if (leftRank !== rightRank) return leftRank - rightRank;
      const leftUpdated = new Date(left && left.updatedAt || 0).getTime();
      const rightUpdated = new Date(right && right.updatedAt || 0).getTime();
      return rightUpdated - leftUpdated;
    })
    .slice(0, limit);
}

module.exports = {
  COLLECTION,
  getImprovementBacklog,
  upsertImprovementBacklog,
  listImprovementBacklog
};
