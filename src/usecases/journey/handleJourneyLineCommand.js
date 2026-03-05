'use strict';

const { parseJourneyLineCommand } = require('../../domain/journey/lineCommandParsers');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { resolvePlan } = require('../billing/planGate');
const { syncJourneyTodoPlan, refreshJourneyTodoStats } = require('./syncJourneyTodoPlan');
const { applyPersonalizedRichMenu } = require('./applyPersonalizedRichMenu');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');
const { listUserTasks } = require('../tasks/listUserTasks');
const { computeNextTasks } = require('../tasks/computeNextTasks');
const { patchTaskState } = require('../tasks/patchTaskState');
const { syncUserTasksProjection } = require('../tasks/syncUserTasksProjection');
const { renderTaskFlexMessage } = require('../tasks/renderTaskFlexMessage');
const { validateTaskContent } = require('../tasks/validateTaskContent');
const { buildTaskDetailSectionReply } = require('./taskDetailSectionReply');
const { JOURNEY_SCENARIO_MIRROR_FIELD } = require('../../domain/constants');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { toBlockedReasonJa } = require('../../domain/tasks/blockedReasonJa');
const {
  isJourneyUnifiedViewEnabled,
  isNextTaskEngineEnabled,
  getJourneyNextTaskMax,
  isTaskDetailLineEnabled
} = require('../../domain/tasks/featureFlags');
const { TASK_CATEGORY_VALUES } = require('../../domain/tasks/usExpatTaxonomy');

