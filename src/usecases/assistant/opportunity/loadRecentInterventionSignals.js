'use strict';

const llmActionLogsRepo = require('../../../repos/firestore/llmActionLogsRepo');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function isInterventionRow(row) {
  if (!row || typeof row !== 'object') return false;
  const conversationMode = normalizeText(row.conversationMode).toLowerCase();
  if (conversationMode === 'concierge') return true;
  const opportunityType = normalizeText(row.opportunityType).toLowerCase();
  return opportunityType && opportunityType !== 'none';
}

async function loadRecentInterventionSignals(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const recentTurns = Number.isFinite(Number(payload.recentTurns))
    ? Math.max(1, Math.min(20, Math.floor(Number(payload.recentTurns))))
    : 5;

  if (!lineUserId) {
    return {
      recentTurns,
      recentInterventions: 0,
      recentClicks: false,
      recentTaskDone: false,
      lastInterventionAt: null
    };
  }

  const repo = deps && deps.llmActionLogsRepo
    ? deps.llmActionLogsRepo
    : llmActionLogsRepo;
  const rows = await repo.listLlmActionLogsByLineUserId({
    lineUserId,
    limit: Math.max(20, recentTurns * 3)
  }).catch(() => []);

  const sorted = (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((left, right) => {
      const leftMs = toMillis(left && left.createdAt);
      const rightMs = toMillis(right && right.createdAt);
      return (rightMs || 0) - (leftMs || 0);
    })
    .slice(0, recentTurns);

  let recentInterventions = 0;
  let lastInterventionAt = null;
  let recentClicks = false;
  let recentTaskDone = false;

  sorted.forEach((row) => {
    if (isInterventionRow(row)) {
      recentInterventions += 1;
      if (!lastInterventionAt && row && row.createdAt) {
        lastInterventionAt = row.createdAt;
      }
    }
    const signals = row && row.rewardSignals && typeof row.rewardSignals === 'object'
      ? row.rewardSignals
      : null;
    if (signals && (signals.click === true || signals.clickPrimary === true || signals.clickSecondary === true)) {
      recentClicks = true;
    }
    if (signals && (signals.taskDone === true || signals.taskComplete === true || signals.blockedResolved === true)) {
      recentTaskDone = true;
    }
  });

  return {
    recentTurns,
    recentInterventions,
    recentClicks,
    recentTaskDone,
    lastInterventionAt
  };
}

module.exports = {
  loadRecentInterventionSignals
};
