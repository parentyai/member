'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { sanitizeFaqAuditPayload } = require('../../src/domain/audit/faqAuditPayloadGuard');
const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase802: faq audit payload guard preserves saved FAQ telemetry while dropping raw payloads', () => {
  const sanitized = sanitizeFaqAuditPayload({
    traceId: 'trace_phase802_guard',
    questionHash: 'hash_1',
    policySource: 'system_flags',
    policyContext: 'default',
    savedFaqReused: true,
    savedFaqReusePass: false,
    savedFaqReuseReasonCodes: ['saved_faq_missing_official_source_refs'],
    sourceSnapshotRefs: ['lk_ssn'],
    fullReplyText: 'drop_me',
    rawPrompt: 'drop_me',
    rawKbBodies: ['drop_me'],
    fullRequestBody: { drop: true }
  });

  assert.equal(sanitized.policySource, 'system_flags');
  assert.equal(sanitized.policyContext, 'default');
  assert.equal(sanitized.savedFaqReused, true);
  assert.equal(sanitized.savedFaqReusePass, false);
  assert.deepEqual(sanitized.savedFaqReuseReasonCodes, ['saved_faq_missing_official_source_refs']);
  assert.deepEqual(sanitized.sourceSnapshotRefs, ['lk_ssn']);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'fullReplyText'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'rawPrompt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'rawKbBodies'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'fullRequestBody'), false);
});

test('phase802: answerFaqFromKb returns saved FAQ governance telemetry on blocked result', async () => {
  const result = await answerFaqFromKb({
    question: 'SSNの必要書類は？',
    locale: 'ja',
    intent: 'ssn',
    guideMode: 'faq_navigation',
    traceId: 'phase802_saved_faq',
    actor: 'phase802_test'
  }, {
    env: { LLM_FEATURE_FLAG: 'true' },
    getLlmEnabled: async () => true,
    getLlmPolicy: async () => ({
      lawfulBasis: 'consent',
      consentVerified: false,
      crossBorder: false
    }),
    faqArticlesRepo: {
      searchActiveArticles: async () => ([
        {
          id: 'faq_ssn_saved',
          title: 'SSN',
          body: 'saved faq body',
          tags: ['ssn'],
          riskLevel: 'high',
          allowedIntents: ['ssn'],
          validUntil: '2099-12-31T00:00:00.000Z',
          linkRegistryIds: [],
          searchScore: 2.5
        }
      ])
    },
    appendAuditLog: async () => ({ id: 'audit_1' }),
    faqAnswerLogsRepo: {
      appendFaqAnswerLog: async () => ({ id: 'faqlog_1' })
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.policySource, 'system_flags');
  assert.equal(result.policyContext, 'default');
  assert.equal(result.savedFaqReused, true);
  assert.equal(result.savedFaqReusePass, false);
  assert.ok(Array.isArray(result.savedFaqReuseReasonCodes));
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_missing_official_source_refs'));
  assert.deepEqual(result.sourceSnapshotRefs, []);
});
