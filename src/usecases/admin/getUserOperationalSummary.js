'use strict';

const {
  listAllUsers,
  listAllEvents,
  listAllChecklists,
  listAllUserChecklists
} = require('../../repos/firestore/phase2ReadRepo');

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

function buildChecklistTotals(checklists) {
  const totals = new Map();
  for (const checklist of checklists) {
    const data = checklist.data || {};
    const scenario = data.scenario;
    const step = data.step;
    if (!scenario || !step) continue;
    const items = Array.isArray(data.items) ? data.items : [];
    const key = `${scenario}__${step}`;
    const current = totals.get(key) || 0;
    totals.set(key, current + items.length);
  }
  return totals;
}

function buildCompletedByUser(userChecklists) {
  const completed = new Map();
  for (const record of userChecklists) {
    const data = record.data || {};
    if (!data.lineUserId) continue;
    if (!data.completedAt) continue;
    const current = completed.get(data.lineUserId) || 0;
    completed.set(data.lineUserId, current + 1);
  }
  return completed;
}

function buildLatestActionByUser(events) {
  const latest = new Map();
  for (const event of events) {
    const data = event.data || {};
    const lineUserId = data.lineUserId;
    if (!lineUserId) continue;
    const ms = toMillis(data.createdAt);
    if (!ms) continue;
    const current = latest.get(lineUserId);
    if (!current || ms > current.ms) {
      latest.set(lineUserId, { ms, value: data.createdAt });
    }
  }
  return latest;
}

async function getUserOperationalSummary() {
  const [users, events, checklists, userChecklists] = await Promise.all([
    listAllUsers(),
    listAllEvents(),
    listAllChecklists(),
    listAllUserChecklists()
  ]);

  const totals = buildChecklistTotals(checklists);
  const completedByUser = buildCompletedByUser(userChecklists);
  const latestActionByUser = buildLatestActionByUser(events);

  return users.map((user) => {
    const data = user.data || {};
    const createdAtMs = toMillis(data.createdAt);
    const scenarioKey = data.scenarioKey;
    const stepKey = data.stepKey;
    const key = scenarioKey && stepKey ? `${scenarioKey}__${stepKey}` : null;
    const total = key ? (totals.get(key) || 0) : 0;
    const hasChecklistDone = data.checklistDone && typeof data.checklistDone === 'object';
    const completed = hasChecklistDone ? Object.keys(data.checklistDone).length : (completedByUser.get(user.id) || 0);
    const latest = latestActionByUser.get(user.id);
    return {
      lineUserId: user.id,
      createdAt: formatTimestamp(data.createdAt),
      createdAtMs,
      hasMemberNumber: Boolean(data.memberNumber && String(data.memberNumber).trim().length > 0),
      checklistCompleted: completed,
      checklistTotal: total,
      lastActionAt: latest ? formatTimestamp(latest.value) : null
    };
  });
}

module.exports = {
  getUserOperationalSummary
};