const HOUSEHOLD_LABEL = Object.freeze({
  single: '単身',
  couple: '夫婦',
  accompany1: '帯同1',
  accompany2: '帯同2'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
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
  return lines.join('\n');
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

function safeTaskTitle(task, fallback) {
  const row = task && typeof task === 'object' ? task : {};
  const meaning = row.meaning && typeof row.meaning === 'object' ? row.meaning : {};
  return normalizeText(meaning.title) || normalizeText(row.title) || fallback;
}

async function loadRuleMap(ruleIds, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const ruleRepo = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const map = new Map();
  const ids = Array.from(new Set((Array.isArray(ruleIds) ? ruleIds : []).map((item) => normalizeText(item)).filter(Boolean)));
  for (const ruleId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const rule = await ruleRepo.getStepRule(ruleId).catch(() => null);
    if (rule) map.set(ruleId, rule);
  }
  return map;
}

function normalizeCategoryFilter(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return null;
  if (!TASK_CATEGORY_VALUES.includes(normalized)) return null;
  return normalized;
}

async function buildNextTasksReply(lineUserId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const max = getJourneyNextTaskMax();
  const result = await computeNextTasks({
    lineUserId,
    limit: max,
    actor: 'line_command_next_tasks',
    forceRefresh: true
  }, resolvedDeps).catch(() => ({ tasks: [] }));
  const pick = Array.isArray(result.tasks) ? result.tasks : [];
  if (!pick.length) {
    return '今日の優先タスクはありません。まずは「TODO一覧」を確認してください。';
  }
  const lines = ['今日の3つです。'];
  pick.forEach((task, index) => {
    const due = task && task.dueAt ? String(task.dueAt).slice(0, 10) : '-';
    lines.push(`${index + 1}. [${task.ruleId}] ${safeTaskTitle(task, task.ruleId)}（期限:${due}）`);
  });
  lines.push('詳細は「TODO詳細:todoKey」で確認できます。');
  return lines.join('\n');
}

async function buildCategoryViewReply(lineUserId, category, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const requested = normalizeCategoryFilter(category);
  const taskResult = await listUserTasks({
    userId: lineUserId,
    lineUserId,
    forceRefresh: false,
    actor: 'line_command_category_view'
  }, resolvedDeps).catch(() => ({ tasks: [] }));
  const tasks = Array.isArray(taskResult.tasks) ? taskResult.tasks : [];
  const rules = await loadRuleMap(tasks.map((item) => item.ruleId), resolvedDeps);
  const decorated = tasks.map((task) => {
    const rule = rules.get(task.ruleId) || {};
    return {
      task,
      category: normalizeCategoryFilter(rule.category) || 'LIFE_SETUP'
    };
  });

  if (!requested) {
    const counts = new Map();
    decorated.forEach((row) => {
      counts.set(row.category, (counts.get(row.category) || 0) + 1);
    });
    const lines = ['カテゴリ別件数です。'];
    TASK_CATEGORY_VALUES.forEach((key) => {
      lines.push(`- ${key}: ${counts.get(key) || 0}件`);
    });
    lines.push('絞り込みは「カテゴリ:IMMIGRATION」の形式で送信してください。');
    return lines.join('\n');
  }

  const filtered = decorated.filter((row) => row.category === requested).slice(0, 10);
  if (!filtered.length) {
    return `${requested} のタスクは現在ありません。`;
  }
  const lines = [`カテゴリ ${requested} のタスクです。`];
  filtered.forEach((row, index) => {
    const due = row.task && row.task.dueAt ? String(row.task.dueAt).slice(0, 10) : '-';
    lines.push(`${index + 1}. [${row.task.ruleId}] ${safeTaskTitle(row.task, row.task.ruleId)}（期限:${due}）`);
  });
  return lines.join('\n');
}

async function buildDeliveryHistoryReply(lineUserId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.deliveriesRepo || deliveriesRepo;
  const rows = await repository.listDeliveriesByUser(lineUserId, 5).catch(() => []);
  if (!Array.isArray(rows) || !rows.length) {
    return '通知履歴はまだありません。';
  }
  const lines = ['直近の通知履歴です。'];
  rows.slice(0, 5).forEach((row, index) => {
    const sentAt = row && row.sentAt ? String(row.sentAt).slice(0, 19).replace('T', ' ') : '-';
    const category = normalizeText(row && row.notificationCategory, '-');
    const state = row && row.delivered === true ? 'delivered' : (normalizeText(row && row.state, 'queued') || 'queued');
    lines.push(`${index + 1}. ${sentAt} / ${category} / ${state}`);
  });
  return lines.join('\n');
}

function isLinkInactive(link) {
  if (!link || typeof link !== 'object') return true;
  if (link.enabled === false) return true;
  const state = normalizeText(link.lastHealth && link.lastHealth.state).toUpperCase();
  return state === 'WARN' || state === 'BLOCKED';
}

async function loadActiveLink(linkId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.linkRegistryRepo || linkRegistryRepo;
  if (!normalizeText(linkId)) return null;
  const link = await repository.getLink(linkId).catch(() => null);
  if (!link || isLinkInactive(link)) return null;
  return link;
}

function mergeTaskContentFallback(todoKey, todoItem, stepRule, content) {
  const existing = content && typeof content === 'object' ? content : {};
  const meaning = stepRule && stepRule.meaning && typeof stepRule.meaning === 'object' ? stepRule.meaning : {};
  return Object.assign({}, existing, {
    taskKey: normalizeText(existing.taskKey, normalizeText(stepRule && stepRule.ruleId, todoKey)),
    title: normalizeText(existing.title, normalizeText(meaning.title, normalizeText(todoItem && todoItem.title, todoKey))),
    category: normalizeText(existing.category, normalizeText(stepRule && stepRule.category, null)),
    dependencies: Array.isArray(existing.dependencies) && existing.dependencies.length
      ? existing.dependencies
      : (Array.isArray(stepRule && stepRule.dependsOn) ? stepRule.dependsOn : []),
    recommendedVendorLinkIds: Array.isArray(existing.recommendedVendorLinkIds) && existing.recommendedVendorLinkIds.length
      ? existing.recommendedVendorLinkIds
      : (Array.isArray(stepRule && stepRule.recommendedVendorLinkIds) ? stepRule.recommendedVendorLinkIds : []),
    manualText: normalizeText(existing.manualText, '手順マニュアルは未登録です。'),
    failureText: normalizeText(existing.failureText, 'よくある失敗は未登録です。')
  });
}

async function buildTodoDetailReply(lineUserId, todoKey, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const contentRepo = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const ruleRepo = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const todo = await todoRepo.getJourneyTodoItem(lineUserId, todoKey).catch(() => null);
  if (!todo) {
    return {
      handled: true,
      replyText: `TODOキー「${todoKey}」が見つかりません。`
    };
  }

  const rule = await ruleRepo.getStepRule(todoKey).catch(() => null);
  const content = await contentRepo.getTaskContent(todoKey).catch(() => null);
  const merged = mergeTaskContentFallback(todoKey, todo, rule, content);
  const validation = await validateTaskContent(merged, {
    getLink: async (id) => {
      const repo = resolvedDeps.linkRegistryRepo || linkRegistryRepo;
      return repo.getLink(id);
    }
  }).catch(() => ({ ok: true, resolved: {} }));

  const videoLink = await loadActiveLink(validation.resolved && validation.resolved.videoLinkId, resolvedDeps);
  const actionLink = await loadActiveLink(validation.resolved && validation.resolved.actionLinkId, resolvedDeps);

  const flex = renderTaskFlexMessage({
    todoKey,
    taskContent: merged,
    resolvedLinks: {
      video: videoLink ? { url: videoLink.url, label: videoLink.title || videoLink.label || '動画' } : null,
      action: actionLink ? { url: actionLink.url, label: actionLink.title || actionLink.label || '詳細' } : null
    }
  });

  return {
    handled: true,
    replyText: flex.fallbackText,
    replyMessage: {
      type: 'flex',
      altText: flex.altText,
      contents: flex.contents
    }
  };
}

async function buildTodoVendorReply(lineUserId, todoKey, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const contentRepo = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const ruleRepo = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const content = await contentRepo.getTaskContent(todoKey).catch(() => null);
  const rule = await ruleRepo.getStepRule(todoKey).catch(() => null);
  const ids = Array.from(new Set([
    ...((content && Array.isArray(content.recommendedVendorLinkIds)) ? content.recommendedVendorLinkIds : []),
    ...((rule && Array.isArray(rule.recommendedVendorLinkIds)) ? rule.recommendedVendorLinkIds : [])
  ])).slice(0, 3);
  if (!ids.length) {
    return '推奨業者は未登録です。';
  }
  const lines = ['推奨業者リンクです。'];
  for (const linkId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const link = await loadActiveLink(linkId, resolvedDeps);
    if (!link) continue;
    lines.push(`- ${(link.vendorLabel || link.title || link.label || linkId)}: ${link.url}`);
  }
  if (lines.length === 1) return '推奨業者リンクは現在利用できません。';
  return lines.join('\n');
}

function buildCityPackGuideReply() {
  return [
    'CityPack案内です。',
    '1) 地域申告: 地域:San Jose, CA',
    '2) TODO一覧: TODO一覧',
    '3) 今日の3つ: 今日の3つ',
    '地域申告後に CityPack 推奨導線が有効になります。'
  ].join('\n');
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
    const syncResult = await syncJourneyTodoPlan({
      lineUserId,
      profile: saved,
      source: 'line_command_household'
    }, resolvedDeps);
    await syncUserTasksProjection({
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
    const existing = await scheduleRepo.getUserJourneySchedule(lineUserId);
    const patch = {
      departureDate: command.action === 'set_departure_date' ? command.departureDate : (existing && existing.departureDate) || null,
      assignmentDate: command.action === 'set_assignment_date' ? command.assignmentDate : (existing && existing.assignmentDate) || null,
      source: 'line_command'
    };
    patch.stage = resolveScheduleStage(patch);
    const savedSchedule = await scheduleRepo.upsertUserJourneySchedule(lineUserId, patch, lineUserId);
    const syncResult = await syncJourneyTodoPlan({
      lineUserId,
      schedule: savedSchedule,
      source: 'line_command_schedule'
    }, resolvedDeps);
    await syncUserTasksProjection({
      userId: lineUserId,
      lineUserId,
      actor: 'line_command_schedule'
    }, resolvedDeps).catch(() => null);

    const dateLabel = command.action === 'set_departure_date' ? '渡航日' : '着任日';
    const dateValue = command.action === 'set_departure_date' ? command.departureDate : command.assignmentDate;
    return {
      handled: true,
      replyText: `${dateLabel}を ${dateValue} に更新しました。\nTODO同期: ${syncResult.syncedCount}件`
    };
  }

  if (command.action === 'next_tasks') {
    if (!isNextTaskEngineEnabled()) {
      return {
        handled: true,
        replyText: '「今日の3つ」は現在停止中です。TODO一覧をご利用ください。'
      };
    }
    return {
      handled: true,
      replyText: await buildNextTasksReply(lineUserId, resolvedDeps)
    };
  }

  if (command.action === 'category_view') {
    return {
      handled: true,
      replyText: await buildCategoryViewReply(lineUserId, command.category, resolvedDeps)
    };
  }

  if (command.action === 'delivery_history') {
    return {
      handled: true,
      replyText: await buildDeliveryHistoryReply(lineUserId, resolvedDeps)
    };
  }

  if (command.action === 'city_pack_guide') {
    return {
      handled: true,
      replyText: buildCityPackGuideReply()
    };
  }

  if (command.action === 'todo_vendor') {
    const todoKey = normalizeText(command.todoKey);
    if (!todoKey) {
      return {
        handled: true,
        replyText: 'TODOキーが必要です。例: TODO業者:visa_documents'
      };
    }
    return {
      handled: true,
      replyText: await buildTodoVendorReply(lineUserId, todoKey, resolvedDeps)
    };
  }

  if (command.action === 'todo_detail') {
    if (!isTaskDetailLineEnabled()) {
      return {
        handled: true,
        replyText: 'TODO詳細は現在停止中です。TODO一覧をご利用ください。'
      };
    }
    const todoKey = normalizeText(command.todoKey);
    if (!todoKey) {
      return {
        handled: true,
        replyText: 'TODOキーが必要です。例: TODO詳細:visa_documents'
      };
    }
    return buildTodoDetailReply(lineUserId, todoKey, resolvedDeps);
  }

  if (command.action === 'todo_detail_continue') {
    const todoKey = normalizeText(command.todoKey);
    const section = normalizeText(command.section).toLowerCase();
    if (!todoKey || !section) {
      return {
        handled: true,
        replyText: '形式が不正です。例: TODO詳細続き:visa_documents:manual:1'
      };
    }
    const sectionReply = await buildTaskDetailSectionReply({
      lineUserId,
      todoKey,
      section,
      startChunk: command.startChunk
    }, resolvedDeps);
    if (!sectionReply.ok) {
      return {
        handled: true,
        replyText: '詳細本文を取得できませんでした。'
      };
    }
    return {
      handled: true,
      replyText: sectionReply.replyMessages[0] && sectionReply.replyMessages[0].text
        ? sectionReply.replyMessages[0].text
        : '未登録です。',
      replyMessages: sectionReply.replyMessages,
      continuation: sectionReply.continuation
    };
  }

  if (command.action === 'todo_list') {
    const graph = await recomputeJourneyTaskGraph({
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
      const unified = formatUnifiedTaskList(tasks, items, graph);
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
        replyText: formatTaskList(tasks, graph)
      };
    }
    const items = await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 50 });
    return {
      handled: true,
      replyText: formatTodoList(items, graph)
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
