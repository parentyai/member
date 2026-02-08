'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createConfirmToken, verifyConfirmToken } = require('../../src/domain/confirmToken');

test('phase82: confirm token rejects mismatch', () => {
  const now = new Date('2026-02-08T00:05:00Z');
  const token = createConfirmToken({
    planHash: 'hash',
    templateKey: 'ops_alert',
    templateVersion: 2,
    segmentKey: 'ready_only'
  }, {
    secret: 'secret',
    now
  });

  const ok = verifyConfirmToken(token, {
    planHash: 'hash-mismatch',
    templateKey: 'ops_alert',
    templateVersion: 2,
    segmentKey: 'ready_only'
  }, {
    secret: 'secret',
    now
  });

  assert.strictEqual(ok, false);
});
