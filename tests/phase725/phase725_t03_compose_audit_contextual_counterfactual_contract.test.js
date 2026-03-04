'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { composeConciergeReply } = require('../../src/usecases/assistant/concierge/composeConciergeReply');

test('phase725: compose concierge audit includes contextual features and counterfactual arms', async () => {
  const result = await composeConciergeReply({
    question: 'visa renewal deadline for dependents',
    baseReplyText: '手続きの優先順位を整理します。',
    userTier: 'paid',
    plan: 'pro',
    journeyPhase: 'pre',
    contextSnapshot: {
      phase: 'pre',
      topTasks: [{ key: 'task_a' }, { key: 'task_b' }],
      blockedTask: { key: 'task_a', status: 'locked' }
    },
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled', BANDIT_ENABLED: '0' }
  });

  assert.equal(result.ok, true);
  assert.ok(result.auditMeta);
  assert.ok(result.auditMeta.contextualFeatures);
  assert.ok(Array.isArray(result.auditMeta.counterfactualTopArms));
  assert.ok(result.auditMeta.counterfactualTopArms.length >= 1);
  assert.ok(['A', 'B', 'C'].includes(result.auditMeta.mode));
});
