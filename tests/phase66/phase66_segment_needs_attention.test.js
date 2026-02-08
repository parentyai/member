'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildSendSegment } = require('../../src/usecases/phase66/buildSendSegment');

test('phase66: segment needsAttention filters', async () => {
  const deps = {
    listOpsConsole: async () => ({
      items: [
        { lineUserId: 'U1', readiness: { status: 'READY', blocking: [] }, recommendedNextAction: 'NO_ACTION', allowedNextActions: ['NO_ACTION'] },
        { lineUserId: 'U2', readiness: { status: 'READY', blocking: ['missing_ops_state'] }, recommendedNextAction: 'NO_ACTION', allowedNextActions: ['NO_ACTION'] },
        { lineUserId: 'U3', readiness: { status: 'NOT_READY', blocking: ['missing'] }, recommendedNextAction: 'STOP_AND_ESCALATE', allowedNextActions: ['STOP_AND_ESCALATE'] }
      ]
    })
  };

  const result = await buildSendSegment({ needsAttention: '1' }, deps);
  const ids = result.items.map((item) => item.lineUserId);
  assert.deepStrictEqual(ids, ['U2', 'U3']);
});
