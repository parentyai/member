'use strict';

const { parseJourneyLineCommand } = require('../../domain/journey/lineCommandParsers');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const userCityPackPreferencesRepo = require('../../repos/firestore/userCityPackPreferencesRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { ALLOWED_MODULES } = cityPacksRepo;
const { resolvePlan } = require('../billing/planGate');
const { syncJourneyTodoPlan, refreshJourneyTodoStats } = require('./syncJourneyTodoPlan');
const { applyPersonalizedRichMenu } = require('./applyPersonalizedRichMenu');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');
const { computeVendorRelevanceScore } = require('./computeVendorRelevanceScore');
const { composeCityAndNationwidePacks } = require('../nationwidePack/composeCityAndNationwidePacks');
const { listUserTasks } = require('../tasks/listUserTasks');
const { computeNextTasks } = require('../tasks/computeNextTasks');
const { computeTaskGraph } = require('../tasks/computeTaskGraph');
const { patchTaskState } = require('../tasks/patchTaskState');
const { syncUserTasksProjection } = require('../tasks/syncUserTasksProjection');
const { resolveTaskContentLinks, isHealthyLink } = require('../tasks/validateTaskContent');
const { renderTaskFlexMessage } = require('../tasks/renderTaskFlexMessage');
const {
  resolveTaskDetailTaskKey,
  buildTaskDetailSectionReply
} = require('./taskDetailSectionReply');
const { JOURNEY_SCENARIO_MIRROR_FIELD } = require('../../domain/constants');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { regionPrompt } = require('../../domain/regionLineMessages');
const { toBlockedReasonJa } = require('../../domain/tasks/blockedReasonJa');
const {
  isJourneyUnifiedViewEnabled,
  isTaskDetailLineEnabled,
  isCityPackModuleSubscriptionEnabled,
  isRichMenuTaskOsEntryEnabled,
  isCityPackRecommendedTasksEnabled,
  isJourneyRegionalProceduresEnabled,
  isVendorRelevanceShadowEnabled,
  isVendorRelevanceSortEnabled
} = require('../../domain/tasks/featureFlags');
const { normalizeTaskCategory, TASK_CATEGORIES } = require('../../domain/tasks/taskCategories');

const HOUSEHOLD_LABEL = Object.freeze({
  single: '単身',
  couple: '夫婦',
  accompany1: '帯同1',
  accompany2: '帯同2'
});

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  if (typeof value !== 'string') return fallback || '';
  const normalized = value.trim();
  return normalized || fallback || '';
}

function normalizeOptionalToken(value) {
  const normalized = normalizeText(value, '');
  return normalized || null;
}

function buildTaskDetailAttribution(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nested = payload.attribution && typeof payload.attribution === 'object' ? payload.attribution : {};
  return {
    notificationId: normalizeOptionalToken(payload.notificationId) || normalizeOptionalToken(nested.notificationId),
    deliveryId: normalizeOptionalToken(payload.deliveryId) || normalizeOptionalToken(nested.deliveryId),
    source: normalizeOptionalToken(payload.source) || normalizeOptionalToken(nested.source),
    traceId: normalizeOptionalToken(payload.traceId) || normalizeOptionalToken(nested.traceId),
    requestId: normalizeOptionalToken(payload.requestId) || normalizeOptionalToken(nested.requestId)
  };
}

function buildTaskDetailAttributionKey(lineUserId, todoKey, attribution) {
  const user = normalizeText(lineUserId);
  const key = normalizeText(todoKey);
  const row = attribution && typeof attribution === 'object' ? attribution : {};
  if (normalizeText(row.deliveryId)) return `delivery:${normalizeText(row.deliveryId)}`;
  if (normalizeText(row.notificationId)) return `notification:${normalizeText(row.notificationId)}:${user}:${key}`;
  if (normalizeText(row.traceId)) return `trace:${normalizeText(row.traceId)}:${user}:${key}`;
  return `todo:${user}:${key}`;
}

function formatTodoStateLabel(item) {
  const row = item && typeof item === 'object' ? item : {};
  const taskStatus = String(row.taskStatus || row.status || '').toLowerCase();
  if (taskStatus === 'done') return '🟢 完了';
  if (taskStatus === 'blocked') return '⚫ ロック中';
  if (taskStatus === 'doing') return '🔵 進行中';
  if (taskStatus === 'snoozed') return '🟣 スヌーズ中';
  const dueMs = Date.parse(row.dueAt || '');
  const nowMs = Date.now();
  if (row.status === 'completed' || row.status === 'skipped') return '🟢 完了';
  if (row.graphStatus === 'locked') return '⚫ ロック中';
  if (Number.isFinite(dueMs) && dueMs <= nowMs + (3 * 24 * 60 * 60 * 1000)) return '🔴 期限迫る';
  if (row.progressState === 'in_progress') return '🔵 進行中';
  return '🟡 未着手';
}

function formatTopActionableTasks(graphResult) {
  const graph = graphResult && typeof graphResult === 'object' ? graphResult : {};
  const list = Array.isArray(graph.topActionableTasks) ? graph.topActionableTasks : [];
  if (!list.length) return '';
  const lines = ['優先タスクTOP3:'];
  list.slice(0, 3).forEach((item, index) => {
    const title = item && item.title ? item.title : (item && item.todoKey ? item.todoKey : '-');
    const due = item && item.dueDate ? item.dueDate : '-';
    lines.push(`${index + 1}. [${item.todoKey}] ${title}（期限:${due}）`);
  });
  return lines.join('\n');
}

function formatTodoList(items, graphResult) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    return 'TODOは未登録です。\n「属性:単身」「渡航日:2026-04-01」「着任日:2026-04-08」を設定すると自動作成されます。';
  }
  const lines = ['現在のTODOです。'];
  rows.slice(0, 10).forEach((item, idx) => {
    const title = item && item.title ? item.title : '-';
    const dueDate = item && item.dueDate ? item.dueDate : '-';
    const status = formatTodoStateLabel(item);
    const todoKey = item && item.todoKey ? item.todoKey : `todo_${idx + 1}`;
    const lockReasons = item && item.graphStatus === 'locked' && Array.isArray(item.lockReasons) && item.lockReasons.length
      ? ` / 理由: ${item.lockReasons.join('、')}`
      : '';
    lines.push(`${idx + 1}. [${todoKey}] ${title}（期限: ${dueDate} / 状態: ${status}${lockReasons}）`);
  });
  const topActionable = formatTopActionableTasks(graphResult);
  if (topActionable) lines.push(topActionable);
  lines.push('完了する場合は「TODO完了:todoKey」を送信してください。');
  lines.push('進行中にする場合は「TODO進行中:todoKey」、未着手へ戻す場合は「TODO未着手:todoKey」を送信してください。');
  lines.push('後で対応する場合は「TODOスヌーズ:todoKey:3」（3日）を送信してください。');
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  return lines.join('\n');
}

