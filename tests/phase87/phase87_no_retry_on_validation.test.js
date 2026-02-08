'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createRetryPolicy } = require('../../src/domain/retryPolicy');

test('phase87: no retry on validation error', () => {
  const policy = createRetryPolicy({ maxRetries: 3, randomFn: () => 0 });
  const err = new Error('invalid payload');

  assert.strictEqual(policy.shouldRetry(err, 0), false);
});
