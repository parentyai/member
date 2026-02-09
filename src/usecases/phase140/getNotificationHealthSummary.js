'use strict';

const { getNotificationReadModel } = require('../admin/getNotificationReadModel');

function resolveLimit(value) {
  if (value === undefined || value === null) return 20;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 20;
  return Math.min(Math.floor(num), 200);
}

function normalizeHealth(value) {
  if (value === 'DANGER' || value === 'WARN' || value === 'OK') return value;
  return 'UNKNOWN';
}

function scoreHealth(health) {
  if (health === 'DANGER') return 2;
  if (health === 'WARN') return 1;
  return 0;
}

function toNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value;
}

function buildTopUnhealthy(items, limit) {
  const list = [];
  for (const item of items) {
    const health = normalizeHealth(item && item.notificationHealth);
    if (health === 'OK') continue;
    const summary = item && item.reactionSummary && typeof item.reactionSummary === 'object'
      ? item.reactionSummary
      : {};
    list.push({
      notificationId: item.notificationId || null,
      title: item.title || null,
      scenarioKey: item.scenarioKey || null,
      stepKey: item.stepKey || null,
      health,
      sent: toNumber(summary.sent),
      clicked: toNumber(summary.clicked),
      ctr: toNumber(summary.ctr),
      lastSentAt: item.lastSentAt || null
    });
  }
  list.sort((a, b) => {
    const hs = scoreHealth(b.health) - scoreHealth(a.health);
    if (hs) return hs;
    const ctr = (a.ctr - b.ctr);
    if (ctr) return ctr;
    const sent = (b.sent - a.sent);
    if (sent) return sent;
    const aid = String(a.notificationId || '');
    const bid = String(b.notificationId || '');
    return aid.localeCompare(bid);
  });
  return list.slice(0, limit);
}

async function getNotificationHealthSummary(params, deps) {
  const payload = params || {};
  const limit = resolveLimit(payload.limit);
  const status = typeof payload.status === 'string' && payload.status.trim().length > 0 ? payload.status.trim() : 'sent';

  const readModelFn = deps && typeof deps.getNotificationReadModel === 'function'
    ? deps.getNotificationReadModel
    : getNotificationReadModel;

  const items = await readModelFn({ limit, status });

  const countsByHealth = { OK: 0, WARN: 0, DANGER: 0, UNKNOWN: 0 };
  for (const item of items) {
    const health = normalizeHealth(item && item.notificationHealth);
    countsByHealth[health] += 1;
  }
  const unhealthyCount = countsByHealth.WARN + countsByHealth.DANGER;

  return {
    ok: true,
    evaluatedAt: new Date().toISOString(),
    window: { limit, status },
    totalNotifications: items.length,
    countsByHealth,
    unhealthyCount,
    topUnhealthyNotifications: buildTopUnhealthy(items, 10)
  };
}

module.exports = {
  getNotificationHealthSummary
};

