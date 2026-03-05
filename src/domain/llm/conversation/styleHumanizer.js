'use strict';

const { renderResponseByStyle } = require('../responseStyles');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function humanizeConversationDraft(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const styleDecision = payload.styleDecision && typeof payload.styleDecision === 'object'
    ? payload.styleDecision
    : { styleId: 'Coach', conversationPattern: 'coach_default', askClarifying: false, maxActions: 3 };
  const draftPacket = payload.draftPacket && typeof payload.draftPacket === 'object' ? payload.draftPacket : {};

  const text = renderResponseByStyle(styleDecision.styleId, {
    summary: normalizeText(draftPacket.summary),
    nextActions: Array.isArray(draftPacket.nextActions) ? draftPacket.nextActions : [],
    pitfall: normalizeText(draftPacket.pitfall),
    question: styleDecision.askClarifying ? normalizeText(draftPacket.question) : '',
    maxActions: styleDecision.maxActions
  });

  return {
    text,
    styleId: styleDecision.styleId,
    conversationPattern: styleDecision.conversationPattern,
    responseLength: text.length
  };
}

function humanizeConversationMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const result = humanizeConversationDraft({
    draftPacket: payload.draftPacket,
    styleDecision: payload.styleDecision
  });
  return {
    text: normalizeText(result.text),
    styleId: result.styleId || null,
    conversationPattern: result.conversationPattern || null,
    responseLength: Number.isFinite(Number(result.responseLength)) ? Number(result.responseLength) : normalizeText(result.text).length
  };
}

module.exports = {
  humanizeConversationDraft,
  humanizeConversationMessage
};
