'use strict';

const { detectMessagePosture } = require('./opportunity/detectMessagePosture');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForPaidLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function buildGreetingReply() {
  return 'こんにちは。今日はどの手続きから進めますか？';
}

function buildSmalltalkReply() {
  return 'ありがとうございます。必要なら、今いちばん気になっている手続きを1つだけ教えてください。';
}

function hashForVariantSeed(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickVariant(list, seedSource) {
  const rows = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!rows.length) return '';
  const seed = hashForVariantSeed(seedSource);
  return rows[seed % rows.length];
}

function buildGeneralCasualReply(question, atoms, contextHint) {
  const message = normalizeText(question);
  const prompt = atoms && typeof atoms.question === 'string' && atoms.question.trim()
    ? atoms.question.trim()
    : (contextHint
      ? `${contextHint}の話として進めます。いま一番詰まっている点を1つだけ教えてください。`
      : '対象を絞って進めたいので、いま優先したい手続きを1つだけ教えてください。');

  if (!message) return prompt;

  const intro = pickVariant([
    '了解です。状況を短く整理しながら進めます。',
    'ありがとうございます。いまの状況を一緒に整えて進めます。',
    '把握しました。まずは迷いを減らすところから進めます。'
  ], message);

  return [
    intro,
    prompt
  ].join('\n');
}

function generatePaidCasualReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const contextHint = typeof payload.contextHint === 'string' ? normalizeText(payload.contextHint) : '';
  const suggestedAtoms = payload.suggestedAtoms && typeof payload.suggestedAtoms === 'object'
    ? payload.suggestedAtoms
    : { nextActions: [], pitfall: null, question: null };
  const posture = detectMessagePosture({ messageText });

  if (posture.isGreeting) {
    return {
      ok: true,
      mode: 'casual',
      replyText: trimForPaidLineMessage(buildGreetingReply())
    };
  }
  if (posture.isSmalltalk) {
    return {
      ok: true,
      mode: 'casual',
      replyText: trimForPaidLineMessage(buildSmalltalkReply())
    };
  }

  return {
    ok: true,
    mode: 'casual',
    replyText: trimForPaidLineMessage(buildGeneralCasualReply(messageText, suggestedAtoms, contextHint))
  };
}

module.exports = {
  generatePaidCasualReply
};
