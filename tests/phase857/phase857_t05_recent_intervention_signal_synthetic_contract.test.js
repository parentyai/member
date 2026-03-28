'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadRecentInterventionSignals } = require('../../src/usecases/assistant/opportunity/loadRecentInterventionSignals');

test('phase857: loadRecentInterventionSignals ignores synthetic patrol replay rows', async () => {
  const result = await loadRecentInterventionSignals({
    lineUserId: 'U_PHASE857_SIGNAL',
    recentTurns: 3
  }, {
    llmActionLogsRepo: {
      async listLlmActionLogsByLineUserId() {
        return [
          {
            traceId: 'quality_patrol_cycle_123_0',
            requestId: 'quality_patrol_cycle_123_0',
            createdAt: '2026-03-26T10:05:00.000Z',
            conversationMode: 'concierge'
          },
          {
            traceId: 'trace_phase857_signal_live',
            requestId: 'trace_phase857_signal_live',
            createdAt: '2026-03-26T10:04:00.000Z',
            conversationMode: 'concierge',
            rewardSignals: {
              click: true,
              taskDone: true
            }
          }
        ];
      }
    }
  });

  assert.equal(result.recentTurns, 3);
  assert.equal(result.recentInterventions, 1);
  assert.equal(result.recentClicks, true);
  assert.equal(result.recentTaskDone, true);
  assert.equal(result.lastInterventionAt, '2026-03-26T10:04:00.000Z');
});
