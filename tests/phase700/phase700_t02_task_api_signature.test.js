'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  signTaskApiRequest,
  verifyTaskApiRequestSignature
} = require('../../src/domain/tasks/signature');

test('phase700: task api signature verifies valid signed request', () => {
  const secret = 'phase700_task_signature_secret';
  const ts = Date.parse('2026-03-02T10:00:00.000Z');
  const sig = signTaskApiRequest({
    method: 'PATCH',
    pathname: '/api/tasks/U_1__rule_a',
    userId: 'U_1',
    taskId: 'U_1__rule_a',
    ts
  }, { secret });

  const verified = verifyTaskApiRequestSignature({
    method: 'PATCH',
    pathname: '/api/tasks/U_1__rule_a',
    userId: 'U_1',
    taskId: 'U_1__rule_a',
    ts,
    sig
  }, { secret, now: ts, ttlSeconds: 300 });

  assert.equal(verified.ok, true);
  assert.equal(verified.userId, 'U_1');
});

test('phase700: task api signature rejects expired request', () => {
  const secret = 'phase700_task_signature_secret';
  const ts = Date.parse('2026-03-02T10:00:00.000Z');
  const sig = signTaskApiRequest({
    method: 'GET',
    pathname: '/api/tasks',
    userId: 'U_1',
    taskId: '',
    ts
  }, { secret });

  const verified = verifyTaskApiRequestSignature({
    method: 'GET',
    pathname: '/api/tasks',
    userId: 'U_1',
    taskId: '',
    ts,
    sig
  }, { secret, now: ts + (301 * 1000), ttlSeconds: 300 });

  assert.equal(verified.ok, false);
  assert.equal(verified.reason, 'expired');
});

test('phase700: task api signature rejects mismatched signature payload', () => {
  const secret = 'phase700_task_signature_secret';
  const ts = Date.parse('2026-03-02T10:00:00.000Z');
  const sig = signTaskApiRequest({
    method: 'GET',
    pathname: '/api/tasks',
    userId: 'U_1',
    taskId: '',
    ts
  }, { secret });

  const verified = verifyTaskApiRequestSignature({
    method: 'GET',
    pathname: '/api/tasks/U_1__rule_a',
    userId: 'U_1',
    taskId: 'U_1__rule_a',
    ts,
    sig
  }, { secret, now: ts, ttlSeconds: 300 });

  assert.equal(verified.ok, false);
  assert.equal(verified.reason, 'signature_mismatch');
});
