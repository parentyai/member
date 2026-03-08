'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase749: FAQ blocked audit includes enforced answer readiness fields', async () => {
  const audits = [];
  const result = await answerFaqFromKb({
    question: '学校手続きについて教えてください',
    locale: 'ja',
    guideMode: 'faq_navigation',
    traceId: 'phase749_faq_readiness',
    actor: 'phase749_test'
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
          id: 'kb_phase749_1',
          title: '学校手続き',
          body: '案内',
          tags: ['school'],
          riskLevel: 'medium',
          linkRegistryIds: ['lk_school'],
          searchScore: 1.9
        }
      ])
    },
    appendAuditLog: async (entry) => {
      audits.push(entry);
      return { id: `audit_${audits.length}` };
    },
    faqAnswerLogsRepo: {
      appendFaqAnswerLog: async () => ({ id: 'faq_log_phase749' })
    }
  });

  assert.equal(result.ok, false);
  const blockedAudit = audits.find((entry) => entry && entry.action === 'llm_faq_answer_blocked');
  assert.ok(blockedAudit, 'blocked audit should exist');
  const summary = blockedAudit.payloadSummary || {};
  assert.equal(summary.answerReadinessLogOnly, false);
  assert.equal(typeof summary.readinessDecision, 'string');
  assert.ok(Array.isArray(summary.readinessReasonCodes));
  assert.equal(typeof summary.readinessSafeResponseMode, 'string');
  assert.ok(Number.isFinite(Number(summary.unsupportedClaimCount)));
  assert.equal(typeof summary.contradictionDetected, 'boolean');
});
