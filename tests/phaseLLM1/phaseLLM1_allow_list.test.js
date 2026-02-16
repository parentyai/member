'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { sanitizeInput } = require('../../src/llm/allowList');

test('phaseLLM1: allow list blocks extra fields', () => {
  const input = {
    readiness: { status: 'READY', blocking: [] },
    allowedNextActions: ['NO_ACTION'],
    lineUserId: 'U1'
  };
  const allowList = ['readiness.status', 'allowedNextActions'];
  const result = sanitizeInput({ input, allowList });
  assert.strictEqual(result.ok, false);
  assert.ok(result.blockedPaths.includes('readiness.blocking'));
  assert.ok(result.blockedPaths.includes('lineUserId'));
});

test('phaseLLM1: allow list passes and filters', () => {
  const input = {
    readiness: { status: 'READY' },
    allowedNextActions: ['NO_ACTION']
  };
  const allowList = ['readiness.status', 'allowedNextActions'];
  const result = sanitizeInput({ input, allowList });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.data, {
    readiness: { status: 'READY' },
    allowedNextActions: ['NO_ACTION']
  });
});
