'use strict';

const { resolveNumberEnvFlag } = require('../shared/flags');
const { splitTextByUtf16 } = require('./messageChunker');
const { buildOverflowFallbackMessage } = require('./fallbackRenderer');

const MAX_LINE_MESSAGE_OBJECTS = 5;
const DEFAULT_TEXT_UTF16_BUDGET = 1200;

function normalizeQuickReply(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const normalizedItems = items
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const action = item.action && typeof item.action === 'object' ? item.action : {};
      const label = typeof action.label === 'string' ? action.label.trim() : '';
      const text = typeof action.text === 'string' ? action.text.trim() : '';
      if (!label || !text || action.type !== 'message') return null;
      const normalizedAction = {
        type: 'message',
        label,
        text
      };
      if (typeof action.data === 'string' && action.data.trim()) {
        normalizedAction.data = action.data.trim();
      }
      return {
        type: 'action',
        action: normalizedAction
      };
    })
    .filter(Boolean)
    .slice(0, 4);
  return normalizedItems.length > 0 ? { items: normalizedItems } : null;
}

function normalizeMessageObject(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.type === 'text') {
    const text = typeof row.text === 'string' ? row.text : '';
    const quickReply = normalizeQuickReply(row.quickReply);
    return quickReply ? { type: 'text', text, quickReply } : { type: 'text', text };
  }
  if (row.type === 'quick_reply') {
    const text = typeof row.text === 'string' ? row.text : '';
    const quickReply = normalizeQuickReply(row.quickReply);
    if (!quickReply) return { type: 'text', text };
    return { type: 'text', text, quickReply };
  }
  if (row.type === 'flex' || row.type === 'template') {
    const quickReply = normalizeQuickReply(row.quickReply);
    return quickReply ? Object.assign({}, row, { quickReply }) : row;
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
  return chunks.map((text, index) => {
    const row = { type: 'text', text };
    if (index === 0 && message.quickReply) row.quickReply = message.quickReply;
    return row;
  });
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
