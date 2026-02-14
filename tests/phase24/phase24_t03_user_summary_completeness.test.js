'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateUserSummaryCompleteness } = require('../../src/usecases/phase24/userSummaryCompleteness');

test('phase24 t03: memberNumber missing => BLOCK', () => {
  const result = evaluateUserSummaryCompleteness({
    member: {
      hasMemberNumber: false,
      memberNumberStale: false
    }
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('missing_member_number'));
  assert.strictEqual(result.severity, 'BLOCK');
  assert.strictEqual(result.needsAttention, true);
});

test('phase24 t03: memberNumber stale => WARN', () => {
  const result = evaluateUserSummaryCompleteness({
    member: {
      hasMemberNumber: false,
      memberNumberStale: true
    }
  });
  assert.strictEqual(result.ok, true);
  assert.ok(result.missing.includes('stale_member_number'));
  assert.strictEqual(result.severity, 'WARN');
  assert.strictEqual(result.needsAttention, true);
});

test('phase24 t03: memberNumber ok => INFO', () => {
  const result = evaluateUserSummaryCompleteness({
    member: {
      hasMemberNumber: true,
      memberNumberStale: false
    }
  });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.missing, []);
  assert.strictEqual(result.severity, 'INFO');
  assert.strictEqual(result.needsAttention, false);
});

test('phase24 t03: checklist incomplete => WARN', () => {
  const result = evaluateUserSummaryCompleteness({
    member: {
      hasMemberNumber: true,
      memberNumberStale: false
    },
    checklist: {
      completion: { isComplete: false }
    }
  });
  assert.strictEqual(result.ok, true);
  assert.ok(result.missing.includes('checklist_incomplete'));
  assert.strictEqual(result.severity, 'WARN');
  assert.strictEqual(result.needsAttention, true);
});
