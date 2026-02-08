'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createRetryPolicy } = require('../../src/domain/retryPolicy');

test('phase87: retry transient errors', () => {
  const policy = createRetryPolicy({ maxRetries: 3, randomFn: () => 0 });
  const err = new Error('rate limit');
  err.status = 429;

  assert.strictEqual(policy.shouldRetry(err, 0), true);
  const delay = policy.getDelayMs(0);
  assert.ok(delay >= 180);
  assert.ok(delay <= 200);
});
