'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { composeConciergeReply } = require('../../src/usecases/assistant/concierge/composeConciergeReply');

test('phase726: compose passes contextSignature to stateFetcher and emits contextual bandit audit fields', async () => {
  const fetchedArgs = [];
  const result = await composeConciergeReply({
    question: 'visa update deadline',
    baseReplyText: 'まず重要ポイントを整理します。',
    userTier: 'paid',
    plan: 'pro',
    journeyPhase: 'pre',
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' }
    ],
    bandit: {
      enabled: true,
      epsilon: 0.1,
      randomFn: () => 0.9,
      stateFetcher: async (args) => {
        fetchedArgs.push(args);
        return {
          stateByArm: {},
          contextualStateByArm: {
            'Checklist|cta=1': { pulls: 2, avgReward: 5 }
          }
        };
      }
    },
    env: {
      WEB_SEARCH_PROVIDER: 'disabled',
      BANDIT_ENABLED: '1'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(fetchedArgs.length, 1);
  assert.equal(typeof fetchedArgs[0].segmentKey, 'string');
  assert.equal(typeof fetchedArgs[0].contextSignature, 'string');

  assert.equal(typeof result.auditMeta.contextSignature, 'string');
  assert.equal(result.auditMeta.contextualBanditEnabled, true);
  assert.ok(String(result.auditMeta.chosenAction.selectionSource).startsWith('bandit_contextual_'));
});
