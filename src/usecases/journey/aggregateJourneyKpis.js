'use strict';

const analyticsReadRepo = require('../../repos/firestore/analyticsReadRepo');
const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const journeyKpiDailyRepo = require('../../repos/firestore/journeyKpiDailyRepo');
const journeyTodoStatsRepo = require('../../repos/firestore/journeyTodoStatsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_WINDOWS = [7, 30, 60, 90];
const PHASES = new Set(['pre', 'arrival', 'settled', 'extend', 'return']);

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function toIso(value) {
  const ms = toMillis(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function normalizeDateKey(value, now) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const base = Number.isFinite(now) ? new Date(now) : new Date();
  return base.toISOString().slice(0, 10);
}

function normalizeRate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  const value = numerator / denominator;
  return Math.max(0, Math.min(1, Math.round(value * 10000) / 10000));
}

function parsePhaseFromEvent(event) {
  const payload = event && typeof event === 'object' ? event : {};
  const toPhase = typeof payload.toPhase === 'string' ? payload.toPhase.trim().toLowerCase() : '';
  if (PHASES.has(toPhase)) return toPhase;
  const phase = typeof payload.phase === 'string' ? payload.phase.trim().toLowerCase() : '';
  if (PHASES.has(phase)) return phase;
  return '';
}

function countEventActions(event) {
  const payload = event && typeof event === 'object' ? event : {};
  const arr = Array.isArray(payload.nextActions)
    ? payload.nextActions
    : (Array.isArray(payload.actions) ? payload.actions : []);
  if (arr.length > 0) return arr.length;
  return 1;
}

function normalizeReason(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return text || 'none';
}

function ensureUserStat(statsByUser, lineUserId) {
  const id = typeof lineUserId === 'string' ? lineUserId.trim() : '';
  if (!id) return null;
  if (!statsByUser.has(id)) {
    statsByUser.set(id, {
      lineUserId: id,
      firstSeenMs: null,
      eventTimes: [],
      latestPhase: '',
      phaseChanged: false
    });
  }
  return statsByUser.get(id);
}

function resolveScanLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4000;
  return Math.max(300, Math.min(Math.floor(parsed), 10000));
}

function resolveLookbackDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 120;
  return Math.max(30, Math.min(Math.floor(parsed), 365));
}

function summarizeRetention(statsList, nowMs) {
  const out = {};
  RETENTION_WINDOWS.forEach((days) => {
    let denominator = 0;
    let numerator = 0;
    const thresholdMs = days * DAY_MS;
    statsList.forEach((stat) => {
      const firstSeenMs = stat.firstSeenMs;
      if (!Number.isFinite(firstSeenMs)) return;
      if (nowMs - firstSeenMs < thresholdMs) return;
      denominator += 1;
      const retained = (stat.eventTimes || []).some((ms) => Number.isFinite(ms) && ms >= firstSeenMs + thresholdMs && ms <= nowMs);
      if (retained) numerator += 1;
    });
    out[`d${days}`] = normalizeRate(numerator, denominator);
  });
  return out;
}

function summarizeChurnReasons(events, llmUsageLogs, subscriptions) {
  let blocked = 0;
  let valueGap = 0;
  let cost = 0;
  let statusChange = 0;
  let dependencyGraphBlocked = 0;

  (llmUsageLogs || []).forEach((row) => {
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision !== 'allow') blocked += 1;
  });

  (events || []).forEach((row) => {
    const event = row && row.data ? row.data : row || {};
    const type = String(event.type || '').toLowerCase();
    if (type !== 'churn_reason') return;
    const reason = normalizeReason(event.reason || event.churnReason || event.category);
    if (reason === 'value_gap') valueGap += 1;
    if (reason === 'cost') cost += 1;
    if (reason === 'status_change') statusChange += 1;
    if (reason === 'dependency_block' || reason === 'dependency_graph' || reason === 'dependency_locked') {
      dependencyGraphBlocked += 1;
    }
  });

  (subscriptions || []).forEach((item) => {
    const status = String(item && item.status ? item.status : 'unknown').toLowerCase();
    if (status === 'past_due' || status === 'canceled' || status === 'incomplete') {
      statusChange += 1;
    }
    if (status === 'past_due') {
      cost += 1;
    }
  });

  const total = blocked + valueGap + cost + statusChange + dependencyGraphBlocked;
  return {
    blocked: normalizeRate(blocked, total),
    value_gap: normalizeRate(valueGap, total),
    cost: normalizeRate(cost, total),
    status_change: normalizeRate(statusChange, total),
    dependency_graph_blocked: normalizeRate(dependencyGraphBlocked, total)
  };
}

