'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { answerFaqForLine, mapBlockedReasonToLineMessage, formatFaqAnswerForLine } = require('../../src/usecases/faq/answerFaqForLine');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConsentDep(status) {
  // status: 'accepted' | 'revoked' | 'pending' | null (no record)
  return async (lineUserId) => {
    if (status === null) return null;
    return { id: lineUserId, lineUserId, llmConsentStatus: status, llmConsentVersion: 'llm_consent_v1' };
  };
}

function makeSuccessfulFaqDep(answerText) {
  return async () => ({
    ok: true,
    blocked: false,
    faqAnswer: {
      schemaId: 'FAQAnswer.v1',
      answer: answerText || 'FAQ回答テキストです。',
      citations: [],
      advisoryOnly: true,
      generatedAt: new Date().toISOString(),
      question: '質問'
    },
    disclaimer: '【免責】この情報はAI生成です。',
    traceId: 'tr-001'
  });
}

function makeBlockedFaqDep(blockedReason) {
  return async () => ({
    ok: true,
    blocked: true,
    blockedReason: blockedReason || 'llm_disabled',
    blockedReasonCategory: 'LLM_DISABLED',
    fallbackActions: [],
    suggestedFaqs: []
  });
}

// ---------------------------------------------------------------------------
// mapBlockedReasonToLineMessage
// ---------------------------------------------------------------------------

test('mapBlockedReasonToLineMessage: user_consent_not_accepted returns consent prompt', () => {
  const msg = mapBlockedReasonToLineMessage('user_consent_not_accepted');
  assert.ok(msg.includes('同意'), `Expected consent message, got: ${msg}`);
  assert.ok(msg.includes('AI同意'), `Expected AI同意 hint, got: ${msg}`);
});

test('mapBlockedReasonToLineMessage: llm_disabled returns disabled message', () => {
  const msg = mapBlockedReasonToLineMessage('llm_disabled');
  assert.ok(msg.includes('無効'), `Got: ${msg}`);
});

test('mapBlockedReasonToLineMessage: low_confidence returns not-found message', () => {
  const msg = mapBlockedReasonToLineMessage('low_confidence');
  assert.ok(msg.includes('見つかりません') || msg.includes('FAQ'), `Got: ${msg}`);
});

test('mapBlockedReasonToLineMessage: contact_source_required returns contact message', () => {
  const msg = mapBlockedReasonToLineMessage('contact_source_required');
  assert.ok(msg.includes('お問い合わせ') || msg.includes('ご連絡'), `Got: ${msg}`);
});

test('mapBlockedReasonToLineMessage: unknown reason returns default message', () => {
  const msg = mapBlockedReasonToLineMessage('something_unknown');
  assert.ok(typeof msg === 'string' && msg.length > 0);
});

// ---------------------------------------------------------------------------
// formatFaqAnswerForLine
// ---------------------------------------------------------------------------

test('formatFaqAnswerForLine: returns answer text with disclaimer', () => {
  const result = {
    faqAnswer: { answer: 'これがFAQの回答です。' },
    disclaimer: '免責事項テキスト'
  };
  const msg = formatFaqAnswerForLine(result);
  assert.ok(msg.includes('これがFAQの回答です。'), `Got: ${msg}`);
  assert.ok(msg.includes('免責事項テキスト'), `Got: ${msg}`);
});

test('formatFaqAnswerForLine: truncates text over LINE limit', () => {
  const longText = 'A'.repeat(2000);
  const result = { faqAnswer: { answer: longText }, disclaimer: null };
  const msg = formatFaqAnswerForLine(result);
  assert.ok(msg.length <= 1903, `Message too long: ${msg.length}`);
  assert.ok(msg.endsWith('...'), `Should end with ellipsis: ${msg.slice(-10)}`);
});

test('formatFaqAnswerForLine: returns fallback for empty answer', () => {
  const result = { faqAnswer: { answer: '' }, disclaimer: null };
  const msg = formatFaqAnswerForLine(result);
  assert.ok(typeof msg === 'string' && msg.length > 0);
});

// ---------------------------------------------------------------------------
// answerFaqForLine
// ---------------------------------------------------------------------------

test('answerFaqForLine: throws when lineUserId missing', async () => {
  await assert.rejects(
    () => answerFaqForLine({ question: '質問' }, {}),
    /lineUserId required/
  );
});

test('answerFaqForLine: throws when question missing', async () => {
  await assert.rejects(
    () => answerFaqForLine({ lineUserId: 'U_001' }, {}),
    /question required/
  );
});

