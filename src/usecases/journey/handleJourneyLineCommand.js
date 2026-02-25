'use strict';

const { parseJourneyLineCommand } = require('../../domain/journey/lineCommandParsers');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { resolvePlan } = require('../billing/planGate');
const { syncJourneyTodoPlan, refreshJourneyTodoStats } = require('./syncJourneyTodoPlan');
const { applyPersonalizedRichMenu } = require('./applyPersonalizedRichMenu');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');

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
      scenarioKeyMirror: command.scenarioKeyMirror,
      source: 'line_command'
    }, lineUserId);
    const syncResult = await syncJourneyTodoPlan({
      lineUserId,
      profile: saved,
      source: 'line_command_household'
    }, resolvedDeps);

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
    const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
    if (!existing) {
      return {
        handled: true,
        replyText: `TODOキー「${todoKey}」が見つかりません。` 
      };
    }
    await todoRepo.markJourneyTodoCompleted(lineUserId, todoKey, {});
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
    const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
    if (!existing) {
      return {
        handled: true,
        replyText: `TODOキー「${todoKey}」が見つかりません。`
      };
    }
    if (existing.status === 'completed' || existing.status === 'skipped') {
      return {
        handled: true,
        replyText: `TODO「${todoKey}」はすでに完了済みです。`
      };
    }
    const progressState = command.action === 'todo_in_progress' ? 'in_progress' : 'not_started';
    await todoRepo.setJourneyTodoProgressState(lineUserId, todoKey, progressState, {});
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

  return { handled: false };
}

module.exports = {
  handleJourneyLineCommand
};
