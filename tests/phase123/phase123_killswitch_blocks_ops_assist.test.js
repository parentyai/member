'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

test('phase123: killSwitch blocks ops assist suggestion', async () => {
  const result = await getOpsAssistSuggestion({ lineUserId: 'U1' }, {
    getKillSwitch: async () => true
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'kill_switch_on');
});
