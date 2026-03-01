'use strict';

const fs = require('fs');
const assert = require('assert');
const { test } = require('node:test');

test('phase73: retry queue give-up endpoint wiring contract', () => {
  const routeCode = fs.readFileSync('src/routes/phase73RetryQueue.js', 'utf8');
  const indexCode = fs.readFileSync('src/index.js', 'utf8');

  assert.ok(routeCode.includes('handleGiveUpSend'));
  assert.ok(routeCode.includes('ENABLE_RETRY_QUEUE_GIVEUP_V1'));
  assert.ok(indexCode.includes("/api/phase73/retry-queue/give-up"));
});
