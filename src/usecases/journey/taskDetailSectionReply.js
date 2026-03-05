'use strict';

const tasksRepo = require('../../repos/firestore/tasksRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const taskContentLinksRepo = require('../../repos/firestore/taskContentLinksRepo');
const { splitLineLongText } = require('../line/splitLineLongText');
const {
  isTaskDetailSectionSafetyValveEnabled,
  getTaskDetailSectionChunkLimit,
  isTaskContentLinkMigrationEnabled
} = require('../../domain/tasks/featureFlags');

const MAX_LINE_MESSAGE_CHARS = 4200;
const DEFAULT_MANUAL_TEXT = '手順マニュアルは未登録です。管理画面の Task Detail Editor で登録してください。';
const DEFAULT_FAILURE_TEXT = 'よくある失敗は未登録です。管理画面の Task Detail Editor で登録してください。';

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback || '';
  const normalized = value.trim();
  return normalized || fallback || '';
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

function resolveTaskDetailRuleId(task, todoKey) {
  const row = task && typeof task === 'object' ? task : {};
  const parsed = tasksRepo.parseTaskId(row.taskId || '');
  const ruleId = normalizeText(row.ruleId);
  if (ruleId) return ruleId;
  const parsedRuleId = normalizeText(parsed && parsed.ruleId);
  if (parsedRuleId) return parsedRuleId;
  return normalizeText(todoKey);
}

async function resolveTaskContentKeyWithMigration(baseResolution, deps) {
  const base = baseResolution && typeof baseResolution === 'object'
    ? baseResolution
    : { taskKey: '', source: 'todoKey_fallback', ruleId: '', baseTaskKey: '' };
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const baseTaskKey = normalizeText(base.baseTaskKey || base.taskKey);
  const ruleId = normalizeText(base.ruleId, normalizeText(base.taskKey));
  const output = {
    taskKey: baseTaskKey,
    baseTaskKey,
    ruleId: ruleId || null,
    source: base.source || 'todoKey_fallback',
    taskContentLink: null
  };

  if (!isTaskContentLinkMigrationEnabled()) return output;
  if (!ruleId) return output;

  const linkRepo = resolvedDeps.taskContentLinksRepo || taskContentLinksRepo;
  if (!linkRepo || typeof linkRepo.getTaskContentLink !== 'function') return output;

  const link = await linkRepo.getTaskContentLink(ruleId).catch(() => null);
  if (!link) return output;
  output.taskContentLink = {
    ruleId,
    sourceTaskKey: normalizeText(link.sourceTaskKey, null),
    status: normalizeText(link.status, 'warn') || 'warn',
    confidence: normalizeText(link.confidence, 'manual') || 'manual'
  };
  if (output.taskContentLink.status !== 'active') {
    output.source = `${output.source}+task_content_links_${output.taskContentLink.status}`;
    return output;
  }
  if (!output.taskContentLink.sourceTaskKey) {
    output.source = `${output.source}+task_content_links_missing_source`;
    return output;
  }

  output.taskKey = output.taskContentLink.sourceTaskKey;
  output.source = 'task_content_links.active';
  return output;
}

async function resolveTaskKey(lineUserId, todoKey, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const taskRepository = resolvedDeps.tasksRepo || tasksRepo;
  const directTaskId = `${lineUserId}__${todoKey}`;
  const direct = await taskRepository.getTask(directTaskId).catch(() => null);
  const base = direct
    ? resolveTaskDetailTaskKey(direct, todoKey)
    : { taskKey: todoKey, source: 'todoKey_fallback' };
  return resolveTaskContentKeyWithMigration({
    taskKey: normalizeText(base.taskKey, normalizeText(todoKey)),
    baseTaskKey: normalizeText(base.taskKey, normalizeText(todoKey)),
    source: normalizeText(base.source, 'todoKey_fallback') || 'todoKey_fallback',
    ruleId: direct ? resolveTaskDetailRuleId(direct, todoKey) : normalizeText(todoKey)
  }, resolvedDeps);
}

async function resolveTaskDetailContentKey(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const todoKey = normalizeText(payload.todoKey);
  const task = payload.task && typeof payload.task === 'object' ? payload.task : null;
  if (task) {
    const base = resolveTaskDetailTaskKey(task, todoKey);
    return resolveTaskContentKeyWithMigration({
      taskKey: normalizeText(base && base.taskKey, todoKey),
      baseTaskKey: normalizeText(base && base.taskKey, todoKey),
      source: normalizeText(base && base.source, 'todoKey_fallback') || 'todoKey_fallback',
      ruleId: resolveTaskDetailRuleId(task, todoKey)
    }, deps);
  }
  return resolveTaskKey(normalizeText(payload.lineUserId), todoKey, deps);
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
  if (!lineUserId || !todoKey || !section) return { handled: false };
  if (section !== 'manual' && section !== 'failure') return { handled: false };

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const taskContentRepository = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const keyResolution = await resolveTaskDetailContentKey({ lineUserId, todoKey }, resolvedDeps);
  const taskKey = normalizeText(keyResolution && keyResolution.taskKey);
  if (!taskKey) {
    return {
      handled: true,
      replyText: 'タスク詳細キーの解決に失敗しました。時間をおいて再試行してください。'
    };
  }

  let taskContent = await taskContentRepository.getTaskContent(taskKey).catch(() => null);
  const baseTaskKey = normalizeText(keyResolution && keyResolution.baseTaskKey);
  if (!taskContent && baseTaskKey && baseTaskKey !== taskKey) {
    taskContent = await taskContentRepository.getTaskContent(baseTaskKey).catch(() => null);
  }
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

  let continuationCommand = null;
  if (safetyValve && endExclusive < totalChunks) {
    const nextChunk = endExclusive + 1;
    continuationCommand = buildContinuationCommand(todoKey, section, nextChunk);
    messages.push({
      type: 'text',
      text: `長文のため ${endExclusive}/${totalChunks} 件まで表示しました。続きは「${continuationCommand}」を送信してください。`
    });
  }

  return {
    handled: true,
    replyMessages: messages,
    sectionMeta: {
      taskKey,
      baseTaskKey: baseTaskKey || taskKey,
      ruleId: normalizeText(keyResolution && keyResolution.ruleId, null),
      taskKeySource: keyResolution.source || null,
      taskContentLink: keyResolution && keyResolution.taskContentLink ? keyResolution.taskContentLink : null,
      section,
      requestedStartChunk: startChunk,
      startChunk: startIndex + 1,
      endChunk: endExclusive,
      totalChunks,
      chunkLimit,
      deliveredChunkCount: visible.length,
      safetyValveApplied: safetyValve && totalChunks > chunkLimit,
      continuationOffered: Boolean(continuationCommand),
      continuationCommand
    }
  };
}

module.exports = {
  DEFAULT_MANUAL_TEXT,
  DEFAULT_FAILURE_TEXT,
  resolveTaskDetailTaskKey,
  resolveTaskDetailContentKey,
  buildTaskDetailSectionReply,
  buildContinuationCommand
};
