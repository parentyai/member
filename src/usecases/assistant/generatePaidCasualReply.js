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

function buildGeneralCasualReply(question, atoms) {
  const message = normalizeText(question);
  const prompt = atoms && typeof atoms.question === 'string' && atoms.question.trim()
    ? atoms.question.trim()
    : '優先したい手続きがあれば1つだけ教えてください。';

  if (!message) return prompt;

  return [
    '了解です。状況を短く整理しながら進めます。',
    prompt
  ].join('\n');
}

function generatePaidCasualReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
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
    replyText: trimForPaidLineMessage(buildGeneralCasualReply(messageText, suggestedAtoms))
  };
}

module.exports = {
  generatePaidCasualReply
};
