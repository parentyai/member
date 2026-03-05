'use strict';

const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const { splitLineLongText } = require('../line/splitLineLongText');
const {
  isTaskDetailSectionSafetyValveEnabled,
  getTaskDetailSectionChunkLimit
} = require('../../domain/tasks/featureFlags');

const SECTION_LABEL = Object.freeze({
  manual: '手順マニュアル',
  failure: 'よくある失敗'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeSection(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'manual' || normalized === 'failure') return normalized;
  return '';
}

function normalizeStartChunk(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function parseRuleIdFromTaskId(taskId) {
  const parsed = tasksRepo.parseTaskId(taskId || '');
  return normalizeText(parsed && parsed.ruleId);
}

async function resolveTaskContentByTodo(lineUserId, todoKey, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const contentRepo = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const todo = await todoRepo.getJourneyTodoItem(lineUserId, todoKey).catch(() => null);
  const candidateKeys = [];
  if (todo && todo.todoKey) candidateKeys.push(todo.todoKey);
  if (todo && todo.stateEvidenceRef) {
    const parsedRuleId = parseRuleIdFromTaskId(todo.stateEvidenceRef);
    if (parsedRuleId) candidateKeys.push(parsedRuleId);
  }
  if (!candidateKeys.includes(todoKey)) candidateKeys.push(todoKey);

  for (const taskKey of candidateKeys) {
    // eslint-disable-next-line no-await-in-loop
    const content = await contentRepo.getTaskContent(taskKey).catch(() => null);
    if (content) {
      return { taskKey, taskContent: content };
    }
  }
  return { taskKey: todoKey, taskContent: null };
}

function buildContinuationCommand(todoKey, section, startChunk) {
  return `TODO詳細続き:${todoKey}:${section}:${startChunk}`;
}

function buildSectionBaseText(section, taskContent) {
  const row = taskContent && typeof taskContent === 'object' ? taskContent : {};
  if (section === 'manual') {
    return normalizeText(row.manualText) || '手順マニュアルは未登録です。';
  }
  if (section === 'failure') {
    return normalizeText(row.failureText) || 'よくある失敗は未登録です。';
  }
  return '';
}

function toSectionMessages(todoKey, section, text, startChunk) {
  const chunks = splitLineLongText(text, { chunkSize: 4200 });
  const totalChunks = chunks.length;
  if (!totalChunks) {
    return {
      messages: ['未登録です。'],
      totalChunks: 0,
      deliveredChunks: 0,
      nextStartChunk: null
    };
  }
  const start = Math.max(0, startChunk - 1);
  if (start >= totalChunks) {
    return {
      messages: ['続きはありません。'],
      totalChunks,
      deliveredChunks: 0,
      nextStartChunk: null
    };
  }

  const withSafety = isTaskDetailSectionSafetyValveEnabled();
  const limit = withSafety ? getTaskDetailSectionChunkLimit() : totalChunks;
  const target = chunks.slice(start, start + limit);
  const messages = target.map((chunk, index) => {
    const current = start + index + 1;
    return `[${SECTION_LABEL[section] || section} ${current}/${totalChunks}]\n${chunk}`;
  });
  const nextStartChunk = start + target.length < totalChunks
    ? (start + target.length + 1)
    : null;

  if (nextStartChunk) {
    messages.push(
      `続きがあります。${buildContinuationCommand(todoKey, section, nextStartChunk)} を送信してください。`
    );
  }

  return {
    messages,
    totalChunks,
    deliveredChunks: target.length,
    nextStartChunk
  };
}

async function buildTaskDetailSectionReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const todoKey = normalizeText(payload.todoKey);
  const section = normalizeSection(payload.section);
  const startChunk = normalizeStartChunk(payload.startChunk);
  if (!lineUserId || !todoKey || !section) {
    return { ok: false, reason: 'invalid_params' };
  }

  const resolved = await resolveTaskContentByTodo(lineUserId, todoKey, deps);
  const sectionText = buildSectionBaseText(section, resolved.taskContent);
  const built = toSectionMessages(todoKey, section, sectionText, startChunk);

  return {
    ok: true,
    todoKey,
    taskKey: resolved.taskKey,
    section,
    startChunk,
    totalChunks: built.totalChunks,
    deliveredChunks: built.deliveredChunks,
    nextStartChunk: built.nextStartChunk,
    replyMessages: built.messages.map((text) => ({ type: 'text', text })),
    continuation: {
      section,
      opened: startChunk === 1,
      resumed: startChunk > 1,
      completionRate: built.totalChunks > 0
        ? Math.min(100, Math.round(((startChunk - 1 + built.deliveredChunks) / built.totalChunks) * 100))
        : 100
    }
  };
}

module.exports = {
  buildTaskDetailSectionReply
};
