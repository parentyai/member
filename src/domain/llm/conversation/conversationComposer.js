'use strict';

const { CONVERSATION_MOVES } = require('./conversationMoves');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toSentence(text, fallback) {
  const normalized = normalizeText(text) || normalizeText(fallback);
  if (!normalized) return '';
  return /[。.!?！？]$/.test(normalized) ? normalized : `${normalized}。`;
}

function parseActionLine(line) {
  const numbered = line.match(/^\d+[\.)]\s*(.+)$/);
  if (numbered && normalizeText(numbered[1])) return normalizeText(numbered[1]);
  const bullet = line.match(/^(?:[-*・]|\[[ xX]\])\s*(.+)$/);
  if (bullet && normalizeText(bullet[1])) return normalizeText(bullet[1]);
  return '';
}

function extractAnalysisFromBaseReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const text = normalizeText(payload.baseReplyText);
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .filter((line) => !/^(参照|根拠キー|根拠)\s*[:：]/.test(line));

  const summary = toSentence((lines[0] || '').replace(/^結論\s*[:：]\s*/i, ''), '状況の特定に必要な情報が不足しています。');
  const nextActions = [];
  const missing = [];
  const risks = [];

  let captureActions = false;
  lines.forEach((line) => {
    if (/^次にやること\s*[:：]?$/i.test(line)) {
      captureActions = true;
      return;
    }
    const action = parseActionLine(line);
    if (action) {
      if (!nextActions.includes(action)) nextActions.push(action);
      return;
    }
    if (captureActions && !/^(注意|確認|根拠|参照|つまずき)/.test(line)) {
      if (!nextActions.includes(line)) nextActions.push(line);
      return;
    }
    if (/(不足|未設定|未確認|不明)/.test(line)) {
      if (!missing.includes(line)) missing.push(line);
    }
    if (/(注意|リスク|危険|つまずき|詰まり)/.test(line)) {
      if (!risks.includes(line)) risks.push(line);
    }
  });

  if (!nextActions.length) {
    nextActions.push('対象手続きを1つに絞って優先度順に進める');
  }

  return {
    summary,
    missing,
    risks,
    nextActions: nextActions.slice(0, 3),
    refs: []
  };
}

function resolvePitfall(analysis) {
  const risks = Array.isArray(analysis && analysis.risks) ? analysis.risks.filter(Boolean) : [];
  const missing = Array.isArray(analysis && analysis.missing) ? analysis.missing.filter(Boolean) : [];
  if (risks.length) return normalizeText(risks[0]);
  if (missing.length) return normalizeText(missing[0]);
  return '手続き名と期限が曖昧なまま進めることです。';
}

function resolveQuestion(analysis, state) {
  const missing = Array.isArray(analysis && analysis.missing) ? analysis.missing.filter(Boolean) : [];
  if (state === 'CLARIFY' || missing.length) return '対象手続き名と期限を1つずつ教えてください。';
  return '';
}

function prefixByMove(move) {
  switch (move) {
    case CONVERSATION_MOVES.MIRROR:
      return '理解しました。';
    case CONVERSATION_MOVES.NARROW:
      return 'ここを絞ると進めやすいです。';
    case CONVERSATION_MOVES.PRIORITIZE:
      return '優先順位を先に固定します。';
    case CONVERSATION_MOVES.UNBLOCK:
      return 'いまの詰まりを先に解消します。';
    case CONVERSATION_MOVES.CHUNK:
      return '小さく分けて進めましょう。';
    case CONVERSATION_MOVES.OFFER:
      return '候補を提案します。';
    case CONVERSATION_MOVES.VALIDATE:
      return '進捗を確認しながら進めます。';
    case CONVERSATION_MOVES.HANDOFF:
      return 'この内容で運用確認に回せます。';
    default:
      return '次の一手を整理します。';
  }
}

function composeConversationDraft(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const analysis = payload.analysis && typeof payload.analysis === 'object'
    ? payload.analysis
    : extractAnalysisFromBaseReply({ baseReplyText: payload.baseReplyText || '' });
  const state = normalizeText(payload.state) || 'ENTRY';
  const move = normalizeText(payload.move) || CONVERSATION_MOVES.MIRROR;

  const summary = toSentence(analysis.summary, '状況の特定に必要な情報が不足しています。');
  const nextActions = Array.isArray(analysis.nextActions) ? analysis.nextActions.filter(Boolean).slice(0, 3) : [];
  const pitfall = resolvePitfall(analysis);
  const question = resolveQuestion(analysis, state);
  const movePrefix = prefixByMove(move);

  const draft = [
    movePrefix,
    summary,
    '次にやること:',
    ...nextActions.map((action, index) => `${index + 1}. ${action}`),
    `よくあるつまずき: ${pitfall}`,
    question ? `確認: ${question}` : ''
  ].filter(Boolean).join('\n');

  return {
    draft,
    summary,
    missing: Array.isArray(analysis.missing) ? analysis.missing : [],
    risks: Array.isArray(analysis.risks) ? analysis.risks : [],
    nextActions,
    refs: Array.isArray(analysis.refs) ? analysis.refs : [],
    pitfall,
    question
  };
}

module.exports = {
  extractAnalysisFromBaseReply,
  composeConversationDraft
};
