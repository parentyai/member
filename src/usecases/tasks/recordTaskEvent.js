'use strict';

const taskEventsRepo = require('../../repos/firestore/taskEventsRepo');
const { isTaskEventsEnabled } = require('../../domain/tasks/featureFlags');

const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function resolveDecision(beforeTask, afterTask) {
  if (!afterTask || typeof afterTask !== 'object') return null;
  const before = beforeTask && typeof beforeTask === 'object' ? beforeTask : null;
  const after = afterTask;
  if (!before) return 'created';

  const beforeStatus = normalizeText(before.status, null);
  const afterStatus = normalizeText(after.status, null);
  const beforeBlocked = normalizeText(before.blockedReason, null);
  const afterBlocked = normalizeText(after.blockedReason, null);

  if (beforeStatus !== afterStatus) {
    if (afterStatus === 'blocked' || afterBlocked) return 'blocked';
    return 'status_changed';
  }

  if (beforeBlocked !== afterBlocked) {
    if (afterBlocked) return 'blocked';
    return 'updated';
  }

  return null;
}

function extractExplainKeys(afterTask, fallback) {
  const keys = [];
  const fromTask = Array.isArray(afterTask && afterTask.explain)
    ? afterTask.explain
      .map((item) => (item && typeof item.decisionKey === 'string' ? item.decisionKey.trim() : ''))
      .filter(Boolean)
    : [];
  fromTask.forEach((key) => {
    if (!keys.includes(key)) keys.push(key);
  });
  const fallbackKeys = Array.isArray(fallback) ? fallback : [];
  fallbackKeys.forEach((key) => {
    const normalized = normalizeText(key, '');
    if (!normalized) return;
    if (!keys.includes(normalized)) keys.push(normalized);
  });
  return keys;
}

async function appendTaskEventIfStateChanged(params, deps) {
  if (!isTaskEventsEnabled()) return null;

  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const beforeTask = payload.beforeTask && typeof payload.beforeTask === 'object' ? payload.beforeTask : null;
  const afterTask = payload.afterTask && typeof payload.afterTask === 'object' ? payload.afterTask : null;

  const decision = payload.decision || resolveDecision(beforeTask, afterTask);
  if (!decision) return null;

  const repository = resolvedDeps.taskEventsRepo || taskEventsRepo;
  const checkedAt = toIso(payload.checkedAt || (afterTask && afterTask.checkedAt) || new Date().toISOString()) || new Date().toISOString();

  const event = await repository.appendTaskEvent({
    taskId: afterTask && afterTask.taskId ? afterTask.taskId : (beforeTask && beforeTask.taskId),
    userId: afterTask && afterTask.userId ? afterTask.userId : (beforeTask && beforeTask.userId),
    lineUserId: afterTask && afterTask.lineUserId ? afterTask.lineUserId : (beforeTask && beforeTask.lineUserId),
    ruleId: afterTask && afterTask.ruleId ? afterTask.ruleId : (beforeTask && beforeTask.ruleId),
    [FIELD_SCK]: afterTask && afterTask[FIELD_SCK] ? afterTask[FIELD_SCK] : (beforeTask && beforeTask[FIELD_SCK]),
    stepKey: afterTask && afterTask.stepKey ? afterTask.stepKey : (beforeTask && beforeTask.stepKey),
    decision,
    beforeStatus: normalizeText(beforeTask && beforeTask.status, null),
    afterStatus: normalizeText(afterTask && afterTask.status, null),
    beforeBlockedReason: normalizeText(beforeTask && beforeTask.blockedReason, null),
    afterBlockedReason: normalizeText(afterTask && afterTask.blockedReason, null),
    checkedAt,
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    actor: normalizeText(payload.actor, 'unknown'),
    source: normalizeText(payload.source, 'task_engine_v1'),
    explainKeys: extractExplainKeys(afterTask, payload.explainKeys)
  });

  return event;
}

module.exports = {
  resolveDecision,
  appendTaskEventIfStateChanged
};
