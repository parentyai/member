'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  computeReward,
  finalizeLlmActionRewards,
  DEFAULT_REWARD_WEIGHTS
} = require('../../src/usecases/assistant/learning/finalizeLlmActionRewards');

test('phase724: balanced reward weights are fixed by contract', () => {
  const reward = computeReward({
    click: true,
    taskComplete: true,
    blockedResolved: true,
    citationMissing: true,
    wrongEvidence: true
  }, DEFAULT_REWARD_WEIGHTS);

  assert.equal(reward, -2); // 1 + 3 + 2 - 3 - 5
});

test('phase724: reward finalize updates pending logs and skips bandit update when disabled', async () => {
  const patched = [];
  const banditCalls = [];

  const createdAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
  const now = new Date('2026-01-05T00:00:00.000Z').toISOString();

  const summary = await finalizeLlmActionRewards({
    dryRun: false,
    limit: 10,
    rewardWindowHours: 48,
    now,
    traceId: 'TRACE_724'
  }, {
    llmActionLogsRepo: {
      toDate(value) {
        return new Date(value);
      },
      async listPendingLlmActionLogs() {
        return [
          {
            id: 'a1',
            lineUserId: 'U1',
            createdAt,
            banditEnabled: false,
            blockedReasons: [],
            evidenceOutcome: 'SUPPORTED',
            chosenAction: { armId: 'Coach|cta=1' },
            segmentKey: 'pre|paid|low'
          }
        ];
      },
      async patchLlmActionLog(id, patch) {
        patched.push({ id, patch });
      },
      async listLlmActionLogsByLineUserId() {
        return [];
      }
    },
    llmBanditStateRepo: {
      async recordBanditReward(payload) {
        banditCalls.push(payload);
      }
    },
    deliveriesRepo: {
      async listDeliveriesByUser() {
        return [{ clickAt: '2026-01-01T03:00:00.000Z' }];
      }
    },
    journeyTodoItemsRepo: {
      async listJourneyTodoItemsByLineUserId() {
        return [{ completedAt: '2026-01-01T04:00:00.000Z' }];
      }
    }
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.processed, 1);
  assert.equal(summary.updated, 1);
  assert.equal(summary.errors, 0);
  assert.equal(patched.length, 1);
  assert.equal(patched[0].id, 'a1');
  assert.equal(patched[0].patch.rewardPending, false);
  assert.equal(banditCalls.length, 0);
});
