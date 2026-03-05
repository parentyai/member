'use strict';

const { parseJourneyLineCommand } = require('../../domain/journey/lineCommandParsers');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const userCityPackPreferencesRepo = require('../../repos/firestore/userCityPackPreferencesRepo');
const { ALLOWED_MODULES } = require('../../repos/firestore/cityPacksRepo');
const { resolvePlan } = require('../billing/planGate');
const { syncJourneyTodoPlan, refreshJourneyTodoStats } = require('./syncJourneyTodoPlan');
const { applyPersonalizedRichMenu } = require('./applyPersonalizedRichMenu');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');
const { listUserTasks } = require('../tasks/listUserTasks');
const { patchTaskState } = require('../tasks/patchTaskState');
const { syncUserTasksProjection } = require('../tasks/syncUserTasksProjection');
const { resolveTaskContentLinks } = require('../tasks/validateTaskContent');
const { renderTaskFlexMessage } = require('../tasks/renderTaskFlexMessage');
const {
  resolveTaskDetailTaskKey,
  buildTaskDetailSectionReply
} = require('./taskDetailSectionReply');
const { JOURNEY_SCENARIO_MIRROR_FIELD } = require('../../domain/constants');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { toBlockedReasonJa } = require('../../domain/tasks/blockedReasonJa');
const {
  isJourneyUnifiedViewEnabled,
  isTaskDetailLineEnabled,
  isCityPackModuleSubscriptionEnabled
} = require('../../domain/tasks/featureFlags');

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
  return {
    handled: true,
    replyMessage: flexMessage
  };
}

async function handleTodoDetailSectionContinueCommand(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const todoKey = normalizeText(payload.todoKey);
  const section = normalizeText(payload.section).toLowerCase();
  const startChunk = Number(payload.startChunk);
  if (!todoKey || !section) {
    return {
      handled: true,
      replyText: '続き表示の形式が不正です。例: TODO詳細続き:todoKey:manual:2'
    };
  }
  return buildTaskDetailSectionReply({
    lineUserId: normalizeText(payload.lineUserId),
    todoKey,
    section,
    startChunk: Number.isInteger(startChunk) && startChunk >= 1 ? startChunk : 1
  }, deps);
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

  if (command.action === 'todo_detail') {
    if (!isTaskDetailLineEnabled()) {
      return {
        handled: true,
        replyText: 'タスク詳細表示は現在停止中です。'
      };
    }
    return handleTodoDetailCommand({
      lineUserId,
      todoKey: command.todoKey
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
      startChunk: command.startChunk
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
