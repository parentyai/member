'use strict';

const crypto = require('crypto');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { createNotification } = require('../notifications/createNotification');
const { sendNotification } = require('../notifications/sendNotification');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');
const { TASK_STATUS } = require('../../domain/tasks/constants');
const { isTaskNudgeEnabled } = require('../../domain/tasks/featureFlags');
const { appendTaskEventIfStateChanged } = require('./recordTaskEvent');
const { USER_SCENARIO_FIELD } = require('../../domain/constants');

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

function resolveGlobalNudgeTemplate() {
  return {
    ctaText: normalizeText(process.env.TASK_NUDGE_CTA_TEXT, 'やることを確認'),
    linkRegistryId: normalizeText(process.env.TASK_NUDGE_LINK_REGISTRY_ID, null),
    notificationCategory: normalizeText(process.env.TASK_NUDGE_NOTIFICATION_CATEGORY, 'SEQUENCE_GUIDANCE')
  };
}

function buildTaskPlanHash(task, rule, nowIso) {
  const payload = {
    taskId: task && task.taskId ? task.taskId : null,
    ruleId: rule && rule.ruleId ? rule.ruleId : null,
    dueAtBucket: (task && task.dueAt ? String(task.dueAt).slice(0, 13) : null),
    templateVersion: rule && rule.updatedAt ? String(rule.updatedAt) : nowIso
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex').slice(0, 24);
}

function computeNextNudgeAt(task, nowIso) {
  const baseMs = Date.parse(nowIso);
  if (!Number.isFinite(baseMs)) return nowIso;
  const dueMs = Date.parse(task && task.dueAt ? task.dueAt : '');
  if (Number.isFinite(dueMs) && dueMs > baseMs) return new Date(dueMs).toISOString();
  return new Date(baseMs + (24 * 60 * 60 * 1000)).toISOString();
}

function buildNudgeBody(task, rule) {
  const template = rule && rule.nudgeTemplate && typeof rule.nudgeTemplate === 'object'
    ? rule.nudgeTemplate
    : null;
  if (template && template.body) return template.body;
  const stepKey = task && task.stepKey ? task.stepKey : '-';
  return `やることが未完了です。\nstep: ${stepKey}\n期限: ${task && task.dueAt ? String(task.dueAt).slice(0, 10) : '-'}\n完了したら一覧から更新してください。`;
}

function buildNudgeTitle(task, rule) {
  const template = rule && rule.nudgeTemplate && typeof rule.nudgeTemplate === 'object'
    ? rule.nudgeTemplate
    : null;
  if (template && template.title) return template.title;
  return `Taskリマインド: ${task && task.ruleId ? task.ruleId : 'task'}`;
}

async function runTaskNudgeJob(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  if (!isTaskNudgeEnabled()) {
    return {
      ok: true,
      status: 'disabled_by_env',
      scannedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0
    };
  }

  const nowIso = toIso(payload.now) || new Date().toISOString();
  const dryRun = payload.dryRun === true;
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(1000, Number(payload.limit))) : 200;

  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  const rulesRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const createNotificationFn = resolvedDeps.createNotification || createNotification;
  const sendNotificationFn = resolvedDeps.sendNotification || sendNotification;
  const getKillSwitch = resolvedDeps.getKillSwitch || systemFlagsRepo.getKillSwitch;
  const getNotificationCaps = resolvedDeps.getNotificationCaps || systemFlagsRepo.getNotificationCaps;

  const killSwitch = await getKillSwitch().catch(() => false);
  if (killSwitch) {
    return {
      ok: false,
      status: 'blocked_by_killswitch',
      scannedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0
    };
  }

  const [tasks, notificationCaps] = await Promise.all([
    tasksRepository.listDueTasks({ beforeAt: nowIso, limit }),
    getNotificationCaps().catch(() => null)
  ]);

  const globalTemplate = resolveGlobalNudgeTemplate();
  let scannedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const results = [];

  for (const task of tasks) {
    scannedCount += 1;
    const row = task && typeof task === 'object' ? task : {};
    if (row.status === TASK_STATUS.DONE || row.status === TASK_STATUS.BLOCKED || row.status === TASK_STATUS.SNOOZED) {
      skippedCount += 1;
      results.push({ taskId: row.taskId || null, status: 'skipped', reason: 'status_not_sendable' });
      continue;
    }

    const rule = row.ruleId ? await rulesRepository.getStepRule(row.ruleId).catch(() => null) : null;
    const nudgeTemplate = rule && rule.nudgeTemplate && typeof rule.nudgeTemplate === 'object'
      ? rule.nudgeTemplate
      : {};

    const linkRegistryId = normalizeText(nudgeTemplate.linkRegistryId, globalTemplate.linkRegistryId);
    const ctaText = normalizeText(nudgeTemplate.ctaText, globalTemplate.ctaText);
    const notificationCategory = normalizeText(nudgeTemplate.notificationCategory, globalTemplate.notificationCategory);
    if (!linkRegistryId) {
      skippedCount += 1;
      results.push({ taskId: row.taskId || null, status: 'skipped', reason: 'link_registry_missing' });
      continue;
    }

    const cap = await checkNotificationCap({
      lineUserId: row.userId,
      notificationCategory,
      notificationCaps,
      now: new Date(nowIso)
    }).catch(() => ({ ok: true, blocked: false }));

    if (cap && cap.blocked) {
      skippedCount += 1;
      const capPatchedTask = await tasksRepository.patchTask(row.taskId, {
        blockedReason: cap.reason || 'cap_blocked',
        checkedAt: nowIso
      }).catch(() => null);
      await appendTaskEventIfStateChanged({
        beforeTask: row,
        afterTask: capPatchedTask,
        checkedAt: nowIso,
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        actor: payload.actor || 'task_nudge_job',
        source: 'run_task_nudge_job',
        explainKeys: ['cap_blocked']
      }, resolvedDeps).catch(() => null);
      results.push({ taskId: row.taskId || null, status: 'skipped', reason: 'cap_blocked' });
      continue;
    }

    const planHash = buildTaskPlanHash(row, rule, nowIso);
    const notificationPayload = {
      title: buildNudgeTitle(row, rule),
      body: buildNudgeBody(row, rule),
      ctaText,
      linkRegistryId,
      [USER_SCENARIO_FIELD]: row && row[USER_SCENARIO_FIELD],
      stepKey: row.stepKey,
      target: { limit: 1 },
      notificationCategory,
      trigger: 'manual',
      order: 1,
      createdBy: payload.actor || 'task_nudge_job',
      notificationMeta: {
        source: 'task_engine_v1',
        taskId: row.taskId,
        ruleId: row.ruleId,
        planHash
      }
    };

    if (dryRun) {
      skippedCount += 1;
      results.push({ taskId: row.taskId || null, status: 'dry_run', planHash, notificationPayload });
      continue;
    }

    try {
      const created = await createNotificationFn(notificationPayload);
      const notificationId = created && created.id ? created.id : null;
      if (!notificationId) throw new Error('notification create failed');
      const sendResult = await sendNotificationFn({
        notificationId,
        lineUserIds: [row.userId],
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        actor: payload.actor || 'task_nudge_job',
        auditContext: {
          taskId: row.taskId,
          ruleId: row.ruleId,
          decision: 'task_nudge',
          checkedAt: nowIso,
          blockedReason: null
        }
      });
      sentCount += Number(sendResult && sendResult.deliveredCount) || 0;
      const patchedTask = await tasksRepository.patchTask(row.taskId, {
        status: row.status,
        blockedReason: null,
        checkedAt: nowIso,
        nudgeCount: (Number(row.nudgeCount) || 0) + 1,
        lastNotifiedAt: nowIso,
        nextNudgeAt: computeNextNudgeAt(row, nowIso)
      });
      await appendTaskEventIfStateChanged({
        beforeTask: row,
        afterTask: patchedTask,
        checkedAt: nowIso,
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        actor: payload.actor || 'task_nudge_job',
        source: 'run_task_nudge_job',
        explainKeys: ['nudge_sent']
      }, resolvedDeps).catch(() => null);
      await appendAuditLog({
        actor: payload.actor || 'task_nudge_job',
        action: 'tasks.nudge.send',
        entityType: 'task',
        entityId: row.taskId,
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        payloadSummary: {
          taskId: row.taskId,
          ruleId: row.ruleId,
          notificationId,
          planHash,
          checkedAt: nowIso,
          blockedReason: null
        }
      });
      results.push({ taskId: row.taskId || null, status: 'sent', notificationId, planHash });
    } catch (err) {
      failedCount += 1;
      await appendAuditLog({
        actor: payload.actor || 'task_nudge_job',
        action: 'tasks.nudge.send',
        entityType: 'task',
        entityId: row.taskId || 'task',
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        payloadSummary: {
          ok: false,
          taskId: row.taskId,
          ruleId: row.ruleId,
          checkedAt: nowIso,
          blockedReason: err && err.message ? String(err.message) : 'send_failed'
        }
      }).catch(() => null);
      results.push({ taskId: row.taskId || null, status: 'failed', error: err && err.message ? err.message : 'send failed' });
    }
  }

  return {
    ok: failedCount === 0,
    status: 'completed',
    now: nowIso,
    dryRun,
    scannedCount,
    sentCount,
    skippedCount,
    failedCount,
    results
  };
}

module.exports = {
  runTaskNudgeJob
};
