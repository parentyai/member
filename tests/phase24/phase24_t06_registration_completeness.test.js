'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateRegistrationCompleteness } = require('../../src/usecases/phase24/registrationCompleteness');

test('phase24 t06: memberNumber missing => BLOCK', async () => {
  const result = await evaluateRegistrationCompleteness({ id: 'U1', memberNumber: null }, { allUsers: [] });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('missing_member_number'));
  assert.strictEqual(result.severity, 'BLOCK');
});

test('phase24 t06: memberNumber invalid format => WARN', async () => {
  const result = await evaluateRegistrationCompleteness({ id: 'U1', memberNumber: 'A B' }, { allUsers: [] });
  assert.strictEqual(result.ok, true);
  assert.ok(result.missing.includes('member_number_invalid_format'));
  assert.strictEqual(result.severity, 'WARN');
});

test('phase24 t06: duplicate memberNumber => BLOCK', async () => {
  const allUsers = [
    { id: 'U1', memberNumber: 'M1' },
    { id: 'U2', memberNumber: 'M1' }
  ];
  const result = await evaluateRegistrationCompleteness({ id: 'U1', memberNumber: 'M1' }, { allUsers });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('duplicate_member_number'));
  assert.strictEqual(result.severity, 'BLOCK');
});

test('phase24 t06: normal => OK', async () => {
  const allUsers = [{ id: 'U1', memberNumber: 'M1' }];
  const result = await evaluateRegistrationCompleteness({ id: 'U1', memberNumber: 'M1' }, { allUsers });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.missing, []);
  assert.strictEqual(result.severity, 'OK');
});