function formatTaskList(tasks, graphResult) {
  const rows = Array.isArray(tasks) ? tasks : [];
  if (!rows.length) return formatTodoList([], graphResult);
  const lines = ['現在のやること一覧です。'];
  rows.slice(0, 10).forEach((task, index) => {
    const key = task && task.ruleId ? task.ruleId : (task && task.taskId ? task.taskId : `task_${index + 1}`);
    const dueAt = task && task.dueAt ? String(task.dueAt).slice(0, 10) : '-';
    const label = formatTodoStateLabel({ taskStatus: task && task.status ? task.status : null, dueAt: task && task.dueAt ? task.dueAt : null });
    const blocked = task && task.blockedReason ? ` / 理由: ${task.blockedReason}` : '';
    lines.push(`${index + 1}. [${key}] 期限:${dueAt} / 状態:${label}${blocked}`);
  });
  const topActionable = formatTopActionableTasks(graphResult);
  if (topActionable) lines.push(topActionable);
  lines.push('完了する場合は「TODO完了:todoKey」を送信してください。');
  lines.push('進行中にする場合は「TODO進行中:todoKey」、未着手へ戻す場合は「TODO未着手:todoKey」を送信してください。');
  lines.push('後で対応する場合は「TODOスヌーズ:todoKey:3」（3日）を送信してください。');
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  return lines.join('\n');
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatNextTasksList(nextTasksResult) {
  const payload = nextTasksResult && typeof nextTasksResult === 'object' ? nextTasksResult : {};
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  if (!tasks.length) {
    return '今やるタスクはありません。まずは「TODO一覧」で全体を確認してください。';
  }
  const top = tasks.slice(0, 3);
  const primary = top[0] && typeof top[0] === 'object' ? top[0] : {};
  const primaryKey = normalizeText(
    primary.ruleId,
    normalizeText(primary.todoKey, normalizeText(primary.taskId, 'task_1'))
  );
  const primaryTitle = normalizeText(primary.title, primaryKey || '-');
  const primaryDueDate = primary.dueAt ? toDateLabel(primary.dueAt) : '-';
  const primaryBlockedReason = resolveBlockedReason(primary);
  const primaryBlockedLabel = primaryBlockedReason ? ` / ブロッカー:${primaryBlockedReason}` : '';
  const lines = [
    `今やる: [${primaryKey}] ${primaryTitle}（期限:${primaryDueDate}${primaryBlockedLabel}）`,
    '続けて今日の3つ:'
  ];
  top.forEach((task, index) => {
    const row = task && typeof task === 'object' ? task : {};
    const key = normalizeText(row.ruleId, normalizeText(row.todoKey, normalizeText(row.taskId, `task_${index + 1}`)));
    const title = normalizeText(row.title, key || '-');
    const dueDate = row.dueAt ? toDateLabel(row.dueAt) : '-';
    const category = normalizeTaskCategory(row.category, 'LIFE_SETUP') || 'LIFE_SETUP';
    const blockedReason = resolveBlockedReason(row);
    const blockedLabel = blockedReason ? ` / ブロッカー:${blockedReason}` : '';
    lines.push(`${index + 1}. [${key}] ${title}（期限:${dueDate} / カテゴリ:${category}${blockedLabel}）`);
  });
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  lines.push('期限確認は「今週の期限」（7日以内/期限超過）、地域差がある手続きは「地域手続き」で確認できます。');
  lines.push('カテゴリで絞る場合は「カテゴリ:IMMIGRATION」の形式で送信してください。');
  return lines.join('\n');
}

function resolveNowMillis(value) {
  const parsed = Date.parse(value || '');
  if (Number.isFinite(parsed)) return parsed;
  return Date.now();
}

function resolveTaskDueMillis(task) {
  const row = task && typeof task === 'object' ? task : {};
  const parsed = Date.parse(row.dueAt || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function isOpenTask(task) {
  const status = normalizeText(task && task.status).toLowerCase();
  return status === 'todo' || status === 'doing';
}

function resolveTaskKey(task, fallbackKey) {
  const row = task && typeof task === 'object' ? task : {};
  return normalizeText(
    row.ruleId,
    normalizeText(row.todoKey, normalizeText(row.taskId, fallbackKey || '-'))
  );
}

function resolveTaskTitle(task, fallbackKey) {
  const row = task && typeof task === 'object' ? task : {};
  const meaningTitle = normalizeText(row.meaning && row.meaning.title, null);
  return normalizeText(meaningTitle, normalizeText(row.title, resolveTaskKey(row, fallbackKey)));
}

function resolveBlockedReason(task) {
  const row = task && typeof task === 'object' ? task : {};
  return normalizeText(row.blockedReason, normalizeText(row.blockerReason, ''));
}

function formatDueSoonTasksList(tasks, nowMs) {
  const rows = Array.isArray(tasks) ? tasks : [];
  if (!rows.length) {
    return '期限（7日以内）/期限超過の未完了タスクはありません。';
  }
  const horizonMs = nowMs + (7 * DAY_MS);
  const openWithDue = rows
    .filter((row) => isOpenTask(row))
    .filter((row) => {
      const dueMs = resolveTaskDueMillis(row);
      return Number.isFinite(dueMs);
    })
    .sort((left, right) => toSortDueMillis(left && left.dueAt) - toSortDueMillis(right && right.dueAt));
  const dueSoon = openWithDue.filter((row) => {
    const dueMs = resolveTaskDueMillis(row);
    return Number.isFinite(dueMs) && dueMs >= nowMs && dueMs <= horizonMs;
  });
  const overdue = openWithDue.filter((row) => {
    const dueMs = resolveTaskDueMillis(row);
    return Number.isFinite(dueMs) && dueMs < nowMs;
  });

  if (!dueSoon.length && !overdue.length) {
    return '期限（7日以内）/期限超過の未完了タスクはありません。';
  }
  const lines = ['期限のある未完了タスク:', '【期限（7日以内）】'];
  if (!dueSoon.length) {
    lines.push('- 該当なし');
  }
  dueSoon.slice(0, 5).forEach((task, index) => {
    const key = resolveTaskKey(task, `task_${index + 1}`);
    const title = resolveTaskTitle(task, key);
    const dueDate = task && task.dueAt ? toDateLabel(task.dueAt) : '-';
    lines.push(`${index + 1}. [${key}] ${title}（期限:${dueDate}）`);
  });
  if (dueSoon.length > 5) lines.push(`...ほか ${dueSoon.length - 5} 件`);
  lines.push('【期限超過】');
  if (!overdue.length) {
    lines.push('- 該当なし');
  }
  overdue.slice(0, 5).forEach((task, index) => {
    const key = resolveTaskKey(task, `overdue_${index + 1}`);
    const title = resolveTaskTitle(task, key);
    const dueDate = task && task.dueAt ? toDateLabel(task.dueAt) : '-';
    lines.push(`${index + 1}. [${key}] ${title}（期限:${dueDate}）`);
  });
  if (overdue.length > 5) lines.push(`...ほか ${overdue.length - 5} 件`);
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  lines.push('次に着手する項目は「今やる」で確認できます。');
  return lines.join('\n');
}

function toSortDueMillis(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function toSortText(value) {
  return normalizeText(value).toLowerCase();
}

function toDeliveryTimeLabel(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return '-';
  return new Date(parsed).toISOString().slice(0, 16).replace('T', ' ');
}

function formatDeliveryHistory(deliveries) {
  const rows = Array.isArray(deliveries) ? deliveries : [];
  if (!rows.length) {
    return '通知履歴はまだありません。';
  }
  const lines = ['直近の通知履歴:'];
  rows.slice(0, 10).forEach((item, index) => {
    const row = item && typeof item === 'object' ? item : {};
    const sentAt = toDeliveryTimeLabel(row.sentAt || row.deliveredAt || row.createdAt);
    const status = row.delivered === true ? 'delivered' : (normalizeText(row.state, 'queued') || 'queued');
    const category = normalizeText(row.notificationCategory, '-');
    const notificationId = normalizeText(row.notificationId, row.id || '-');
    lines.push(`${index + 1}. ${sentAt} / ${status} / ${category} / ${notificationId}`);
  });
  lines.push('詳細を確認する場合は管理画面の Notification Monitor を利用してください。');
  return lines.join('\n');
}

function resolveTaskCategoryForView(task, ruleById) {
  const row = task && typeof task === 'object' ? task : {};
  const ruleId = normalizeText(row.ruleId);
  const rule = ruleId ? ruleById.get(ruleId) : null;
  return normalizeTaskCategory(row.category, normalizeTaskCategory(rule && rule.category, 'LIFE_SETUP')) || 'LIFE_SETUP';
}

async function buildStepRuleMapForView(deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const rules = await repository.listStepRules({ limit: 1000 }).catch(() => []);
  return new Map((Array.isArray(rules) ? rules : [])
    .filter((item) => item && item.ruleId)
    .map((item) => [item.ruleId, item]));
}

async function buildCategoryViewReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const categoryFilter = normalizeTaskCategory(payload.category, null);
  const taskResult = await listUserTasks({
    userId: lineUserId,
    lineUserId,
    forceRefresh: false,
    actor: 'line_command_category_view'
  }, resolvedDeps).catch(() => ({ tasks: [] }));
  const tasks = Array.isArray(taskResult.tasks) ? taskResult.tasks : [];
  const ruleById = await buildStepRuleMapForView(resolvedDeps);
  const openTasks = tasks.filter((item) => {
    const status = normalizeText(item && item.status).toLowerCase();
    return status === 'todo' || status === 'doing';
  });

  if (!categoryFilter) {
    const counts = new Map();
    const blockedCounts = new Map();
    openTasks.forEach((task) => {
      const category = resolveTaskCategoryForView(task, ruleById);
      counts.set(category, (counts.get(category) || 0) + 1);
      if (resolveBlockedReason(task)) {
        blockedCounts.set(category, (blockedCounts.get(category) || 0) + 1);
      }
    });
    const lines = ['カテゴリ別TODO件数:'];
    TASK_CATEGORIES.forEach((category) => {
      const total = counts.get(category) || 0;
      const blocked = blockedCounts.get(category) || 0;
      lines.push(`- ${category}: ${total}件（ブロック:${blocked}件）`);
    });
    lines.push('絞り込み例: カテゴリ:IMMIGRATION');
    return lines.join('\n');
  }

  const filtered = openTasks
    .filter((task) => resolveTaskCategoryForView(task, ruleById) === categoryFilter)
    .sort((left, right) => {
      const dueCompare = toSortDueMillis(left && left.dueAt) - toSortDueMillis(right && right.dueAt);
      if (dueCompare !== 0) return dueCompare;
      return toSortText(left && left.ruleId).localeCompare(toSortText(right && right.ruleId), 'ja');
    });
  if (!filtered.length) {
    return `${categoryFilter} カテゴリの未完了タスクはありません。`;
  }
  const lines = [`カテゴリ:${categoryFilter} の未完了タスク:`];
  filtered.slice(0, 10).forEach((task, index) => {
    const key = normalizeText(task && task.ruleId, normalizeText(task && task.taskId, `task_${index + 1}`));
    const title = normalizeText(task && task.meaning && task.meaning.title, key);
    const dueDate = task && task.dueAt ? toDateLabel(task.dueAt) : '-';
    const blockedReason = resolveBlockedReason(task);
    const blockedLabel = blockedReason ? ` / ブロッカー:${blockedReason}` : '';
    lines.push(`${index + 1}. [${key}] ${title}（期限:${dueDate}${blockedLabel}）`);
  });
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  return lines.join('\n');
}

function resolvePackClassRank(packClass) {
  return String(packClass || '').toLowerCase() === 'regional' ? 2 : 1;
}

function resolvePackClassLabel(packClass) {
  return String(packClass || '').toLowerCase() === 'regional' ? 'regional' : 'nationwide';
}

function resolvePriorityBoost(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function isModuleSubscribed(module, modulesSubscribed) {
  const normalizedModule = normalizeText(module).toLowerCase();
  if (!normalizedModule) return true;
  const subscribed = normalizeCityPackModules(modulesSubscribed);
  if (!subscribed.length) return true;
  return subscribed.includes(normalizedModule);
}

function pickPreferredRecommendedRule(current, candidate) {
  if (!current) return candidate;
  const currentRank = resolvePackClassRank(current.packClass);
  const candidateRank = resolvePackClassRank(candidate.packClass);
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  const currentBoost = resolvePriorityBoost(current.priorityBoost);
  const candidateBoost = resolvePriorityBoost(candidate.priorityBoost);
  if (candidateBoost !== currentBoost) return candidateBoost > currentBoost ? candidate : current;
  return current;
}

async function appendJourneyEventBestEffort(event, deps) {
  const payload = event && typeof event === 'object' ? event : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const type = normalizeText(payload.type);
  if (!lineUserId || !type) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.eventsRepo || eventsRepo;
  if (!repository || typeof repository.createEvent !== 'function') return;
  const extraFields = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const traceId = normalizeOptionalToken(payload.traceId);
  const requestId = normalizeOptionalToken(payload.requestId);
  const base = Object.assign({
    lineUserId,
    type,
    ref: payload.ref && typeof payload.ref === 'object' ? payload.ref : {}
  }, extraFields);
  if (traceId) base.traceId = traceId;
  if (requestId) base.requestId = requestId;
  await repository.createEvent(base).catch(() => null);
}

async function appendJourneyAuditBestEffort(entry, deps) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const writer = typeof resolvedDeps.appendAuditLog === 'function' ? resolvedDeps.appendAuditLog : appendAuditLog;
  if (typeof writer !== 'function') return;
  await writer(payload).catch(() => null);
}

async function runSyncJourneyTodoPlan(params, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const fn = typeof resolvedDeps.syncJourneyTodoPlan === 'function'
    ? resolvedDeps.syncJourneyTodoPlan
    : syncJourneyTodoPlan;
  return fn(params, resolvedDeps);
}

async function runSyncUserTasksProjection(params, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const fn = typeof resolvedDeps.syncUserTasksProjection === 'function'
    ? resolvedDeps.syncUserTasksProjection
    : syncUserTasksProjection;
  return fn(params, resolvedDeps);
}

function resolveTodoVendorTaskCategory(task, taskContent, stepRule) {
  const fromTaskContent = normalizeTaskCategory(taskContent && taskContent.category, null);
  if (fromTaskContent) return fromTaskContent;
  const fromStepRule = normalizeTaskCategory(stepRule && stepRule.category, null);
  if (fromStepRule) return fromStepRule;
  return normalizeTaskCategory(task && task.category, null);
}

async function resolveTodoVendorAssignmentContext(lineUserId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const profileRepository = resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo;
  const scheduleRepository = resolvedDeps.userJourneySchedulesRepo || userJourneySchedulesRepo;
  const [profile, schedule] = await Promise.all([
    profileRepository && typeof profileRepository.getUserJourneyProfile === 'function'
      ? profileRepository.getUserJourneyProfile(lineUserId).catch(() => null)
      : Promise.resolve(null),
    scheduleRepository && typeof scheduleRepository.getUserJourneySchedule === 'function'
      ? scheduleRepository.getUserJourneySchedule(lineUserId).catch(() => null)
      : Promise.resolve(null)
  ]);
  return {
    householdType: normalizeText(profile && profile.householdType) || null,
    departureDate: normalizeText(schedule && schedule.departureDate) || null,
    assignmentDate: normalizeText(schedule && schedule.assignmentDate) || null
  };
}

async function buildRegionalProceduresReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const nowMs = resolveNowMillis(payload.now);
  const usersRepository = resolvedDeps.usersRepo || usersRepo;
  const composePacks = resolvedDeps.composeCityAndNationwidePacks || composeCityAndNationwidePacks;
  const cityPackRepository = resolvedDeps.cityPacksRepo || cityPacksRepo;
  const preferenceRepo = resolvedDeps.userCityPackPreferencesRepo || userCityPackPreferencesRepo;

  const user = await usersRepository.getUser(lineUserId).catch(() => null);
  const regionKey = normalizeText(user && user.regionKey).toLowerCase();
  if (!regionKey) {
    await appendJourneyEventBestEffort({
      lineUserId,
      type: 'local_task_surface_prompted',
      ref: { reason: 'region_missing' },
      traceId: payload.traceId || null,
      requestId: payload.requestId || null
    }, resolvedDeps);
    await appendJourneyEventBestEffort({
      lineUserId,
      type: 'local_task_surface_region_setup_shortcut',
      ref: { source: 'line_command_regional_procedures', reason: 'region_missing' },
      traceId: payload.traceId || null,
      requestId: payload.requestId || null
    }, resolvedDeps);
    return `地域手続きは地域設定後に有効になります。\n${regionPrompt()}`;
  }

  const taskResult = await listUserTasks({
    userId: lineUserId,
    lineUserId,
    forceRefresh: false,
    actor: 'line_command_regional_procedures'
  }, resolvedDeps).catch(() => ({ tasks: [] }));
  const openTasks = (Array.isArray(taskResult.tasks) ? taskResult.tasks : []).filter((task) => isOpenTask(task));
  if (!openTasks.length) {
    return `地域手続き（${regionKey}）に紐づく未完了タスクはありません。`;
  }

  if (!isCityPackRecommendedTasksEnabled()) {
    const fallbackDueSoon = formatDueSoonTasksList(openTasks, nowMs);
    return `地域手続き（${regionKey}）は現在データ連携を停止中です。\n${fallbackDueSoon}`;
  }

  const preference = await preferenceRepo.getUserCityPackPreference(lineUserId).catch(() => null);
  const modulesSubscribed = normalizeCityPackModules(preference && preference.modulesSubscribed);
  const composition = await composePacks({
    regionKey,
    language: 'ja',
    limit: 30
  }, resolvedDeps).catch(() => ({ items: [], summary: { regional: 0, nationwide: 0 } }));
  const composedItems = Array.isArray(composition && composition.items) ? composition.items : [];
  const recommendedByRule = new Map();

  for (const item of composedItems) {
    const cityPackId = normalizeText(item && item.cityPackId);
    if (!cityPackId) continue;
    // eslint-disable-next-line no-await-in-loop
    const cityPack = await cityPackRepository.getCityPack(cityPackId).catch(() => null);
    const recommendedTasks = Array.isArray(cityPack && cityPack.recommendedTasks) ? cityPack.recommendedTasks : [];
    recommendedTasks.forEach((recommended) => {
      const ruleId = normalizeText(recommended && recommended.ruleId);
      if (!ruleId) return;
      if (!isModuleSubscribed(recommended && recommended.module, modulesSubscribed)) return;
      const candidate = {
        ruleId,
        packClass: resolvePackClassLabel(item && item.packClass),
        cityPackId,
        packName: normalizeText(item && item.name, cityPackId),
        priorityBoost: resolvePriorityBoost(recommended && recommended.priorityBoost)
      };
      recommendedByRule.set(ruleId, pickPreferredRecommendedRule(recommendedByRule.get(ruleId), candidate));
    });
  }

  const taskByRuleId = new Map();
  openTasks.forEach((task) => {
    const ruleId = normalizeText(task && task.ruleId);
    if (!ruleId) return;
    if (!taskByRuleId.has(ruleId)) taskByRuleId.set(ruleId, task);
  });

  const regionalTasks = Array.from(recommendedByRule.values())
    .filter((entry) => taskByRuleId.has(entry.ruleId))
    .map((entry) => ({
      ruleId: entry.ruleId,
      task: taskByRuleId.get(entry.ruleId),
      packClass: entry.packClass,
      packName: entry.packName,
      priorityBoost: entry.priorityBoost
    }))
    .sort((left, right) => {
      const rankDiff = resolvePackClassRank(right.packClass) - resolvePackClassRank(left.packClass);
      if (rankDiff !== 0) return rankDiff;
      const dueDiff = toSortDueMillis(left && left.task && left.task.dueAt) - toSortDueMillis(right && right.task && right.task.dueAt);
      if (dueDiff !== 0) return dueDiff;
      const boostDiff = resolvePriorityBoost(right && right.priorityBoost) - resolvePriorityBoost(left && left.priorityBoost);
      if (boostDiff !== 0) return boostDiff;
      return toSortText(left && left.ruleId).localeCompare(toSortText(right && right.ruleId), 'ja');
    });

  const topRegionalTasks = regionalTasks.slice(0, 5);
  await appendJourneyEventBestEffort({
    lineUserId,
    type: 'local_task_surface_opened',
    ref: {
      regionKey,
      candidateCount: regionalTasks.length,
      shownCount: topRegionalTasks.length,
      regionalPackCount: Number(composition && composition.summary && composition.summary.regional) || 0,
      nationwidePackCount: Number(composition && composition.summary && composition.summary.nationwide) || 0
    }
  }, resolvedDeps);

  if (!topRegionalTasks.length) {
    const dueSoonFallback = formatDueSoonTasksList(openTasks, nowMs);
    return `地域手続き（${regionKey}）に一致するおすすめタスクは未検出です。\n${dueSoonFallback}`;
  }

  const lines = [`地域手続き（${regionKey}）:`];
  topRegionalTasks.forEach((row, index) => {
    const key = resolveTaskKey(row.task, row.ruleId || `task_${index + 1}`);
    const title = resolveTaskTitle(row.task, key);
    const dueDate = row && row.task && row.task.dueAt ? toDateLabel(row.task.dueAt) : '-';
    lines.push(`${index + 1}. [${key}] ${title}（期限:${dueDate} / source:${resolvePackClassLabel(row.packClass)}）`);
  });
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  lines.push('補助情報のみ確認する場合は「CityPack案内」を送信してください。');
  return lines.join('\n');
}

async function buildTodoVendorReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const todoKey = normalizeText(payload.todoKey);
  const traceId = normalizeOptionalToken(payload.traceId);
  const requestId = normalizeOptionalToken(payload.requestId);
  const actor = normalizeText(payload.actor, lineUserId || 'line_user');
  if (!todoKey) {
    return {
      handled: true,
      replyText: 'TODOキーが必要です。例: TODO業者:bank_open'
    };
  }
  const task = await resolveTaskForDetail(lineUserId, todoKey, resolvedDeps);
  if (!task) {
    return {
      handled: true,
      replyText: `TODOキー「${todoKey}」が見つかりません。`
    };
  }
  const taskKeyResolution = resolveTaskDetailTaskKey(task, todoKey);
  const taskKey = normalizeText(taskKeyResolution && taskKeyResolution.taskKey, todoKey) || todoKey;
  const taskContentRepository = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const stepRuleRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const registryRepository = resolvedDeps.linkRegistryRepo || linkRegistryRepo;
  const [taskContent, stepRule] = await Promise.all([
    taskContentRepository.getTaskContent(taskKey).catch(() => null),
    task && task.ruleId ? stepRuleRepository.getStepRule(task.ruleId).catch(() => null) : Promise.resolve(null)
  ]);
  const linkIds = [];
  const fromTaskContent = Array.isArray(taskContent && taskContent.recommendedVendorLinkIds)
    ? taskContent.recommendedVendorLinkIds
    : [];
  const fromStepRule = Array.isArray(stepRule && stepRule.recommendedVendorLinkIds)
    ? stepRule.recommendedVendorLinkIds
    : [];
  fromTaskContent.concat(fromStepRule).forEach((item) => {
    const value = normalizeText(item);
    if (!value) return;
    if (linkIds.includes(value)) return;
    linkIds.push(value);
  });
  if (!linkIds.length) {
    return {
      handled: true,
      replyText: `TODO「${todoKey}」の推奨業者は未設定です。`
    };
  }

  const linkMap = new Map();
  await Promise.all(linkIds.map(async (linkId) => {
    const link = await registryRepository.getLink(linkId).catch(() => null);
    linkMap.set(linkId, link);
  }));

  const usersRepository = resolvedDeps.usersRepo || usersRepo;
  const preferenceRepository = resolvedDeps.userCityPackPreferencesRepo || userCityPackPreferencesRepo;
  const [user, preference, assignmentContext] = await Promise.all([
    usersRepository && typeof usersRepository.getUser === 'function'
      ? usersRepository.getUser(lineUserId).catch(() => null)
      : Promise.resolve(null),
    preferenceRepository && typeof preferenceRepository.getUserCityPackPreference === 'function'
      ? preferenceRepository.getUserCityPackPreference(lineUserId).catch(() => null)
      : Promise.resolve(null),
    resolveTodoVendorAssignmentContext(lineUserId, resolvedDeps)
  ]);
  const regionKey = normalizeText(user && user.regionKey).toLowerCase() || null;
  const modulesSubscribed = normalizeCityPackModules(preference && preference.modulesSubscribed);
  const taskCategory = resolveTodoVendorTaskCategory(task, taskContent, stepRule);

  const shadowEnabled = isVendorRelevanceShadowEnabled();
  const sortEnabled = shadowEnabled && isVendorRelevanceSortEnabled();
  let shadow = null;
  let sortApplied = false;

  if (shadowEnabled) {
    try {
      shadow = await computeVendorRelevanceScore({
        traceId,
        regionKey,
        modulesSubscribed,
        taskCategory,
        recommendedVendorLinkIds: linkIds.slice(),
        assignmentContext,
        candidates: linkIds.map((linkId, index) => {
          const link = linkMap.get(linkId);
          const tags = Array.isArray(link && link.tags) ? link.tags : [];
          return {
            linkId,
            position: index,
            regionKey: link && link.regionKey ? link.regionKey : null,
            regionScope: link && link.regionScope ? link.regionScope : null,
            intentTag: link && link.intentTag ? link.intentTag : null,
            audienceTag: link && link.audienceTag ? link.audienceTag : null,
            tags,
            healthState: link && link.lastHealth && link.lastHealth.state ? link.lastHealth.state : null,
            legacyHealthy: isHealthyLink(link)
          };
        })
      });
      sortApplied = sortEnabled && Array.isArray(shadow && shadow.rankedLinkIds) && shadow.rankedLinkIds.length > 0;
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'todo_vendor_shadow_scored',
        traceId,
        requestId,
        ref: {
          source: 'line_command_todo_vendor',
          todoKey,
          sortApplied
        },
        fields: {
          traceId,
          requestId,
          taskCategory,
          regionKey,
          modulesSubscribed,
          assignmentContext,
          shadow: {
            traceId: shadow && shadow.traceId ? shadow.traceId : traceId,
            currentOrderLinkIds: Array.isArray(shadow && shadow.currentOrderLinkIds) ? shadow.currentOrderLinkIds : [],
            rankedLinkIds: Array.isArray(shadow && shadow.rankedLinkIds) ? shadow.rankedLinkIds : [],
            items: Array.isArray(shadow && shadow.items)
              ? shadow.items.map((item) => ({
                linkId: item && item.linkId ? item.linkId : null,
                relevanceScore: Number.isFinite(Number(item && item.relevanceScore)) ? Number(item.relevanceScore) : null,
                scoreBreakdown: item && item.scoreBreakdown && typeof item.scoreBreakdown === 'object' ? item.scoreBreakdown : {},
                explanationCodes: Array.isArray(item && item.explanationCodes) ? item.explanationCodes : [],
                legacyHealthy: item && item.legacyHealthy === true,
                healthState: item && item.healthState ? item.healthState : 'UNKNOWN'
              }))
              : []
          }
        }
      }, resolvedDeps);
      await appendJourneyAuditBestEffort({
        actor,
        action: sortApplied ? 'journey.todo_vendor.shadow_scored.sort_applied' : 'journey.todo_vendor.shadow_scored',
        entityType: 'journey_todo_vendor',
        entityId: `${lineUserId}:${todoKey}`,
        traceId,
        requestId,
        payloadSummary: {
          todoKey,
          taskCategory,
          regionKey,
          modulesSubscribed,
          candidateCount: linkIds.length,
          sortApplied,
          currentOrderLinkIds: Array.isArray(shadow && shadow.currentOrderLinkIds) ? shadow.currentOrderLinkIds : [],
          rankedLinkIds: Array.isArray(shadow && shadow.rankedLinkIds) ? shadow.rankedLinkIds : [],
          topCandidates: Array.isArray(shadow && shadow.items)
            ? shadow.items.slice(0, 5).map((item) => ({
              linkId: item.linkId,
              relevanceScore: item.relevanceScore,
              explanationCodes: item.explanationCodes
            }))
            : []
        }
      }, resolvedDeps);
    } catch (err) {
      sortApplied = false;
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'todo_vendor_shadow_failed',
        traceId,
        requestId,
        ref: { source: 'line_command_todo_vendor', todoKey },
        fields: {
          error: normalizeText(err && err.message, 'shadow_compute_failed') || 'shadow_compute_failed'
        }
      }, resolvedDeps);
      await appendJourneyAuditBestEffort({
        actor,
        action: 'journey.todo_vendor.shadow_failed',
        entityType: 'journey_todo_vendor',
        entityId: `${lineUserId}:${todoKey}`,
        traceId,
        requestId,
        payloadSummary: {
          todoKey,
          error: normalizeText(err && err.message, 'shadow_compute_failed') || 'shadow_compute_failed'
        }
      }, resolvedDeps);
    }
  }

  const items = [];
  const warnings = [];
  const displayLinkIds = sortApplied && shadow && Array.isArray(shadow.rankedLinkIds) && shadow.rankedLinkIds.length
    ? shadow.rankedLinkIds
    : linkIds.slice(0, 3);
  for (const linkId of displayLinkIds) {
    const link = linkMap.get(linkId) || null;
    if (!link) {
      warnings.push(`${linkId}:not_found`);
      continue;
    }
    if (!isHealthyLink(link)) {
      warnings.push(`${linkId}:disabled_or_warn`);
      continue;
    }
    items.push({
      linkId,
      label: normalizeText(link.title, normalizeText(link.label, linkId)),
      url: normalizeText(link.url, '')
    });
    if (sortApplied && items.length >= 3) break;
  }

  if (!items.length) {
    return {
      handled: true,
      replyText: `TODO「${todoKey}」の推奨業者リンクは現在利用できません。`
    };
  }
  const lines = [`TODO「${todoKey}」の推奨業者:`];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.label}`);
    lines.push(item.url);
  });
  if (warnings.length) {
    lines.push(`利用不可リンク: ${warnings.join(', ')}`);
  }
  return {
    handled: true,
    replyText: lines.join('\n')
  };
}

function toDateLabel(value) {
  const iso = typeof value === 'string' ? value : '';
  if (!iso) return '-';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '-';
  return new Date(parsed).toISOString().slice(0, 10);
}

function toSortMillis(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function resolveMeaning(taskLike, fallbackKey) {
  const row = taskLike && typeof taskLike === 'object' ? taskLike : {};
  const meaning = row.meaning && typeof row.meaning === 'object' ? row.meaning : {};
  const meaningKey = normalizeText(meaning.meaningKey || row.meaningKey || fallbackKey);
  const title = normalizeText(meaning.title || row.title);
  const whyNow = normalizeText(meaning.whyNow || row.whyNow);
  return {
    meaningKey: meaningKey || null,
    title: title || null,
    whyNow: whyNow || null
  };
}

function buildUnifiedRows(tasks, legacyItems) {
  const taskRows = Array.isArray(tasks) ? tasks : [];
  const legacyRows = Array.isArray(legacyItems) ? legacyItems : [];
  const rows = [];
  const dedupeTaskKeys = new Set();
  let hiddenDuplicateCount = 0;
  let meaningFallbackCount = 0;

  taskRows.forEach((task, index) => {
    const key = normalizeText(task && task.ruleId) || normalizeText(task && task.taskId) || `task_${index + 1}`;
    const meaning = resolveMeaning(task, key);
    const dedupeKey = meaning.meaningKey || key;
    dedupeTaskKeys.add(dedupeKey);
    const title = meaning.title || key;
    if (!meaning.title || !meaning.whyNow) meaningFallbackCount += 1;
    rows.push({
      source: 'task',
      key,
      dedupeKey,
      dueAt: task && task.dueAt ? task.dueAt : null,
      dueDate: toDateLabel(task && task.dueAt),
      statusLabel: formatTodoStateLabel({
        taskStatus: task && task.status ? task.status : null,
        dueAt: task && task.dueAt ? task.dueAt : null
      }),
      blockedReasonJa: toBlockedReasonJa(task && task.blockedReason),
      title,
      whyNow: meaning.whyNow || null
    });
  });

  legacyRows.forEach((item, index) => {
    const key = normalizeText(item && item.todoKey) || `todo_${index + 1}`;
    const meaning = resolveMeaning(item, key);
    const dedupeKey = meaning.meaningKey || key;
    if (dedupeTaskKeys.has(dedupeKey)) {
      hiddenDuplicateCount += 1;
      return;
    }
    const title = meaning.title || normalizeText(item && item.title) || key;
    if (!meaning.title || !meaning.whyNow) meaningFallbackCount += 1;
    rows.push({
      source: 'legacy',
      key,
      dedupeKey,
      dueAt: item && (item.dueAt || item.nextReminderAt) ? (item.dueAt || item.nextReminderAt) : null,
      dueDate: toDateLabel(item && (item.dueAt || item.nextReminderAt)),
      statusLabel: formatTodoStateLabel(item),
      blockedReasonJa: Array.isArray(item && item.lockReasons) && item.lockReasons.length
        ? item.lockReasons.join('、')
        : null,
      title,
      whyNow: meaning.whyNow || null
    });
  });

  rows.sort((left, right) => {
    const dueCompare = toSortMillis(left && left.dueAt) - toSortMillis(right && right.dueAt);
    if (dueCompare !== 0) return dueCompare;
    return String(left && left.key || '').localeCompare(String(right && right.key || ''), 'ja');
  });

  return {
    rows,
    hiddenDuplicateCount,
    meaningFallbackCount
  };
}

function formatUnifiedTaskList(tasks, legacyItems, graphResult) {
  const unified = buildUnifiedRows(tasks, legacyItems);
  const rows = unified.rows;
  if (!rows.length) {
    return {
      text: formatTodoList([], graphResult),
      hiddenDuplicateCount: unified.hiddenDuplicateCount,
      meaningFallbackCount: unified.meaningFallbackCount,
      presentedCount: 0
    };
  }
  const lines = ['現在のやること一覧です。'];
  rows.slice(0, 10).forEach((row, index) => {
    const whyNow = row.whyNow ? ` / 理由:${row.whyNow}` : '';
    const blocked = row.blockedReasonJa ? ` / ブロック:${row.blockedReasonJa}` : '';
    lines.push(`${index + 1}. [${row.key}] ${row.title}（期限:${row.dueDate} / 状態:${row.statusLabel}${blocked}${whyNow}）`);
  });
  const topActionable = formatTopActionableTasks(graphResult);
  if (topActionable) lines.push(topActionable);
  lines.push('完了する場合は「TODO完了:todoKey」を送信してください。');
  lines.push('進行中にする場合は「TODO進行中:todoKey」、未着手へ戻す場合は「TODO未着手:todoKey」を送信してください。');
  lines.push('後で対応する場合は「TODOスヌーズ:todoKey:3」（3日）を送信してください。');
  lines.push('詳細を見る場合は「TODO詳細:todoKey」を送信してください。');
  return {
    text: lines.join('\n'),
    hiddenDuplicateCount: unified.hiddenDuplicateCount,
    meaningFallbackCount: unified.meaningFallbackCount,
    presentedCount: rows.length
  };
}

async function auditTodoListPresentation(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const actor = payload.actor || payload.lineUserId || 'line_user';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;
  const entityId = payload.lineUserId || 'line_user';
  const presentedCount = Number(payload.presentedCount) || 0;
  const hiddenDuplicateCount = Number(payload.hiddenDuplicateCount) || 0;
  const meaningFallbackCount = Number(payload.meaningFallbackCount) || 0;

  await appendAuditLog({
    actor,
    action: 'tasks.view.presented',
    entityType: 'task_view',
    entityId,
    traceId,
    requestId,
    payloadSummary: {
      presentedCount,
      source: payload.source || 'line_todo_list'
    }
  }).catch(() => null);

  if (hiddenDuplicateCount > 0) {
    await appendAuditLog({
      actor,
      action: 'tasks.view.hidden_duplicate',
      entityType: 'task_view',
      entityId,
      traceId,
      requestId,
      payloadSummary: {
        hiddenDuplicateCount,
        source: payload.source || 'line_todo_list'
      }
    }).catch(() => null);
  }

  if (meaningFallbackCount > 0) {
    await appendAuditLog({
      actor,
      action: 'tasks.meaning.fallback_used',
      entityType: 'task_view',
      entityId,
      traceId,
      requestId,
      payloadSummary: {
        fallbackCount: meaningFallbackCount,
        source: payload.source || 'line_todo_list'
      }
    }).catch(() => null);
  }
}

function resolveSnoozeUntil(command, nowIso) {
  if (command && command.snoozeUntil) {
    const date = String(command.snoozeUntil).trim();
    if (date) return `${date}T09:00:00.000Z`;
  }
  const days = Number(command && command.snoozeDays);
  const safeDays = Number.isInteger(days) && days >= 1 && days <= 30 ? days : 3;
  const base = Date.parse(nowIso || new Date().toISOString());
  const ms = Number.isFinite(base) ? base + (safeDays * 24 * 60 * 60 * 1000) : Date.now() + (safeDays * 24 * 60 * 60 * 1000);
  return new Date(ms).toISOString();
}

const CITY_PACK_MODULE_LABELS = Object.freeze({
  schools: '学校',
  healthcare: '医療',
  driving: '運転',
  housing: '住居',
  utilities: '生活インフラ'
});

function normalizeCityPackModules(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return;
    if (!ALLOWED_MODULES.includes(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
}

function normalizeCityPackModule(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  if (!ALLOWED_MODULES.includes(normalized)) return null;
  return normalized;
}

function buildCityPackModulePostback(action, module) {
  const params = new URLSearchParams();
  params.set('action', action);
  if (module) params.set('module', module);
  return params.toString();
}

function formatCityPackModuleStatusLine(modules) {
  const subscribed = normalizeCityPackModules(modules);
  if (!subscribed.length) return '全モジュール購読（既定）';
  return subscribed.map((module) => CITY_PACK_MODULE_LABELS[module] || module).join(' / ');
}

function buildCityPackModuleGuideFlex(modulesSubscribed) {
  const subscribed = normalizeCityPackModules(modulesSubscribed);
  const contents = [
    {
      type: 'text',
      text: 'CityPackモジュール購読',
      weight: 'bold',
      size: 'md',
      wrap: true
    },
    {
      type: 'text',
      text: `現在: ${formatCityPackModuleStatusLine(subscribed)}`,
      size: 'sm',
      color: '#666666',
      wrap: true,
      margin: 'sm'
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      margin: 'md',
      action: {
        type: 'postback',
        label: '購読状況を更新',
        data: buildCityPackModulePostback('city_pack_module_status'),
        displayText: 'CityPack状況'
      }
    }
  ];
  ALLOWED_MODULES.forEach((module) => {
    const label = CITY_PACK_MODULE_LABELS[module] || module;
    const isSubscribed = subscribed.length === 0 || subscribed.includes(module);
    const action = isSubscribed ? 'city_pack_module_unsubscribe' : 'city_pack_module_subscribe';
    const buttonLabel = isSubscribed ? `解除: ${label}` : `購読: ${label}`;
    contents.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      margin: 'sm',
      action: {
        type: 'postback',
        label: buttonLabel,
        data: buildCityPackModulePostback(action, module),
        displayText: isSubscribed ? `CityPack解除:${module}` : `CityPack購読:${module}`
      }
    });
  });
  return {
    type: 'flex',
    altText: 'CityPackモジュール購読',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents
      }
    }
  };
}

function resolveScheduleStage(schedule) {
  const payload = schedule && typeof schedule === 'object' ? schedule : {};
  if (payload.stage && typeof payload.stage === 'string' && payload.stage.trim()) return payload.stage.trim();
  const now = new Date().toISOString().slice(0, 10);
  const departure = payload.departureDate || null;
  const assignment = payload.assignmentDate || null;
  if (departure && now < departure) return 'pre_departure';
  if (assignment && now >= assignment) return 'arrived';
  if (departure && now >= departure) return 'departure_ready';
  return 'unspecified';
}

async function resolveTaskForDetail(lineUserId, todoKey, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const taskRepository = resolvedDeps.tasksRepo || tasksRepo;
  const directTaskId = `${lineUserId}__${todoKey}`;
  const direct = await taskRepository.getTask(directTaskId).catch(() => null);
  if (direct) return direct;
  const listed = await listUserTasks({
    userId: lineUserId,
    lineUserId,
    forceRefresh: false,
    actor: 'line_command_todo_detail'
  }, resolvedDeps).catch(() => ({ tasks: [] }));
  const tasks = Array.isArray(listed.tasks) ? listed.tasks : [];
  return tasks.find((row) => normalizeText(row && row.ruleId, '') === todoKey)
    || tasks.find((row) => normalizeText(row && row.taskId, '') === directTaskId)
    || null;
}

async function handleTodoDetailCommand(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const todoKey = normalizeText(payload.todoKey);
  if (!todoKey) {
    return {
      handled: true,
      replyText: 'TODOキーが必要です。例: TODO詳細:visa_documents'
    };
  }
  const task = await resolveTaskForDetail(lineUserId, todoKey, resolvedDeps);
  if (!task) {
    return {
      handled: true,
      replyText: `TODOキー「${todoKey}」が見つかりません。`
    };
  }

  const taskKeyResolution = resolveTaskDetailTaskKey(task, todoKey);
  const taskKey = normalizeText(taskKeyResolution && taskKeyResolution.taskKey, todoKey) || todoKey;
  const taskContentRepository = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const taskContent = await taskContentRepository.getTaskContent(taskKey).catch(() => null);
  const fallbackTitle = normalizeText(
    task && task.meaning && task.meaning.title,
    normalizeText(task && task.ruleId, normalizeText(task && task.taskId, todoKey))
  );
  const fallbackContent = {
    taskKey,
    title: fallbackTitle,
    timeMin: null,
    timeMax: null,
    checklistItems: [],
    manualText: null,
    failureText: null,
    videoLinkId: null,
    actionLinkId: null
  };
  const links = await resolveTaskContentLinks(taskContent || fallbackContent, resolvedDeps).catch(() => ({
    video: { ok: false, id: null, link: null, reason: 'resolver_error' },
    action: { ok: false, id: null, link: null, reason: 'resolver_error' },
    warnings: ['link resolver failed']
  }));
  const flexMessage = renderTaskFlexMessage({
    task,
    taskContent: taskContent || fallbackContent,
    linkRefs: links,
    todoKey
  });
  const attribution = buildTaskDetailAttribution({
    attribution: payload.attribution,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null
  });
  await appendJourneyEventBestEffort({
    lineUserId,
    type: 'todo_detail_opened',
    ref: {
      source: 'line_command_todo_detail',
      todoKey,
      taskKey,
      taskKeySource: taskKeyResolution && taskKeyResolution.source ? taskKeyResolution.source : null
    },
    fields: {
      attribution,
      attributionKey: buildTaskDetailAttributionKey(lineUserId, todoKey, attribution),
      hasManualText: Boolean(normalizeText((taskContent || fallbackContent).manualText)),
      hasFailureText: Boolean(normalizeText((taskContent || fallbackContent).failureText)),
      linkWarningCount: Array.isArray(links && links.warnings) ? links.warnings.length : 0
    }
  }, resolvedDeps);
  return {
    handled: true,
    replyMessage: flexMessage
  };
}

async function handleTodoDetailSectionContinueCommand(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const todoKey = normalizeText(payload.todoKey);
  const section = normalizeText(payload.section).toLowerCase();
  const startChunk = Number(payload.startChunk);
  if (!todoKey || !section) {
    return {
      handled: true,
      replyText: '続き表示の形式が不正です。例: TODO詳細続き:todoKey:manual:2'
    };
  }
  const reply = await buildTaskDetailSectionReply({
    lineUserId: normalizeText(payload.lineUserId),
    todoKey,
    section,
    startChunk: Number.isInteger(startChunk) && startChunk >= 1 ? startChunk : 1,
    attribution: buildTaskDetailAttribution({
      attribution: payload.attribution,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null
    })
  }, resolvedDeps);
  const sectionMeta = reply && reply.sectionMeta && typeof reply.sectionMeta === 'object' ? reply.sectionMeta : null;
  if (reply && reply.handled === true && sectionMeta) {
    const attribution = buildTaskDetailAttribution({
      attribution: sectionMeta.attribution,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null
    });
    const eventType = Number(sectionMeta.startChunk) > 1 ? 'todo_detail_section_continue' : 'todo_detail_section_opened';
    await appendJourneyEventBestEffort({
      lineUserId: normalizeText(payload.lineUserId),
      type: eventType,
      ref: {
        source: 'line_command_todo_detail_section_continue',
        todoKey,
        section: sectionMeta.section || section
      },
      fields: {
        sectionMeta,
        attribution,
        attributionKey: buildTaskDetailAttributionKey(normalizeText(payload.lineUserId), todoKey, attribution)
      }
    }, resolvedDeps);
  }
  return reply;
}

async function handleJourneyLineCommand(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const text = normalizeText(payload.text);
  if (!lineUserId || !text) return { handled: false };

  const command = parseJourneyLineCommand(text);
  if (!command) return { handled: false };

  const profileRepo = resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo;
  const scheduleRepo = resolvedDeps.userJourneySchedulesRepo || userJourneySchedulesRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;

  if (command.action === 'invalid_household') {
    return {
      handled: true,
      replyText: '属性の形式が不正です。例: 属性:単身 / 属性:夫婦 / 属性:帯同1 / 属性:帯同2'
    };
  }

  if (command.action === 'invalid_departure_date' || command.action === 'invalid_assignment_date') {
    return {
      handled: true,
      replyText: '日付形式が不正です。YYYY-MM-DD 形式で入力してください。例: 渡航日:2026-04-01'
    };
  }

  if (command.action === 'set_household') {
    const saved = await profileRepo.upsertUserJourneyProfile(lineUserId, {
      householdType: command.householdType,
      [JOURNEY_SCENARIO_MIRROR_FIELD]: command ? command[JOURNEY_SCENARIO_MIRROR_FIELD] : null,
      source: 'line_command'
    }, lineUserId);
    const syncResult = await runSyncJourneyTodoPlan({
      lineUserId,
      profile: saved,
      source: 'line_command_household'
    }, resolvedDeps);
    await runSyncUserTasksProjection({
      userId: lineUserId,
      lineUserId,
      actor: 'line_command_household'
    }, resolvedDeps).catch(() => null);

    try {
      const planInfo = await resolvePlan(lineUserId);
      await applyPersonalizedRichMenu({
        lineUserId,
        plan: planInfo.plan,
        householdType: saved && saved.householdType ? saved.householdType : null,
        source: 'line_command_household'
      });
    } catch (_err) {
      // best effort
    }

    return {
      handled: true,
      replyText: `属性を「${HOUSEHOLD_LABEL[saved.householdType] || saved.householdType}」に更新しました。\nTODO同期: ${syncResult.syncedCount}件`
    };
  }

  if (command.action === 'set_departure_date' || command.action === 'set_assignment_date') {
    const isAssignmentUpdate = command.action === 'set_assignment_date';
    const existing = await scheduleRepo.getUserJourneySchedule(lineUserId);
    const patch = {
      departureDate: command.action === 'set_departure_date' ? command.departureDate : (existing && existing.departureDate) || null,
      assignmentDate: command.action === 'set_assignment_date' ? command.assignmentDate : (existing && existing.assignmentDate) || null,
      source: 'line_command'
    };
    patch.stage = resolveScheduleStage(patch);
    const savedSchedule = await scheduleRepo.upsertUserJourneySchedule(lineUserId, patch, lineUserId);
    let syncResult = { syncedCount: 0 };
    try {
      if (isAssignmentUpdate) {
        await appendJourneyAuditBestEffort({
          actor: payload.actor || lineUserId,
          action: 'journey.assignment_recompute.enqueued',
          entityType: 'journey_schedule',
          entityId: lineUserId,
          traceId: payload.traceId || null,
          requestId: payload.requestId || null,
          payloadSummary: {
            assignmentDate: patch.assignmentDate,
            departureDate: patch.departureDate,
            stage: patch.stage
          }
        }, resolvedDeps);
      }
      syncResult = await runSyncJourneyTodoPlan({
        lineUserId,
        schedule: savedSchedule,
        source: 'line_command_schedule'
      }, resolvedDeps);
      await runSyncUserTasksProjection({
        userId: lineUserId,
        lineUserId,
        actor: 'line_command_schedule'
      }, resolvedDeps).catch(() => null);
      if (isAssignmentUpdate) {
        await appendJourneyAuditBestEffort({
          actor: payload.actor || lineUserId,
          action: 'journey.assignment_recompute.completed',
          entityType: 'journey_schedule',
          entityId: lineUserId,
          traceId: payload.traceId || null,
          requestId: payload.requestId || null,
          payloadSummary: {
            assignmentDate: patch.assignmentDate,
            departureDate: patch.departureDate,
            stage: patch.stage,
            syncedCount: Number(syncResult && syncResult.syncedCount) || 0
          }
        }, resolvedDeps);
      }
    } catch (err) {
      if (isAssignmentUpdate) {
        await appendJourneyAuditBestEffort({
          actor: payload.actor || lineUserId,
          action: 'journey.assignment_recompute.failed',
          entityType: 'journey_schedule',
          entityId: lineUserId,
          traceId: payload.traceId || null,
          requestId: payload.requestId || null,
          payloadSummary: {
            assignmentDate: patch.assignmentDate,
            departureDate: patch.departureDate,
            stage: patch.stage,
            error: normalizeText(err && err.message, 'recompute_failed') || 'recompute_failed'
          }
        }, resolvedDeps);
      }
      throw err;
    }

    const dateLabel = command.action === 'set_departure_date' ? '渡航日' : '着任日';
    const dateValue = command.action === 'set_departure_date' ? command.departureDate : command.assignmentDate;
    return {
      handled: true,
      replyText: `${dateLabel}を ${dateValue} に更新しました。\nTODO同期: ${syncResult.syncedCount}件`
    };
  }

  if (command.action === 'todo_list') {
    const graphResult = await recomputeJourneyTaskGraph({
      lineUserId,
      actor: 'line_command_todo_list',
      failOnCycle: false
    }, resolvedDeps).catch(() => ({ ok: false }));
    const taskResult = await listUserTasks({
      userId: lineUserId,
      lineUserId,
      forceRefresh: false,
      actor: 'line_command_todo_list'
    }, resolvedDeps).catch(() => ({ ok: false, tasks: [] }));
    const tasks = Array.isArray(taskResult.tasks) ? taskResult.tasks : [];
    if (isJourneyUnifiedViewEnabled()) {
      const items = await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 50 });
      const computedGraph = computeTaskGraph({ todoItems: items, nowMs: Date.now() });
      const unified = formatUnifiedTaskList(tasks, items, graphResult && graphResult.ok ? graphResult : computedGraph);
      await auditTodoListPresentation({
        lineUserId,
        actor: 'line_command_todo_list',
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        presentedCount: unified.presentedCount,
        hiddenDuplicateCount: unified.hiddenDuplicateCount,
        meaningFallbackCount: unified.meaningFallbackCount,
        source: 'line_todo_list'
      });
      return {
        handled: true,
        replyText: unified.text
      };
    }
    if (tasks.length > 0) {
      return {
        handled: true,
        replyText: formatTaskList(tasks, graphResult)
      };
    }
    const items = await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 50 });
    const computedGraph = computeTaskGraph({ todoItems: items, nowMs: Date.now() });
    return {
      handled: true,
      replyText: formatTodoList(items, graphResult && graphResult.ok ? graphResult : computedGraph)
    };
  }

  if (command.action === 'next_tasks') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    const result = await computeNextTasks({
      lineUserId,
      userId: lineUserId,
      actor: 'line_command_next_tasks'
    }, resolvedDeps).catch(() => ({ tasks: [] }));
    const nextActions = (Array.isArray(result && result.tasks) ? result.tasks : [])
      .slice(0, 3)
      .map((task, index) => ({
        key: resolveTaskKey(task, `task_${index + 1}`),
        status: normalizeText(task && task.status, 'open') || 'open'
      }));
    await appendJourneyEventBestEffort({
      lineUserId,
      type: 'next_action_shown',
      ref: { source: 'line_command_next_tasks', count: nextActions.length },
      fields: { nextActions }
    }, resolvedDeps);
    return {
      handled: true,
      replyText: formatNextTasksList(result)
    };
  }

  if (command.action === 'due_soon_tasks') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    const result = await listUserTasks({
      lineUserId,
      userId: lineUserId,
      forceRefresh: false,
      actor: 'line_command_due_soon_tasks'
    }, resolvedDeps).catch(() => ({ tasks: [] }));
    const nowMs = resolveNowMillis(payload.now);
    return {
      handled: true,
      replyText: formatDueSoonTasksList(result && result.tasks, nowMs)
    };
  }

  if (command.action === 'regional_procedures') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    if (!isJourneyRegionalProceduresEnabled()) {
      return {
        handled: true,
        replyText: '地域手続き導線は現在停止中です。'
      };
    }
    const textReply = await buildRegionalProceduresReply({
      lineUserId,
      now: payload.now || null,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null
    }, resolvedDeps).catch(() => '地域手続きの取得に失敗しました。時間をおいて再度お試しください。');
    return {
      handled: true,
      replyText: textReply
    };
  }

  if (command.action === 'category_view_missing') {
    return {
      handled: true,
      replyText: `カテゴリ指定が不正です。利用可能: ${TASK_CATEGORIES.join(', ')}`
    };
  }

  if (command.action === 'category_view') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    const textReply = await buildCategoryViewReply({
      lineUserId,
      category: command.category || null
    }, resolvedDeps).catch(() => 'カテゴリ表示の取得に失敗しました。');
    return {
      handled: true,
      replyText: textReply
    };
  }

  if (command.action === 'delivery_history') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    const deliveriesRepository = resolvedDeps.deliveriesRepo || deliveriesRepo;
    const rows = await deliveriesRepository.listDeliveriesByUser(lineUserId, 20).catch(() => []);
    return {
      handled: true,
      replyText: formatDeliveryHistory(rows)
    };
  }

  if (command.action === 'support_guide') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    await appendJourneyEventBestEffort({
      lineUserId,
      type: 'support_guide_opened',
      ref: {
        source: 'line_command_support_guide'
      },
      fields: {
        supportMode: 'guide_only',
        ticketCreated: false,
        handoff: 'line_free_text'
      }
    }, resolvedDeps);
    return {
      handled: true,
      replyText: '相談導線を開きました。\nこの操作は「案内表示 + 利用イベント記録」のみで、チケット作成は行いません。\n困っている内容を1メッセージで送ってください。\n例: 口座開設の必要書類が分からない'
    };
  }

  if (command.action === 'todo_vendor_missing') {
    return {
      handled: true,
      replyText: 'TODOキーが必要です。例: TODO業者:bank_open'
    };
  }

  if (command.action === 'todo_vendor') {
    if (!isRichMenuTaskOsEntryEnabled()) {
      return {
        handled: true,
        replyText: 'Task OS入口は現在停止中です。'
      };
    }
    return buildTodoVendorReply({
      lineUserId,
      todoKey: command.todoKey,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      actor: payload.actor || lineUserId
    }, resolvedDeps);
  }

  if (command.action === 'todo_detail') {
    if (!isTaskDetailLineEnabled()) {
      return {
        handled: true,
        replyText: 'タスク詳細表示は現在停止中です。'
      };
    }
    return handleTodoDetailCommand({
      lineUserId,
      todoKey: command.todoKey,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      attribution: payload.attribution || null
    }, resolvedDeps);
  }

  if (command.action === 'todo_detail_section_continue') {
    if (!isTaskDetailLineEnabled()) {
      return {
        handled: true,
        replyText: 'タスク詳細表示は現在停止中です。'
      };
    }
    return handleTodoDetailSectionContinueCommand({
      lineUserId,
      todoKey: command.todoKey,
      section: command.section,
      startChunk: command.startChunk,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      attribution: payload.attribution || null
    }, resolvedDeps);
  }

  if (command.action === 'city_pack_module_guide') {
    if (!isCityPackModuleSubscriptionEnabled()) {
      return {
        handled: true,
        replyText: 'CityPackモジュール購読は現在停止中です。'
      };
    }
    const preferenceRepo = resolvedDeps.userCityPackPreferencesRepo || userCityPackPreferencesRepo;
    const current = await preferenceRepo.getUserCityPackPreference(lineUserId).catch(() => null);
    return {
      handled: true,
      replyMessage: buildCityPackModuleGuideFlex(current && current.modulesSubscribed)
    };
  }

  if (command.action === 'city_pack_module_status') {
    if (!isCityPackModuleSubscriptionEnabled()) {
      return {
        handled: true,
        replyText: 'CityPackモジュール購読は現在停止中です。'
      };
    }
    const preferenceRepo = resolvedDeps.userCityPackPreferencesRepo || userCityPackPreferencesRepo;
    const current = await preferenceRepo.getUserCityPackPreference(lineUserId).catch(() => null);
    const modulesSubscribed = normalizeCityPackModules(current && current.modulesSubscribed);
    return {
      handled: true,
      replyText: `CityPack購読状況: ${formatCityPackModuleStatusLine(modulesSubscribed)}\n変更する場合は「CityPack案内」を送信してください。`
    };
  }

  if (command.action === 'city_pack_module_subscribe_missing' || command.action === 'city_pack_module_unsubscribe_missing') {
    return {
      handled: true,
      replyText: 'モジュール指定が不正です。例: CityPack購読:schools'
    };
  }

  if (command.action === 'city_pack_module_subscribe' || command.action === 'city_pack_module_unsubscribe') {
    if (!isCityPackModuleSubscriptionEnabled()) {
      return {
        handled: true,
        replyText: 'CityPackモジュール購読は現在停止中です。'
      };
    }
    const module = normalizeCityPackModule(command.module);
    if (!module) {
      return {
        handled: true,
        replyText: 'モジュール指定が不正です。schools/healthcare/driving/housing/utilities から選択してください。'
      };
    }
    const preferenceRepo = resolvedDeps.userCityPackPreferencesRepo || userCityPackPreferencesRepo;
    const existing = await preferenceRepo.getUserCityPackPreference(lineUserId).catch(() => null);
    const current = normalizeCityPackModules(existing && existing.modulesSubscribed);
    let next = current.slice();
    if (command.action === 'city_pack_module_subscribe') {
      if (current.length === 0) {
        next = [];
      } else if (!next.includes(module)) {
        next.push(module);
      }
    } else if (current.length === 0) {
      next = ALLOWED_MODULES.filter((item) => item !== module);
    } else {
      next = next.filter((item) => item !== module);
    }
    if (next.length === ALLOWED_MODULES.length) next = [];
    const saved = await preferenceRepo.upsertUserCityPackPreference(lineUserId, {
      modulesSubscribed: next,
      source: 'line_city_pack_module_postback'
    }, lineUserId);
    return {
      handled: true,
      replyText: `CityPack購読を更新しました: ${formatCityPackModuleStatusLine(saved && saved.modulesSubscribed)}`
    };
  }

  if (command.action === 'todo_complete') {
    const todoKey = normalizeText(command.todoKey);
    if (!todoKey) {
      return {
        handled: true,
        replyText: 'TODOキーが必要です。例: TODO完了:visa_documents'
      };
    }
    const taskId = `${lineUserId}__${todoKey}`;
    const existingTodo = await todoRepo.getJourneyTodoItem(lineUserId, todoKey).catch(() => null);
    const wasLocked = existingTodo && existingTodo.graphStatus === 'locked';
    const patchedTask = await patchTaskState({
      userId: lineUserId,
      taskId,
      action: 'done',
      actor: 'line_command_todo_complete'
    }, resolvedDeps).catch(async () => {
      const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
      if (!existing) return null;
      await todoRepo.markJourneyTodoCompleted(lineUserId, todoKey, {});
      return { ok: true };
    });
    if (!patchedTask) {
      return {
        handled: true,
        replyText: `TODOキー「${todoKey}」が見つかりません。`
      };
    }
    const graph = await recomputeJourneyTaskGraph({
      lineUserId,
      actor: 'line_command_todo_complete',
      failOnCycle: false
    }, resolvedDeps).catch(() => ({ ok: false, topActionableTasks: [] }));
    await appendJourneyEventBestEffort({
      lineUserId,
      type: 'next_action_completed',
      ref: { source: 'line_command_todo_complete', todoKey },
      fields: { nextActions: [{ key: todoKey, status: 'done' }] }
    }, resolvedDeps);
    const completionAttribution = buildTaskDetailAttribution({
      attribution: payload.attribution,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null
    });
    await appendJourneyEventBestEffort({
      lineUserId,
      type: 'todo_detail_completed',
      ref: { source: 'line_command_todo_complete', todoKey },
      fields: {
        attribution: completionAttribution,
        attributionKey: buildTaskDetailAttributionKey(lineUserId, todoKey, completionAttribution)
      }
    }, resolvedDeps);
    if (wasLocked) {
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'blocker_resolved',
        ref: { source: 'line_command_todo_complete', todoKey }
      }, resolvedDeps);
    }
    const stats = await refreshJourneyTodoStats(lineUserId, resolvedDeps);
    const topActionable = formatTopActionableTasks(graph);
    return {
      handled: true,
      replyText: `TODO「${todoKey}」を完了にしました。素晴らしい進捗です。\n未完了: ${stats.openCount}件 / 期限超過: ${stats.overdueCount}件${topActionable ? `\n${topActionable}` : ''}`
    };
  }

  if (command.action === 'todo_in_progress' || command.action === 'todo_not_started') {
    const todoKey = normalizeText(command.todoKey);
    if (!todoKey) {
      return {
        handled: true,
        replyText: 'TODOキーが必要です。例: TODO進行中:visa_documents'
      };
    }
    const taskId = `${lineUserId}__${todoKey}`;
    const existingTodo = await todoRepo.getJourneyTodoItem(lineUserId, todoKey).catch(() => null);
    const wasLocked = existingTodo && existingTodo.graphStatus === 'locked';
    const progressState = command.action === 'todo_in_progress' ? 'in_progress' : 'not_started';
    const patchedTask = await patchTaskState({
      userId: lineUserId,
      taskId,
      action: progressState === 'in_progress' ? 'doing' : 'todo',
      actor: 'line_command_todo_progress'
    }, resolvedDeps).catch(async () => {
      const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
      if (!existing) return null;
      if (existing.status === 'completed' || existing.status === 'skipped') return false;
      await todoRepo.setJourneyTodoProgressState(lineUserId, todoKey, progressState, {});
      return { ok: true };
    });
    if (patchedTask === null) {
      return {
        handled: true,
        replyText: `TODOキー「${todoKey}」が見つかりません。`
      };
    }
    if (patchedTask === false) {
      return {
        handled: true,
        replyText: `TODO「${todoKey}」はすでに完了済みです。`
      };
    }
    const graph = await recomputeJourneyTaskGraph({
      lineUserId,
      actor: 'line_command_todo_progress',
      failOnCycle: false
    }, resolvedDeps).catch(() => ({ ok: false, topActionableTasks: [] }));
    if (wasLocked) {
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'blocker_resolved',
        ref: { source: 'line_command_todo_progress', todoKey }
      }, resolvedDeps);
    }
    const stats = await refreshJourneyTodoStats(lineUserId, resolvedDeps);
    const topActionable = formatTopActionableTasks(graph);
    return {
      handled: true,
      replyText: `TODO「${todoKey}」を${progressState === 'in_progress' ? '進行中' : '未着手'}に更新しました。\n未完了: ${stats.openCount}件 / 期限超過: ${stats.overdueCount}件${topActionable ? `\n${topActionable}` : ''}`
    };
  }

  if (command.action === 'todo_snooze') {
    const todoKey = normalizeText(command.todoKey);
    if (!todoKey) {
      return {
        handled: true,
        replyText: 'TODOキーが必要です。例: TODOスヌーズ:visa_documents:3'
      };
    }
    const taskId = `${lineUserId}__${todoKey}`;
    const nowIso = new Date().toISOString();
    const snoozeUntil = resolveSnoozeUntil(command, nowIso);
    const patched = await patchTaskState({
      userId: lineUserId,
      taskId,
      action: 'snooze',
      snoozeUntil,
      actor: 'line_command_todo_snooze'
    }, resolvedDeps).catch(async () => {
      const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
      if (!existing) return null;
      await todoRepo.upsertJourneyTodoItem(lineUserId, todoKey, {
        journeyState: 'snoozed',
        snoozeUntil,
        nextReminderAt: snoozeUntil
      });
      return { ok: true };
    });
    if (!patched) {
      return {
        handled: true,
        replyText: `TODOキー「${todoKey}」が見つかりません。`
      };
    }
    const stats = await refreshJourneyTodoStats(lineUserId, resolvedDeps);
    return {
      handled: true,
      replyText: `TODO「${todoKey}」をスヌーズしました（解除予定: ${String(snoozeUntil).slice(0, 10)}）。\n未完了: ${stats.openCount}件 / 期限超過: ${stats.overdueCount}件`
    };
  }

  return { handled: false };
}

module.exports = {
  handleJourneyLineCommand
};
