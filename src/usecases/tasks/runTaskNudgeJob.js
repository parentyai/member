'use strict';

const crypto = require('crypto');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const { createNotification } = require('../notifications/createNotification');
const { sendNotification } = require('../notifications/sendNotification');
const { computeAttentionBudget } = require('../notifications/computeAttentionBudget');
const { computeDailyTopTasks } = require('./computeDailyTopTasks');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');
const { TASK_STATUS } = require('../../domain/tasks/constants');
const {
  isTaskNudgeEnabled,
  getTaskNudgeLinkPolicy,
  isJourneyAttentionBudgetEnabled,
  getJourneyDailyAttentionBudgetMax
} = require('../../domain/tasks/featureFlags');
const { appendTaskEventIfStateChanged } = require('./recordTaskEvent');
const { USER_SCENARIO_FIELD } = require('../../domain/constants');
const DEFAULT_LENIENT_LINK_REGISTRY_ID = 'task_todo_list';

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

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function resolveMeaning(task, rule) {
  const taskMeaning = task && task.meaning && typeof task.meaning === 'object' && !Array.isArray(task.meaning)
    ? task.meaning
    : null;
  const ruleMeaning = rule && rule.meaning && typeof rule.meaning === 'object' && !Array.isArray(rule.meaning)
    ? rule.meaning
    : null;
  const title = normalizeText(taskMeaning && taskMeaning.title, normalizeText(ruleMeaning && ruleMeaning.title, null));
  const summary = normalizeText(taskMeaning && taskMeaning.summary, normalizeText(ruleMeaning && ruleMeaning.summary, null));
  const doneDefinition = normalizeText(
    taskMeaning && taskMeaning.doneDefinition,
    normalizeText(ruleMeaning && ruleMeaning.doneDefinition, null)
  );
  const whyNow = normalizeText(taskMeaning && taskMeaning.whyNow, normalizeText(ruleMeaning && ruleMeaning.whyNow, null));
  const helpLinkRegistryIds = normalizeStringList(
    (taskMeaning && taskMeaning.helpLinkRegistryIds)
    || (ruleMeaning && ruleMeaning.helpLinkRegistryIds)
    || []
  ).slice(0, 3);
  if (!title && !summary && !doneDefinition && !whyNow && !helpLinkRegistryIds.length) return null;
  return {
    title,
    summary,
    doneDefinition,
    whyNow,
    helpLinkRegistryIds
  };
}

function groupTasksByUser(tasks) {
  const map = new Map();
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const row = task && typeof task === 'object' ? task : {};
    const userId = normalizeText(row.userId || row.lineUserId, '');
    if (!userId) return;
    if (!map.has(userId)) map.set(userId, []);
    map.get(userId).push(row);
  });
  return map;
}

async function buildRulePriorityMap(tasks, rulesRepository) {
  const map = new Map();
  const ruleIds = Array.from(new Set((Array.isArray(tasks) ? tasks : [])
    .map((item) => normalizeText(item && item.ruleId, ''))
    .filter(Boolean)));
  for (const ruleId of ruleIds) {
    // eslint-disable-next-line no-await-in-loop
    const rule = await rulesRepository.getStepRule(ruleId).catch(() => null);
    const priority = Number(rule && rule.priority);
    map.set(ruleId, Number.isFinite(priority) ? Math.max(0, Math.floor(priority)) : 100);
  }
  return map;
}

function buildNudgeBody(task, rule, meaning, linkRegistryId) {
  const template = rule && rule.nudgeTemplate && typeof rule.nudgeTemplate === 'object'
    ? rule.nudgeTemplate
    : null;
  if (meaning) {
    const dueLabel = task && task.dueAt ? String(task.dueAt).slice(0, 10) : '-';
    const whyNow = normalizeText(meaning.whyNow, normalizeText(meaning.summary, '期限に向けた準備が必要です。'));
    const doneDefinition = normalizeText(meaning.doneDefinition, '完了条件を確認して、進捗を更新してください。');
    const linkLabel = normalizeText(linkRegistryId, 'task_todo_list');
    return `期限: ${dueLabel} / 理由: ${whyNow}\n具体ステップ: ${doneDefinition}\n次の一手: LINEで「TODO一覧」と送信\n参考リンク: ${linkLabel}`;
  }
  if (template && template.body) return template.body;
  const stepKey = task && task.stepKey ? task.stepKey : '-';
  return `やることが未完了です。\nstep: ${stepKey}\n期限: ${task && task.dueAt ? String(task.dueAt).slice(0, 10) : '-'}\n完了したら一覧から更新してください。`;
}

