'use strict';

const userConsentsRepo = require('../../repos/firestore/userConsentsRepo');
const { answerFaqFromKb } = require('./answerFaqFromKb');

const LINE_TEXT_LIMIT = 1900; // LINE message text limit (2000 chars), with buffer

function mapBlockedReasonToLineMessage(blockedReason) {
  const reason = String(blockedReason || '');
  switch (reason) {
    case 'user_consent_not_accepted':
      return 'AI機能の利用に同意していません。\n「AI同意」とメッセージを送ると同意できます。';
    case 'llm_disabled':
      return 'AI機能は現在無効です。';
    case 'consent_missing':
      return 'AI機能の利用には管理者の設定が必要です。';
    case 'low_confidence':
    case 'kb_no_match':
    case 'no_kb_match':
      return '申し訳ございません。該当するFAQが見つかりませんでした。';
    case 'contact_source_required':
      return 'この内容については、お問い合わせフォームよりご連絡ください。';
    default:
      return '申し訳ございません。現在回答できません。';
  }
}

function formatFaqAnswerForLine(result) {
  const faqAnswer = result.faqAnswer || {};
  let text = '';
  if (typeof faqAnswer.answer === 'string' && faqAnswer.answer.trim()) {
    text = faqAnswer.answer.trim();
  }
  if (!text) return '回答が見つかりませんでした。';
  if (result.disclaimer && typeof result.disclaimer === 'string') {
    text = text + '\n\n' + result.disclaimer;
  }
  if (text.length > LINE_TEXT_LIMIT) {
    text = text.slice(0, LINE_TEXT_LIMIT - 3) + '...';
  }
  return text;
}

async function answerFaqForLine(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;
  const locale = payload.locale || 'ja';

  if (!lineUserId || typeof lineUserId !== 'string') throw new Error('lineUserId required');
  if (!question) throw new Error('question required');

  const getUserConsent = deps && deps.getUserLlmConsent
    ? deps.getUserLlmConsent
    : userConsentsRepo.getUserLlmConsent;

  const consent = await getUserConsent(lineUserId);
  const consentStatus = consent ? consent.llmConsentStatus : null;

  if (consentStatus !== 'accepted') {
    return {
      ok: true,
      blocked: true,
      blockedReason: 'user_consent_not_accepted',
      lineMessage: mapBlockedReasonToLineMessage('user_consent_not_accepted')
    };
  }

  const faqFn = deps && deps.answerFaqFromKb ? deps.answerFaqFromKb : answerFaqFromKb;
  const result = await faqFn({
    question,
    locale,
    traceId,
    requestId,
    actor: lineUserId
  }, deps);

  if (result.blocked) {
    return {
      ok: true,
      blocked: true,
      blockedReason: result.blockedReason,
      lineMessage: mapBlockedReasonToLineMessage(result.blockedReason)
    };
  }

  return {
    ok: true,
    blocked: false,
    lineMessage: formatFaqAnswerForLine(result),
    faqAnswer: result.faqAnswer,
    traceId: result.traceId
  };
}

module.exports = {
  answerFaqForLine,
  mapBlockedReasonToLineMessage,
  formatFaqAnswerForLine
};
