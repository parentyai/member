'use strict';

const tasksRepo = require('../../repos/firestore/tasksRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const { splitLineLongText } = require('../line/splitLineLongText');
const {
  isTaskDetailSectionSafetyValveEnabled,
  getTaskDetailSectionChunkLimit
} = require('../../domain/tasks/featureFlags');

const MAX_LINE_MESSAGE_CHARS = 4200;
const DEFAULT_MANUAL_TEXT = '手順マニュアルは未登録です。管理画面の Task Detail Editor で登録してください。';
const DEFAULT_FAILURE_TEXT = 'よくある失敗は未登録です。管理画面の Task Detail Editor で登録してください。';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalToken(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeAttribution(input) {
  const payload = input && typeof input === 'object' ? input : {};
  return {
    notificationId: normalizeOptionalToken(payload.notificationId),
    deliveryId: normalizeOptionalToken(payload.deliveryId),
    source: normalizeOptionalToken(payload.source),
    traceId: normalizeOptionalToken(payload.traceId)
  };
}

function resolveTaskDetailTaskKey(task, todoKey) {
  const row = task && typeof task === 'object' ? task : {};
  const parsed = tasksRepo.parseTaskId(row.taskId || '');
  const ruleId = normalizeText(row.ruleId);
  if (ruleId) {
    return { taskKey: ruleId, source: 'task.ruleId' };
  }
  const parsedRuleId = normalizeText(parsed && parsed.ruleId);
  if (parsedRuleId) {
    return { taskKey: parsedRuleId, source: 'taskId.ruleId_fallback' };
  }
  const fallback = normalizeText(todoKey);
  return { taskKey: fallback, source: 'todoKey_fallback' };
}

async function resolveTaskKey(lineUserId, todoKey, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const taskRepository = resolvedDeps.tasksRepo || tasksRepo;
  const directTaskId = `${lineUserId}__${todoKey}`;
  const direct = await taskRepository.getTask(directTaskId).catch(() => null);
  if (direct) return resolveTaskDetailTaskKey(direct, todoKey);
  return { taskKey: todoKey, source: 'todoKey_fallback' };
}

function resolveSectionText(section, taskContent) {
  const row = taskContent && typeof taskContent === 'object' ? taskContent : {};
  if (section === 'manual') return normalizeText(row.manualText) || DEFAULT_MANUAL_TEXT;
  if (section === 'failure') return normalizeText(row.failureText) || DEFAULT_FAILURE_TEXT;
  return '';
}

function toSectionLabel(section) {
  if (section === 'manual') return '手順マニュアル';
  if (section === 'failure') return 'よくある失敗';
  return '詳細';
}

function buildSectionChunkText(section, index, total, chunk) {
  const label = toSectionLabel(section);
  const prefix = `【${label} ${index}/${total}】\n`;
  const available = Math.max(0, MAX_LINE_MESSAGE_CHARS - prefix.length);
  const body = String(chunk || '').slice(0, available);
  return `${prefix}${body}`;
}

function buildContinuationCommand(todoKey, section, nextChunk) {
  return `TODO詳細続き:${todoKey}:${section}:${nextChunk}`;
}

async function buildTaskDetailSectionReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const todoKey = normalizeText(payload.todoKey);
  const section = normalizeText(payload.section).toLowerCase();
  const startChunk = Number.isFinite(Number(payload.startChunk))
    ? Math.max(1, Math.floor(Number(payload.startChunk)))
    : 1;
  const attribution = normalizeAttribution(payload.attribution || payload);
  if (!lineUserId || !todoKey || !section) return { handled: false };
  if (section !== 'manual' && section !== 'failure') return { handled: false };

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const taskContentRepository = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const keyResolution = await resolveTaskKey(lineUserId, todoKey, resolvedDeps);
  const taskKey = normalizeText(keyResolution && keyResolution.taskKey);
  if (!taskKey) {
    return {
      handled: true,
      replyText: 'タスク詳細キーの解決に失敗しました。時間をおいて再試行してください。'
    };
  }

  const taskContent = await taskContentRepository.getTaskContent(taskKey).catch(() => null);
  const contentText = resolveSectionText(section, taskContent);
  const chunks = splitLineLongText(contentText, MAX_LINE_MESSAGE_CHARS);
  const fallbackText = section === 'manual' ? DEFAULT_MANUAL_TEXT : DEFAULT_FAILURE_TEXT;
  const effectiveChunks = chunks.length ? chunks : [fallbackText];
  const totalChunks = effectiveChunks.length;
  const startIndex = Math.min(totalChunks - 1, startChunk - 1);

  if (startIndex < 0 || startIndex >= totalChunks) {
    return {
      handled: true,
      replyText: '続きはありません。'
    };
  }

  const safetyValve = isTaskDetailSectionSafetyValveEnabled();
  const chunkLimit = safetyValve ? getTaskDetailSectionChunkLimit() : totalChunks;
  const endExclusive = Math.min(totalChunks, startIndex + chunkLimit);
  const visible = effectiveChunks.slice(startIndex, endExclusive);
  const messages = visible.map((chunk, offset) => ({
    type: 'text',
    text: buildSectionChunkText(section, startIndex + offset + 1, totalChunks, chunk)
  }));

  if (safetyValve && endExclusive < totalChunks) {
    const nextChunk = endExclusive + 1;
    const continueCommand = buildContinuationCommand(todoKey, section, nextChunk);
    messages.push({
      type: 'text',
      text: `長文のため ${endExclusive}/${totalChunks} 件まで表示しました。続きは「${continueCommand}」を送信してください。`
    });
  }

  return {
    handled: true,
    replyMessages: messages,
    sectionMeta: {
      taskKey,
      taskKeySource: keyResolution.source || null,
      todoKey,
      section,
      startChunk: startIndex + 1,
      totalChunks,
      chunkLimitApplied: chunkLimit,
      visibleChunkCount: visible.length,
      safetyValveApplied: safetyValve && totalChunks > chunkLimit,
      continuationRequired: endExclusive < totalChunks,
      attribution
    }
  };
}

module.exports = {
  DEFAULT_MANUAL_TEXT,
  DEFAULT_FAILURE_TEXT,
  resolveTaskDetailTaskKey,
  buildTaskDetailSectionReply,
  buildContinuationCommand
};
