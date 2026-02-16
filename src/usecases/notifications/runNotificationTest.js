'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const notificationTestRunsRepo = require('../../repos/firestore/notificationTestRunsRepo');
const { validateNotificationPayload } = require('../../domain/validators');
const { mapFailureCode } = require('../../domain/notificationFailureTaxonomy');
const { sendNotification } = require('./sendNotification');

const REGISTRY_PATH = path.resolve(__dirname, '..', '..', '..', 'docs', 'SSOT_NOTIFICATION_PATTERN_REGISTRY.json');

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    throw new Error('pattern registry not found');
  }
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  const patterns = Array.isArray(parsed.patterns) ? parsed.patterns : [];
  const filtered = [];
  for (const pattern of patterns) {
    if (!pattern || typeof pattern !== 'object') continue;
    if (pattern.excluded === true) {
      if (!pattern.excludeReason || String(pattern.excludeReason).trim().length === 0) {
        throw new Error('excludeReason required');
      }
      continue;
    }
    filtered.push(pattern);
  }
  return filtered;
}

function resolveRunId(value) {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `run-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildFailureTop3(results) {
  const counts = new Map();
  for (const item of results) {
    if (!item || item.ok) continue;
    const code = item.failureCode || 'UNKNOWN';
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([failureCode, count]) => ({ failureCode, count }));
}

async function runNotificationTest(params, deps) {
  const payload = params || {};
  const mode = payload.mode === 'self_send' ? 'self_send' : 'dry_run';
  const runId = resolveRunId(payload.runId);
  const start = deps && deps.now instanceof Date ? deps.now : new Date();
  const startedAt = toIso(start);
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0
    ? payload.traceId.trim()
    : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0
    ? payload.requestId.trim()
    : null;
  const actor = typeof payload.actor === 'string' && payload.actor.trim().length > 0
    ? payload.actor.trim()
    : 'unknown';

  const getKillSwitch = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;
  const killSwitch = await getKillSwitch();

  let patterns = Array.isArray(payload.patterns) ? payload.patterns : null;
  if (!patterns) {
    if (payload.useRegistry) {
      patterns = loadRegistry();
    } else if (payload.notificationId) {
      patterns = [{
        patternId: `single-${payload.notificationId}`,
        notificationId: payload.notificationId
      }];
    } else {
      patterns = [];
    }
  }
  if (!patterns.length) throw new Error('patterns required');

  const results = [];
  for (const pattern of patterns) {
    const notificationId = pattern && pattern.notificationId
      ? String(pattern.notificationId)
      : (payload.notificationId || null);
    const patternId = pattern && pattern.patternId
      ? String(pattern.patternId)
      : (notificationId ? `single-${notificationId}` : 'unknown');
    const item = {
      patternId,
      notificationId: notificationId || null,
      mode,
      ok: false,
      failureCode: null,
      error: null
    };
    try {
      if (!notificationId) throw new Error('notificationId required');
      const notification = await notificationsRepo.getNotification(notificationId);
      if (!notification) throw new Error('notification not found');
      if (mode === 'dry_run') {
        const linkEntry = await linkRegistryRepo.getLink(notification.linkRegistryId);
        validateNotificationPayload(notification, linkEntry, killSwitch);
        item.ok = true;
      } else {
        const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
        if (!lineUserId) throw new Error('lineUserId required');
        const result = await sendNotification({
          notificationId,
          lineUserIds: [lineUserId],
          killSwitch,
          traceId: traceId || undefined,
          requestId: requestId || undefined,
          actor,
          skipStatusUpdate: true,
          pushFn: payload.pushFn || (deps && deps.pushFn ? deps.pushFn : undefined)
        });
        item.ok = true;
        item.deliveredCount = result.deliveredCount || 0;
        item.skippedCount = result.skippedCount || 0;
      }
    } catch (err) {
      item.ok = false;
      item.failureCode = mapFailureCode(err);
      item.error = err && err.message ? String(err.message) : 'error';
    }
    results.push(item);
  }

  const end = new Date();
  const endedAt = toIso(end);
  const durationMs = startedAt && endedAt
    ? Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime())
    : null;
  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;
  const summary = {
    runId,
    mode,
    startedAt,
    endedAt,
    durationMs,
    total: results.length,
    passed,
    failed,
    failureTop3: buildFailureTop3(results)
  };

  if (payload.persist !== false) {
    await notificationTestRunsRepo.createRunWithId(runId, {
      mode,
      traceId,
      startedAt,
      endedAt,
      durationMs,
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      failureTop3: summary.failureTop3
    });
    for (const item of results) {
      await notificationTestRunsRepo.appendRunItem(runId, Object.assign({}, item, {
        traceId: traceId || null
      }));
    }
  }

  return {
    ok: true,
    runId,
    traceId,
    summary,
    results
  };
}

module.exports = {
  runNotificationTest
};
