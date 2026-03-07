'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveLlmLegalPolicySnapshot } = require('../../src/domain/llm/policy/resolveLlmLegalPolicySnapshot');
const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase747: resolveLlmLegalPolicySnapshot blocks consent basis when consent is missing', () => {
  const snapshot = resolveLlmLegalPolicySnapshot({
    policy: {
      lawfulBasis: 'consent',
      consentVerified: false,
      crossBorder: true
    }
  });
  assert.equal(snapshot.lawfulBasis, 'consent');
  assert.equal(snapshot.consentVerified, false);
  assert.equal(snapshot.crossBorder, true);
  assert.equal(snapshot.legalDecision, 'blocked');
  assert.ok(snapshot.legalReasonCodes.includes('consent_missing'));
  assert.ok(snapshot.legalReasonCodes.includes('cross_border_enabled'));
});

test('phase747: FAQ audit summary includes legal decision fields from shared resolver', async () => {
  const audits = [];
  const result = await answerFaqFromKb({
    question: '手続きを教えて',
    locale: 'ja',
    guideMode: 'faq_navigation',
    traceId: 'phase747_faq_legal',
    actor: 'phase747_test'
  }, {
    env: { LLM_FEATURE_FLAG: 'true' },
    getLlmEnabled: async () => true,
    getLlmPolicy: async () => ({
      lawfulBasis: 'consent',
      consentVerified: false,
      crossBorder: true
    }),
    faqArticlesRepo: {
      searchActiveArticles: async () => ([
        {
          id: 'kb1',
          title: '学校手続き',
          body: '案内',
          tags: [],
          riskLevel: 'low',
          linkRegistryIds: ['lk_school'],
          searchScore: 2.1
        }
      ])
    },
    appendAuditLog: async (entry) => {
      audits.push(entry);
      return { id: `audit_${audits.length}` };
    },
    faqAnswerLogsRepo: {
      appendFaqAnswerLog: async () => ({ id: 'faqlog_1' })
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.blockedReason, 'consent_missing');
  const blockedAudit = audits.find((entry) => entry && entry.action === 'llm_faq_answer_blocked');
  assert.ok(blockedAudit);
  const summary = blockedAudit.payloadSummary || {};
  assert.equal(summary.lawfulBasis, 'consent');
  assert.equal(summary.consentVerified, false);
  assert.equal(summary.crossBorder, true);
  assert.equal(summary.legalDecision, 'blocked');
  assert.ok(Array.isArray(summary.legalReasonCodes));
  assert.ok(summary.legalReasonCodes.includes('consent_missing'));
});
