'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { encodeCursor, decodeCursor } = require('../../src/infra/cursorSigner');

test('phase60: cursor HMAC roundtrip', () => {
  const secret = 'test-secret';
  const payload = {
    lastSortKey: {
      readinessRank: 0,
      cursorCandidate: '2026-02-08T03:20:00.000Z',
      lineUserId: 'U1'
    },
    issuedAt: 123456
  };

  const token = encodeCursor(payload, { secret });
  assert.ok(token.startsWith('v1.'));
  const decoded = decodeCursor(token, { secret, enforce: true });
  assert.strictEqual(decoded.v, 1);
  assert.strictEqual(decoded.issuedAt, 123456);
  assert.strictEqual(decoded.lastSortKey.readinessRank, 0);
  assert.strictEqual(decoded.lastSortKey.cursorCandidate, '2026-02-08T03:20:00.000Z');
  assert.strictEqual(decoded.lastSortKey.lineUserId, 'U1');
});
