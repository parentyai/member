'use strict';

const assert = require('assert');
const { test } = require('node:test');

const messages = require('../../src/domain/ridacLineMessages');

test('phase164: ridac line message templates include next action guidance', () => {
  const declared = messages.statusDeclared('1234');
  const unlinked = messages.statusUnlinked();
  const none = messages.statusNotDeclared();
  const linked = messages.declareLinked();
  const duplicate = messages.declareDuplicate();
  const invalid = messages.declareInvalidFormat();
  const usage = messages.declareUsage();
  const misconfigured = messages.declareServerMisconfigured();

  assert.ok(declared.includes('末尾: 1234'));
  assert.ok(declared.includes('次にすること'));
  assert.ok(declared.includes('会員ID 00-0000'));
  assert.ok(unlinked.includes('次にすること'));
  assert.ok(unlinked.includes('会員ID 00-0000'));
  assert.ok(none.includes('次にすること'));
  assert.ok(none.includes('会員ID 00-0000'));
  assert.ok(linked.includes('次にすること'));
  assert.ok(linked.includes('会員ID 確認'));
  assert.ok(duplicate.includes('次にすること'));
  assert.ok(duplicate.includes('再確認'));
  assert.ok(invalid.includes('次にすること'));
  assert.ok(invalid.includes('会員ID 00-0000'));
  assert.ok(usage.includes('次にすること'));
  assert.ok(usage.includes('会員ID 00-0000'));
  assert.ok(usage.includes('会員ID 確認'));
  assert.ok(misconfigured.includes('次にすること'));
  assert.ok(misconfigured.includes('時間をおいて再度お試しください'));
});