function buildNudgeTitle(task, rule, meaning) {
  if (meaning && meaning.title) return `【やること】${meaning.title}`;
  const template = rule && rule.nudgeTemplate && typeof rule.nudgeTemplate === 'object'
    ? rule.nudgeTemplate
    : null;
  if (template && template.title) return template.title;
  return `Taskリマインド: ${task && task.ruleId ? task.ruleId : 'task'}`;
}

async function appendSuppressedAuditLog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (payload.dryRun === true) return;
  await appendAuditLog({
    actor: payload.actor || 'task_nudge_job',
    action: 'tasks.nudge.suppressed',
    entityType: 'task',
    entityId: payload.taskId || 'task',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      ok: true,
      taskId: payload.taskId || null,
      ruleId: payload.ruleId || null,
      reason: payload.reason || 'suppressed',
      checkedAt: payload.checkedAt || new Date().toISOString()
    }
  }).catch(() => null);
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
  const linkPolicy = getTaskNudgeLinkPolicy();

  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  const rulesRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const profilesRepository = resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo;
  const createNotificationFn = resolvedDeps.createNotification || createNotification;
  const sendNotificationFn = resolvedDeps.sendNotification || sendNotification;
  const getKillSwitch = resolvedDeps.getKillSwitch || systemFlagsRepo.getKillSwitch;
  const getNotificationCaps = resolvedDeps.getNotificationCaps || systemFlagsRepo.getNotificationCaps;
  const computeAttentionBudgetFn = resolvedDeps.computeAttentionBudget || computeAttentionBudget;

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

  const attentionBudgetEnabled = isJourneyAttentionBudgetEnabled();
  const budgetRemainingByUser = new Map();
  let taskQueue = Array.isArray(tasks) ? tasks.slice() : [];
  if (attentionBudgetEnabled && taskQueue.length) {
    const maxPerDay = getJourneyDailyAttentionBudgetMax();
    const grouped = groupTasksByUser(taskQueue);
    const userIds = Array.from(grouped.keys());
    const profiles = await profilesRepository
      .listUserJourneyProfilesByLineUserIds({ lineUserIds: userIds })
      .catch(() => []);
    const timezoneByUser = new Map();
    profiles.forEach((row) => {
      if (!row || !row.lineUserId) return;
      timezoneByUser.set(row.lineUserId, row.timezone || 'UTC');
    });
    for (const userId of userIds) {
      // eslint-disable-next-line no-await-in-loop
      const budget = await computeAttentionBudgetFn({
        lineUserId: userId,
        timezone: timezoneByUser.get(userId) || 'UTC',
        now: nowIso,
        maxPerDay
      }, resolvedDeps).catch(() => ({
        remainingCount: maxPerDay,
        usedCount: 0
      }));
      budgetRemainingByUser.set(userId, Math.max(0, Number(budget.remainingCount || 0)));
    }
    const priorityMap = await buildRulePriorityMap(taskQueue, rulesRepository);
    const ordered = [];
    grouped.forEach((rows, userId) => {
      const scored = rows.map((row) => Object.assign({}, row, {
        priorityScore: priorityMap.get(normalizeText(row && row.ruleId, '')) || 100
      }));
      const top = computeDailyTopTasks({
        tasks: scored,
        limit: scored.length,
        now: nowIso
      });
      top.forEach((item) => ordered.push(item));
      if (!budgetRemainingByUser.has(userId)) budgetRemainingByUser.set(userId, maxPerDay);
    });
    taskQueue = ordered;
  }

  const globalTemplate = resolveGlobalNudgeTemplate();
  let scannedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const results = [];

  for (const task of taskQueue) {
    scannedCount += 1;
    const row = task && typeof task === 'object' ? task : {};
    if (attentionBudgetEnabled) {
      const userKey = normalizeText(row.userId || row.lineUserId, '');
      const remaining = budgetRemainingByUser.has(userKey)
        ? Number(budgetRemainingByUser.get(userKey))
        : getJourneyDailyAttentionBudgetMax();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        skippedCount += 1;
        results.push({ taskId: row.taskId || null, status: 'skipped', reason: 'attention_budget_exhausted' });
        await appendSuppressedAuditLog({
          dryRun,
          actor: payload.actor || 'task_nudge_job',
          traceId: payload.traceId || null,
          requestId: payload.requestId || null,
          taskId: row.taskId || null,
          ruleId: row.ruleId || null,
          reason: 'attention_budget_exhausted',
          checkedAt: nowIso
        });
        continue;
      }
    }
    if (row.status === TASK_STATUS.DONE || row.status === TASK_STATUS.BLOCKED || row.status === TASK_STATUS.SNOOZED) {
      skippedCount += 1;
      results.push({ taskId: row.taskId || null, status: 'skipped', reason: 'status_not_sendable' });
      await appendSuppressedAuditLog({
        dryRun,
        actor: payload.actor || 'task_nudge_job',
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        taskId: row.taskId || null,
        ruleId: row.ruleId || null,
        reason: 'status_not_sendable',
        checkedAt: nowIso
      });
      continue;
    }

    const rule = row.ruleId ? await rulesRepository.getStepRule(row.ruleId).catch(() => null) : null;
    const nudgeTemplate = rule && rule.nudgeTemplate && typeof rule.nudgeTemplate === 'object'
      ? rule.nudgeTemplate
      : {};
    const meaning = resolveMeaning(row, rule);
    const meaningLinkRegistryId = normalizeText(meaning && meaning.helpLinkRegistryIds && meaning.helpLinkRegistryIds[0], null);
    const configuredLinkRegistryId = normalizeText(meaningLinkRegistryId, normalizeText(nudgeTemplate.linkRegistryId, globalTemplate.linkRegistryId));
    let linkRegistryId = configuredLinkRegistryId;
    if (!linkRegistryId && linkPolicy === 'lenient') {
      linkRegistryId = DEFAULT_LENIENT_LINK_REGISTRY_ID;
    }
    const ctaText = normalizeText(nudgeTemplate.ctaText, globalTemplate.ctaText);
    const notificationCategory = normalizeText(nudgeTemplate.notificationCategory, globalTemplate.notificationCategory);
    if (!linkRegistryId) {
      skippedCount += 1;
      results.push({ taskId: row.taskId || null, status: 'skipped', reason: 'link_registry_missing' });
      await appendSuppressedAuditLog({
        dryRun,
        actor: payload.actor || 'task_nudge_job',
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        taskId: row.taskId || null,
        ruleId: row.ruleId || null,
        reason: 'link_registry_missing',
        checkedAt: nowIso
      });
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
      await appendSuppressedAuditLog({
        dryRun,
        actor: payload.actor || 'task_nudge_job',
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        taskId: row.taskId || null,
        ruleId: row.ruleId || null,
        reason: 'cap_blocked',
        checkedAt: nowIso
      });
      continue;
    }

    const planHash = buildTaskPlanHash(row, rule, nowIso);
    const notificationPayload = {
      title: buildNudgeTitle(row, rule, meaning),
      body: buildNudgeBody(row, rule, meaning, linkRegistryId),
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
        applyAttentionBudget: attentionBudgetEnabled,
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
      if (attentionBudgetEnabled) {
        const userKey = normalizeText(row.userId || row.lineUserId, '');
        const current = budgetRemainingByUser.has(userKey)
          ? Number(budgetRemainingByUser.get(userKey))
          : getJourneyDailyAttentionBudgetMax();
        if (Number.isFinite(current) && current > 0) {
          budgetRemainingByUser.set(userKey, Math.max(0, current - 1));
        }
      }
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
