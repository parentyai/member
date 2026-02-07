'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { appendDecision } = require('../../src/usecases/phase24/decisionLogs');

test('phase24 t02: invalid decision enum is rejected', async () => {
  await assert.rejects(
    () => appendDecision({
      subjectType: 'user',
      subjectId: 'u1',
      decision: 'NOPE',
      decidedBy: 'ops',
      reason: ''
    }),
    /invalid decision/
  );
});
