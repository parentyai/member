'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { composeConciergeReply } = require('../../src/usecases/assistant/concierge/composeConciergeReply');

test('phase727: compose concierge audit emits counterfactualEval metadata', async () => {
  const result = await composeConciergeReply({
    question: 'visa renewal timeline for spouse',
    baseReplyText: '更新期限の確認手順を整理します。',
    userTier: 'paid',
    plan: 'pro',
    journeyPhase: 'pre',
    contextSnapshot: {
      phase: 'pre',
      topTasks: [{ key: 'visa_deadline' }, { key: 'medical_check' }],
      blockedTask: { key: 'visa_deadline', status: 'locked' }
    },
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled', BANDIT_ENABLED: '0' }
  });

  assert.equal(result.ok, true);
  assert.ok(result.auditMeta);
  assert.ok(result.auditMeta.counterfactualEval);
  assert.equal(result.auditMeta.counterfactualEval.version, 'v1');
  assert.equal(typeof result.auditMeta.counterfactualEval.opportunityDetected, 'boolean');
  assert.ok(Number.isFinite(Number(result.auditMeta.counterfactualEval.scoreGap)));
});
