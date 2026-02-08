'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildSendSegment } = require('../../src/usecases/phase66/buildSendSegment');

test('phase66: segment READY only', async () => {
  const deps = {
    listOpsConsole: async (params) => {
      const items = [
        { lineUserId: 'U1', readiness: { status: 'READY', blocking: [] }, recommendedNextAction: 'NO_ACTION', allowedNextActions: ['NO_ACTION'] },
        { lineUserId: 'U2', readiness: { status: 'NOT_READY', blocking: ['missing'] }, recommendedNextAction: 'STOP_AND_ESCALATE', allowedNextActions: ['STOP_AND_ESCALATE'] }
      ];
      if (params && params.status === 'READY') {
        return { items: items.filter((item) => item.readiness.status === 'READY') };
      }
      return { items };
    }
  };

  const result = await buildSendSegment({ readinessStatus: 'READY' }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].lineUserId, 'U1');
});
