'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createRateLimiter } = require('../../src/domain/rateLimiter');

test('phase86: rate limit applied with sleep', async () => {
  const sleeps = [];
  let now = 0;
  const limiter = createRateLimiter({
    rps: 2,
    nowFn: () => now,
    sleepFn: async (ms) => {
      sleeps.push(ms);
      now += ms;
    }
  });

  await limiter();
  await limiter();

  assert.ok(sleeps.length >= 1);
  assert.ok(sleeps[0] >= 500);
});
