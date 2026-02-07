'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateOpsStateCompleteness } = require('../../src/usecases/phase24/opsStateCompleteness');

test('phase24 t08: missing opsState => WARN', () => {
  const result = evaluateOpsStateCompleteness(null);
  assert.deepStrictEqual(result, { status: 'WARN', missing: ['missing_ops_state'] });
});

test('phase24 t08: missing nextAction => WARN', () => {
  const result = evaluateOpsStateCompleteness({ nextAction: '' });
  assert.deepStrictEqual(result, { status: 'WARN', missing: ['missing_next_action'] });
});

test('phase24 t08: opsState with nextAction => OK', () => {
  const result = evaluateOpsStateCompleteness({ nextAction: 'NO_ACTION' });
  assert.deepStrictEqual(result, { status: 'OK', missing: [] });
});