async function aggregateJourneyKpis(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const nowMs = Number.isFinite(Number(payload.nowMs)) ? Number(payload.nowMs) : Date.now();
  const lookbackDays = resolveLookbackDays(payload.lookbackDays);
  const scanLimit = resolveScanLimit(payload.scanLimit);
  const dateKey = normalizeDateKey(payload.dateKey, nowMs);
  const fromAt = new Date(nowMs - lookbackDays * DAY_MS);
  const toAt = new Date(nowMs);

  const readRepo = resolvedDeps.analyticsReadRepo || analyticsReadRepo;
  const usageRepo = resolvedDeps.llmUsageLogsRepo || llmUsageLogsRepo;
  const subscriptionsRepo = resolvedDeps.userSubscriptionsRepo || userSubscriptionsRepo;
  const todoStatsRepo = resolvedDeps.journeyTodoStatsRepo || journeyTodoStatsRepo;
  const dailyRepo = resolvedDeps.journeyKpiDailyRepo || journeyKpiDailyRepo;

  const [usersRows, eventsRows, llmUsageLogs] = await Promise.all([
    readRepo.listUsersByCreatedAtRange({ limit: scanLimit }).catch(() => []),
    readRepo.listEventsByCreatedAtRange({ fromAt, toAt, limit: scanLimit }).catch(() => []),
    usageRepo.listLlmUsageLogsByCreatedAtRange({ fromAt, toAt, limit: Math.min(scanLimit, 5000) }).catch(() => [])
  ]);

  const statsByUser = new Map();
  (usersRows || []).forEach((row) => {
    const lineUserId = row && row.id ? String(row.id).trim() : '';
    if (!lineUserId) return;
    const stat = ensureUserStat(statsByUser, lineUserId);
    if (!stat) return;
    const createdMs = toMillis(row && row.data && row.data.createdAt);
    if (Number.isFinite(createdMs)) {
      stat.firstSeenMs = Number.isFinite(stat.firstSeenMs) ? Math.min(stat.firstSeenMs, createdMs) : createdMs;
    }
  });

  let nextActionShownCount = 0;
  let nextActionCompletedCount = 0;
  let proPromptedCount = 0;
  let proConvertedCount = 0;

  (eventsRows || []).forEach((row) => {
    const event = row && row.data ? row.data : row || {};
    const lineUserId = typeof event.lineUserId === 'string' ? event.lineUserId.trim() : '';
    const ms = toMillis(event.createdAt);
    if (lineUserId) {
      const stat = ensureUserStat(statsByUser, lineUserId);
      if (stat && Number.isFinite(ms)) {
        stat.eventTimes.push(ms);
        stat.firstSeenMs = Number.isFinite(stat.firstSeenMs) ? Math.min(stat.firstSeenMs, ms) : ms;
      }
      const type = String(event.type || '').toLowerCase();
      if (type === 'user_phase_changed') {
        const phase = parsePhaseFromEvent(event);
        if (phase && stat) {
          stat.latestPhase = phase;
          stat.phaseChanged = true;
        }
      }
    }

    const type = String(event.type || '').toLowerCase();
    if (type === 'next_action_shown') nextActionShownCount += countEventActions(event);
    if (type === 'next_action_completed') nextActionCompletedCount += countEventActions(event);
    if (type === 'pro_prompted') proPromptedCount += 1;
    if (type === 'pro_converted') proConvertedCount += 1;
  });

  const lineUserIds = Array.from(statsByUser.keys());
  const subscriptions = lineUserIds.length
    ? await subscriptionsRepo.listUserSubscriptionsByLineUserIds({ lineUserIds }).catch(() => [])
    : [];
  const todoStats = lineUserIds.length
    ? await todoStatsRepo.listUserJourneyTodoStatsByLineUserIds({ lineUserIds }).catch(() => [])
    : [];

  const totalUsers = statsByUser.size;
  const proActiveCount = (subscriptions || []).filter((item) => {
    const status = String(item && item.status ? item.status : 'unknown').toLowerCase();
    return status === 'active' || status === 'trialing';
  }).length;

  const statsList = Array.from(statsByUser.values());
  const retention = summarizeRetention(statsList, nowMs);

  let phaseChangedUsers = 0;
  let phaseCompletedUsers = 0;
  statsList.forEach((stat) => {
    if (stat.phaseChanged) phaseChangedUsers += 1;
    if (stat.latestPhase === 'settled' || stat.latestPhase === 'extend' || stat.latestPhase === 'return') {
      phaseCompletedUsers += 1;
    }
  });

  let totalTaskCount = 0;
  let totalCompletedTaskCount = 0;
  let totalOpenTaskCount = 0;
  let totalLockedTaskCount = 0;
  (todoStats || []).forEach((row) => {
    const openCount = Number(row && row.openCount);
    const completedCount = Number(row && row.completedCount);
    const totalCount = Number(row && row.totalCount);
    const lockedCount = Number(row && row.lockedCount);
    if (Number.isFinite(totalCount) && totalCount >= 0) {
      totalTaskCount += totalCount;
    } else if (Number.isFinite(openCount) || Number.isFinite(completedCount)) {
      totalTaskCount += Math.max(0, (Number.isFinite(openCount) ? openCount : 0) + (Number.isFinite(completedCount) ? completedCount : 0));
    }
    if (Number.isFinite(completedCount) && completedCount >= 0) totalCompletedTaskCount += completedCount;
    if (Number.isFinite(openCount) && openCount >= 0) totalOpenTaskCount += openCount;
    if (Number.isFinite(lockedCount) && lockedCount >= 0) totalLockedTaskCount += lockedCount;
  });

  const result = {
    dateKey,
    generatedAt: toIso(nowMs) || new Date(nowMs).toISOString(),
    lookbackDays,
    scanLimit,
    totalUsers,
    proActiveCount,
    proActiveRatio: normalizeRate(proActiveCount, totalUsers),
    retention,
    phaseCompletionRate: normalizeRate(phaseCompletedUsers, phaseChangedUsers),
    taskCompletionRate: normalizeRate(totalCompletedTaskCount, totalTaskCount),
    dependencyBlockRate: normalizeRate(totalLockedTaskCount, totalOpenTaskCount),
    nextActionExecutionRate: normalizeRate(nextActionCompletedCount, nextActionShownCount),
    proConversionRate: normalizeRate(proConvertedCount, proPromptedCount),
    churnReasonRatio: summarizeChurnReasons(eventsRows, llmUsageLogs, subscriptions),
    nextActionShownCount,
    nextActionCompletedCount,
    proPromptedCount,
    proConvertedCount,
    metadata: {
      eventsScanned: Array.isArray(eventsRows) ? eventsRows.length : 0,
      llmLogsScanned: Array.isArray(llmUsageLogs) ? llmUsageLogs.length : 0,
      subscriptionsScanned: Array.isArray(subscriptions) ? subscriptions.length : 0,
      journeyTodoStatsScanned: Array.isArray(todoStats) ? todoStats.length : 0
    }
  };

  if (payload.write !== false) {
    await dailyRepo.upsertJourneyKpiDaily(dateKey, result, payload.actor || 'journey_kpi_job');
  }

  try {
    await appendAuditLog({
      actor: payload.actor || 'journey_kpi_job',
      action: 'journey_kpi.built',
      entityType: 'journey_kpi_daily',
      entityId: dateKey,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        totalUsers: result.totalUsers,
        proActiveCount: result.proActiveCount,
        retention,
        taskCompletionRate: result.taskCompletionRate,
        dependencyBlockRate: result.dependencyBlockRate,
        nextActionExecutionRate: result.nextActionExecutionRate,
        proConversionRate: result.proConversionRate
      }
    });
  } catch (_err) {
    // best effort only
  }

  return result;
}

module.exports = {
  aggregateJourneyKpis
};