test('answerFaqForLine: returns user_consent_not_accepted when consent is null (no record)', async () => {
  const deps = { getUserLlmConsent: makeConsentDep(null) };
  const result = await answerFaqForLine({ lineUserId: 'U_001', question: 'FAQ質問' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.blocked, true);
  assert.equal(result.blockedReason, 'user_consent_not_accepted');
  assert.ok(result.lineMessage.includes('同意'));
});

test('answerFaqForLine: returns user_consent_not_accepted when consent is pending', async () => {
  const deps = { getUserLlmConsent: makeConsentDep('pending') };
  const result = await answerFaqForLine({ lineUserId: 'U_002', question: 'FAQ質問' }, deps);
  assert.equal(result.blocked, true);
  assert.equal(result.blockedReason, 'user_consent_not_accepted');
});

test('answerFaqForLine: returns user_consent_not_accepted when consent is revoked', async () => {
  const deps = { getUserLlmConsent: makeConsentDep('revoked') };
  const result = await answerFaqForLine({ lineUserId: 'U_003', question: 'FAQ質問' }, deps);
  assert.equal(result.blocked, true);
  assert.equal(result.blockedReason, 'user_consent_not_accepted');
});

test('answerFaqForLine: calls answerFaqFromKb when consent is accepted', async () => {
  let faqCalled = false;
  const deps = {
    getUserLlmConsent: makeConsentDep('accepted'),
    answerFaqFromKb: async (params) => {
      faqCalled = true;
      assert.equal(params.question, 'FAQ質問');
      assert.equal(params.actor, 'U_004');
      return makeSuccessfulFaqDep()();
    }
  };
  const result = await answerFaqForLine({ lineUserId: 'U_004', question: 'FAQ質問' }, deps);
  assert.ok(faqCalled, 'answerFaqFromKb should have been called');
  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
  assert.ok(result.lineMessage.length > 0);
});

test('answerFaqForLine: returns formatted answer when FAQ succeeds', async () => {
  const deps = {
    getUserLlmConsent: makeConsentDep('accepted'),
    answerFaqFromKb: makeSuccessfulFaqDep('正しいFAQ回答です。')
  };
  const result = await answerFaqForLine({ lineUserId: 'U_005', question: 'FAQ質問' }, deps);
  assert.equal(result.blocked, false);
  assert.ok(result.lineMessage.includes('正しいFAQ回答'), `Got: ${result.lineMessage}`);
  assert.ok(result.lineMessage.includes('免責'), `Should include disclaimer, got: ${result.lineMessage}`);
});

test('answerFaqForLine: maps blocked FAQ result to LINE message', async () => {
  const deps = {
    getUserLlmConsent: makeConsentDep('accepted'),
    answerFaqFromKb: makeBlockedFaqDep('llm_disabled')
  };
  const result = await answerFaqForLine({ lineUserId: 'U_006', question: 'FAQ質問' }, deps);
  assert.equal(result.blocked, true);
  assert.equal(result.blockedReason, 'llm_disabled');
  assert.ok(result.lineMessage.includes('無効') || result.lineMessage.length > 0);
});

test('answerFaqForLine: maps low_confidence blocked result to LINE message', async () => {
  const deps = {
    getUserLlmConsent: makeConsentDep('accepted'),
    answerFaqFromKb: makeBlockedFaqDep('low_confidence')
  };
  const result = await answerFaqForLine({ lineUserId: 'U_007', question: '難しい質問' }, deps);
  assert.equal(result.blocked, true);
  assert.ok(result.lineMessage.includes('見つかりません') || result.lineMessage.includes('FAQ'));
});

test('answerFaqForLine: passes locale from params', async () => {
  let receivedLocale;
  const deps = {
    getUserLlmConsent: makeConsentDep('accepted'),
    answerFaqFromKb: async (params) => {
      receivedLocale = params.locale;
      return makeSuccessfulFaqDep()();
    }
  };
  await answerFaqForLine({ lineUserId: 'U_008', question: 'FAQ', locale: 'en' }, deps);
  assert.equal(receivedLocale, 'en');
});

test('answerFaqForLine: defaults locale to ja', async () => {
  let receivedLocale;
  const deps = {
    getUserLlmConsent: makeConsentDep('accepted'),
    answerFaqFromKb: async (params) => {
      receivedLocale = params.locale;
      return makeSuccessfulFaqDep()();
    }
  };
  await answerFaqForLine({ lineUserId: 'U_009', question: 'FAQ' }, deps);
  assert.equal(receivedLocale, 'ja');
});
