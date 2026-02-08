'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

test('phase40: suggestion has disclaimer and no nextAction field', async () => {
  const deps = {
    getOpsAssistContext: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION'] }
    }),
    decisionTimelineRepo: { appendTimelineEntry: async () => ({ id: 't1' }) }
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1' }, deps);
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'disclaimer'));
  assert.strictEqual(result.disclaimer, 'This is advisory only');
  assert.ok(!Object.prototype.hasOwnProperty.call(result, 'nextAction'));
  assert.strictEqual(typeof result.suggestionText, 'string');
});
