'use strict';

const { resolveNumberEnvFlag } = require('../shared/flags');
const { splitTextByUtf16 } = require('./messageChunker');
const { buildOverflowFallbackMessage } = require('./fallbackRenderer');

const MAX_LINE_MESSAGE_OBJECTS = 5;
const DEFAULT_TEXT_UTF16_BUDGET = 1200;

function normalizeMessageObject(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.type === 'text') {
    const text = typeof row.text === 'string' ? row.text : '';
    return { type: 'text', text };
  }
  if (row.type === 'flex' || row.type === 'template') {
    return row;
  }
  if (row.type === 'service_message') {
    return {
      type: 'text',
      text: typeof row.text === 'string' ? row.text : 'お知らせがあります。'
    };
  }
  return null;
}

function explodeTextMessage(message, textBudgetUtf16) {
  const chunks = splitTextByUtf16(message.text, textBudgetUtf16);
  if (!chunks.length) return [];
  return chunks.map((text) => ({ type: 'text', text }));
}

function prepareLineMessages(messages, options) {
  const payload = Array.isArray(messages) ? messages : [messages];
  const sourceEnv = options && options.env ? options.env : process.env;
  const textBudgetUtf16 = resolveNumberEnvFlag('LINE_TEXT_UTF16_BUDGET', DEFAULT_TEXT_UTF16_BUDGET, sourceEnv, 100, 4000);

  const expanded = [];
  payload.forEach((message) => {
    const normalized = normalizeMessageObject(message);
    if (!normalized) return;
    if (normalized.type === 'text') {
      explodeTextMessage(normalized, textBudgetUtf16).forEach((row) => expanded.push(row));
      return;
    }
    expanded.push(normalized);
  });

  if (!expanded.length) {
    return [{ type: 'text', text: 'メッセージを生成できませんでした。' }];
  }

  if (expanded.length <= MAX_LINE_MESSAGE_OBJECTS) return expanded;

  const kept = expanded.slice(0, MAX_LINE_MESSAGE_OBJECTS - 1);
  kept.push(buildOverflowFallbackMessage({ handoffUrl: options && options.handoffUrl }));
  return kept;
}

module.exports = {
  MAX_LINE_MESSAGE_OBJECTS,
  DEFAULT_TEXT_UTF16_BUDGET,
  prepareLineMessages
};
