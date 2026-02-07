'use strict';

const {
  listAllUsers,
  listAllEvents,
  listAllChecklists,
  listAllUserChecklists
} = require('../../repos/firestore/phase2ReadRepo');
const { evaluateChecklistCompleteness } = require('../phase24/checklistCompleteness');
const { evaluateUserSummaryCompleteness } = require('../phase24/userSummaryCompleteness');
const { evaluateRegistrationCompleteness } = require('../phase24/registrationCompleteness');
const { evaluateOpsStateCompleteness } = require('../phase24/opsStateCompleteness');
const { evaluateOpsDecisionCompleteness } = require('../phase24/opsDecisionCompleteness');
const { evaluateOverallDecisionReadiness } = require('../phase24/overallDecisionReadiness');
const opsStatesRepo = require('../../repos/firestore/opsStatesRepo');

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return value;
}

function isMemberNumberStale(data, nowMs) {
  const memberNumber = data && data.memberNumber ? String(data.memberNumber).trim() : '';
  if (memberNumber.length > 0) return false;
  const createdAtMs = toMillis(data && data.createdAt);
  if (!createdAtMs) return false;
  return nowMs - createdAtMs >= STALE_DAYS * DAY_MS;
}

function countChecklistTotal(checklists, scenarioKey, stepKey) {
  if (!scenarioKey || !stepKey) return 0;
  let total = 0;
  for (const checklist of checklists) {
    const data = checklist.data || {};
    if (data.scenario !== scenarioKey || data.step !== stepKey) continue;
    const items = Array.isArray(data.items) ? data.items : [];
    total += items.length;
  }
  return total;
}

function countChecklistCompletedByUser(user, userChecklists) {
  if (user && user.checklistDone && typeof user.checklistDone === 'object') {
    return Object.keys(user.checklistDone).length;
  }
  let count = 0;
  for (const record of userChecklists) {
    const data = record.data || {};
    if (data.lineUserId !== user.id) continue;
    if (!data.completedAt) continue;
    count += 1;
  }
  return count;
}

function findLatestAction(events, lineUserId) {
  let latest = null;
  let latestMs = null;
  for (const event of events) {
    const data = event.data || {};
    if (data.lineUserId !== lineUserId) continue;
    const ms = toMillis(data.createdAt);
    if (!ms) continue;
    if (!latestMs || ms > latestMs) {
      latestMs = ms;
      latest = data.createdAt;
    }
  }
  return latest ? formatTimestamp(latest) : null;
}

async function getUserStateSummary(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');

  const [users, events, checklists, userChecklists] = await Promise.all([
    listAllUsers(),
    listAllEvents(),
    listAllChecklists(),
    listAllUserChecklists()
  ]);

  const user = users.find((entry) => entry.id === payload.lineUserId);
  if (!user) throw new Error('user not found');
  const data = user.data || {};
  const nowMs = Date.now();
  const hasMemberNumber = Boolean(data.memberNumber && String(data.memberNumber).trim().length > 0);
  const memberNumberStale = isMemberNumberStale(data, nowMs);

  const checklistTotal = countChecklistTotal(checklists, data.scenarioKey, data.stepKey);
  const checklistCompleted = countChecklistCompletedByUser(user, userChecklists);
  const lastActionAt = findLatestAction(events, user.id);

  const checklistEval = evaluateChecklistCompleteness(
    { totalItems: checklistTotal },
    { completedCount: checklistCompleted }
  );
  const registrationCompleteness = await evaluateRegistrationCompleteness(user, { allUsers: users });
  const opsState = await opsStatesRepo.getOpsState(user.id);
  const opsStateCompleteness = evaluateOpsStateCompleteness(opsState);
  const userSummaryCompleteness = evaluateUserSummaryCompleteness({
    member: { hasMemberNumber, memberNumberStale }
  });
  const opsDecisionCompleteness = await evaluateOpsDecisionCompleteness(opsState);
  const overallDecisionReadiness = evaluateOverallDecisionReadiness({
    registrationCompleteness,
    userSummaryCompleteness,
    notificationSummaryCompleteness: null,
    checklistCompleteness: checklistEval.completeness,
    opsStateCompleteness,
    opsDecisionCompleteness
  });

  return {
    lineUserId: user.id,
    hasMemberNumber,
    checklistCompleted,
    checklistTotal,
    checklist: checklistEval,
    opsState,
    opsStateCompleteness,
    opsDecisionCompleteness,
    userSummaryCompleteness,
    overallDecisionReadiness,
    registrationCompleteness,
    lastActionAt
  };
}

module.exports = {
  getUserStateSummary
};
