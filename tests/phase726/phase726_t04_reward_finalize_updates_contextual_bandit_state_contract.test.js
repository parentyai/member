'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  finalizeLlmActionRewards
} = require('../../src/usecases/assistant/learning/finalizeLlmActionRewards');

test('phase726: reward finalizer updates contextual bandit state when contextual metadata exists', async () => {
  const banditCalls = [];
  const contextualCalls = [];
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
          contextualBanditEnabled: true,
          contextSignature: 'ctxsig_v1_abc',
          segmentKey: 'pre|paid|high',
          chosenAction: { armId: 'Checklist|cta=1' },
          blockedReasons: [],
          evidenceOutcome: 'SUPPORTED'
        }];
      },
      async patchLlmActionLog() {
        return { ok: true };
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
    llmContextualBanditStateRepo: {
      async recordBanditReward(payload) {
        contextualCalls.push(payload);
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
  assert.equal(summary.updated, 1);
  assert.equal(banditCalls.length, 1);
  assert.equal(contextualCalls.length, 1);
  assert.equal(contextualCalls[0].contextSignature, 'ctxsig_v1_abc');
});
