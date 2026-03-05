'use strict';

const { parseJourneyLineCommand } = require('../../domain/journey/lineCommandParsers');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const cityPackRequestsRepo = require('../../repos/firestore/cityPackRequestsRepo');
const { resolvePlan } = require('../billing/planGate');
const { syncJourneyTodoPlan, refreshJourneyTodoStats } = require('./syncJourneyTodoPlan');
const { applyPersonalizedRichMenu } = require('./applyPersonalizedRichMenu');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');
const { listUserTasks } = require('../tasks/listUserTasks');
const { patchTaskState } = require('../tasks/patchTaskState');
const { syncUserTasksProjection } = require('../tasks/syncUserTasksProjection');
const { getNotificationDeliveries } = require('../deliveries/getNotificationDeliveries');
const { formatLineDeliveryHistory } = require('../deliveries/formatLineDeliveryHistory');
const { resolveTaskContentLinks } = require('../tasks/validateTaskContent');
const { renderTaskFlexMessage } = require('../tasks/renderTaskFlexMessage');
const {
  resolveTaskDetailContentKey,
  buildTaskDetailSectionReply
} = require('./taskDetailSectionReply');
const { JOURNEY_SCENARIO_MIRROR_FIELD } = require('../../domain/constants');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { toBlockedReasonJa } = require('../../domain/tasks/blockedReasonJa');
const {
  isJourneyUnifiedViewEnabled,
  isTaskDetailLineEnabled,
  isTaskDetailGuideCommandsEnabled
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

function isVendorGuideCandidate(row) {
  const payload = row && typeof row === 'object' ? row : {};
  const category = normalizeText(payload.category).toLowerCase();
  const vendorKey = normalizeText(payload.vendorKey).toLowerCase();
  const vendorLabel = normalizeText(payload.vendorLabel).toLowerCase();
  const title = normalizeText(payload.title).toLowerCase();
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => normalizeText(item).toLowerCase()).filter(Boolean)
    : [];
  return category.includes('vendor')
    || vendorKey.length > 0
    || vendorLabel.length > 0
    || title.includes('[vendor_link]')
    || tags.some((item) => item.includes('vendor'));
}

function buildCityPackGuideText() {
  return [
    'CityPack案内',
    '1. 地域申告メッセージを送る（例: 地域申告:us-ca-san_francisco）',
    '2. TODO一覧を再取得して地域連動タスクを確認する',
    '3. 必要に応じて「TODO詳細:todoKey」で教材を確認する'
  ].join('\n');
}

async function buildVendorGuideText(deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const registry = resolvedDeps.linkRegistryRepo || linkRegistryRepo;
  const rows = await registry.listLinks({ limit: 60 }).catch(() => []);
  const vendors = (Array.isArray(rows) ? rows : []).filter(isVendorGuideCandidate);
  if (!vendors.length) {
    return 'Vendor案内\n利用可能なベンダーリンクは未登録です。運用担当へお問い合わせください。';
  }
  const lines = ['Vendor案内（候補）'];
  vendors.slice(0, 5).forEach((item, index) => {
    const label = normalizeText(item && (item.vendorLabel || item.title || item.id), `vendor_${index + 1}`);
    const url = normalizeText(item && item.url, '-');
    lines.push(`${index + 1}. ${label} / ${url}`);
  });
  lines.push('詳細比較は管理画面 Vendor Hub を利用してください。');
  return lines.join('\n');
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

  const taskKeyResolution = await resolveTaskDetailContentKey({
    lineUserId,
    todoKey,
    task
  }, resolvedDeps);
  const taskKey = normalizeText(taskKeyResolution && taskKeyResolution.taskKey, todoKey) || todoKey;
  const baseTaskKey = normalizeText(taskKeyResolution && taskKeyResolution.baseTaskKey, taskKey) || taskKey;
  const taskContentRepository = resolvedDeps.taskContentsRepo || taskContentsRepo;
  let taskContent = await taskContentRepository.getTaskContent(taskKey).catch(() => null);
  if (!taskContent && baseTaskKey && baseTaskKey !== taskKey) {
    taskContent = await taskContentRepository.getTaskContent(baseTaskKey).catch(() => null);
  }
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

  if (command.action === 'delivery_history') {
    if (!isTaskDetailGuideCommandsEnabled()) {
      return {
        handled: true,
        replyText: '通知履歴コマンドは現在停止中です。'
      };
    }
    const history = await getNotificationDeliveries({
      lineUserId,
      limit: 5,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      actor: 'line_command_delivery_history'
    }, resolvedDeps).catch(() => null);
    if (!history) {
      return {
        handled: true,
        replyText: '通知履歴の取得に失敗しました。時間をおいて再試行してください。'
      };
    }
    return {
      handled: true,
      replyText: formatLineDeliveryHistory(history, { limit: 5 })
    };
  }

  if (command.action === 'city_pack_guide') {
    if (!isTaskDetailGuideCommandsEnabled()) {
      return {
        handled: true,
        replyText: 'CityPack案内コマンドは現在停止中です。'
      };
    }
    const requestsRepo = resolvedDeps.cityPackRequestsRepo || cityPackRequestsRepo;
    const recentRequests = await requestsRepo.listRequests({ limit: 50 }).catch(() => []);
    const latest = (Array.isArray(recentRequests) ? recentRequests : [])
      .find((item) => normalizeText(item && item.lineUserId) === lineUserId);
    const latestLine = latest
      ? `直近の地域申告ステータス: ${normalizeText(latest.status, 'unknown')} (${normalizeText(latest.regionKey, '-')})`
      : '直近の地域申告ステータス: 未申告';
    return {
      handled: true,
      replyText: `${buildCityPackGuideText()}\n${latestLine}`
    };
  }

  if (command.action === 'vendor_guide') {
    if (!isTaskDetailGuideCommandsEnabled()) {
      return {
        handled: true,
        replyText: 'Vendor案内コマンドは現在停止中です。'
      };
    }
    return {
      handled: true,
      replyText: await buildVendorGuideText(resolvedDeps)
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
