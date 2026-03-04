'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  finalizeLlmActionRewards
} = require('../../src/usecases/assistant/learning/finalizeLlmActionRewards');

test('phase727: reward finalizer stores counterfactual evaluation and increments summary counters', async () => {
  const patched = [];
  const createdAt = new Date('2026-01-01T00:00:00.000Z').toISOString();

  const summary = await finalizeLlmActionRewards({
    dryRun: false,
    limit: 10,
    rewardWindowHours: 48,
    now: '2026-01-05T00:00:00.000Z'
  }, {
    llmActionLogsRepo: {
      toDate(value) {
        return new Date(value);
      },
      async listPendingLlmActionLogs() {
        return [{
          id: 'a1',
          lineUserId: 'U1',
          createdAt,
          banditEnabled: true,
          contextualBanditEnabled: false,
          chosenAction: { armId: 'Checklist|cta=1', score: 0.61 },
          counterfactualSelectedArmId: 'Checklist|cta=1',
          counterfactualSelectedRank: 2,
          counterfactualTopArms: [
            { rank: 1, armId: 'Coach|cta=1', score: 0.79 },
            { rank: 2, armId: 'Checklist|cta=1', score: 0.61 }
          ],
          segmentKey: 'pre|paid|high',
          blockedReasons: [],
          evidenceOutcome: 'SUPPORTED'
        }];
      },
      async patchLlmActionLog(id, patch) {
        patched.push({ id, patch });
      },
      async listLlmActionLogsByLineUserId() {
        return [];
      }
    },
    llmBanditStateRepo: {
      async recordBanditReward() {
        return { ok: true };
      }
    },
    llmContextualBanditStateRepo: {
      async recordBanditReward() {
        return { ok: true };
      }
    },
    deliveriesRepo: {
      async listDeliveriesByUser() {
        return [];
      }
    },
    journeyTodoItemsRepo: {
      async listJourneyTodoItemsByLineUserId() {
        return [];
      }
    }
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.updated, 1);
  assert.equal(summary.counterfactualEvaluated, 1);
  assert.equal(summary.counterfactualOpportunityDetected, 1);
  assert.equal(patched.length, 1);
  assert.ok(patched[0].patch.counterfactualEval);
  assert.equal(patched[0].patch.counterfactualEval.opportunityDetected, true);
});
