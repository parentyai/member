'use strict';

const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');

const SUBJECT_TYPES = new Set(['user', 'notification', 'checklist', 'other']);
const DECISIONS = new Set(['OK', 'HOLD', 'ESCALATE']);

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function requireEnum(value, label, allowed) {
  if (!allowed.has(value)) throw new Error(`invalid ${label}`);
  return value;
}

function requireReason(value) {
  if (value === undefined || value === null) throw new Error('reason required');
  if (typeof value !== 'string') throw new Error('invalid reason');
  return value;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return 50;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid limit');
  return Math.floor(num);
}

async function appendDecision(input) {
  const payload = input || {};
  const subjectType = requireEnum(payload.subjectType, 'subjectType', SUBJECT_TYPES);
  const subjectId = requireString(payload.subjectId, 'subjectId');
  const decision = requireEnum(payload.decision, 'decision', DECISIONS);
  const decidedBy = requireString(payload.decidedBy, 'decidedBy');
  const reason = requireReason(payload.reason);
  return decisionLogsRepo.appendDecision({
    subjectType,
    subjectId,
    decision,
    decidedBy,
    reason
  });
}

async function getLatestDecision(subjectType, subjectId) {
  const type = requireEnum(subjectType, 'subjectType', SUBJECT_TYPES);
  const id = requireString(subjectId, 'subjectId');
  return decisionLogsRepo.getLatestDecision(type, id);
}

async function listDecisions(subjectType, subjectId, limit) {
  const type = requireEnum(subjectType, 'subjectType', SUBJECT_TYPES);
  const id = requireString(subjectId, 'subjectId');
  const cap = parseLimit(limit);
  return decisionLogsRepo.listDecisions(type, id, cap);
}

module.exports = {
  appendDecision,
  getLatestDecision,
  listDecisions
};
