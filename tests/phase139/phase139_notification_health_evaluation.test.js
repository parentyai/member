'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateNotificationHealth } = require('../../src/usecases/phase139/evaluateNotificationHealth');

test('phase139: notification health evaluation thresholds are fixed', async () => {
  assert.strictEqual(evaluateNotificationHealth({ sent: 0, ctr: 0 }), 'OK');
  assert.strictEqual(evaluateNotificationHealth({ sent: 29, ctr: 0 }), 'OK');
  assert.strictEqual(evaluateNotificationHealth({ sent: 30, ctr: 0.049 }), 'DANGER');
  assert.strictEqual(evaluateNotificationHealth({ sent: 30, ctr: 0.05 }), 'WARN');
  assert.strictEqual(evaluateNotificationHealth({ sent: 30, ctr: 0.149 }), 'WARN');
  assert.strictEqual(evaluateNotificationHealth({ sent: 30, ctr: 0.15 }), 'OK');
  assert.strictEqual(evaluateNotificationHealth({ sent: 120, ctr: 0.283 }), 'OK');
});

