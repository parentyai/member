'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { encodeCursor, decodeCursor } = require('../../src/infra/cursorSigner');

test('phase60: tampered cursor is rejected', () => {
  const secret = 'test-secret';
  const token = encodeCursor({
    lastSortKey: {
      readinessRank: 1,
      cursorCandidate: '2026-02-08T03:10:00.000Z',
      lineUserId: 'U9'
    }
  }, { secret });

  const parts = token.split('.');
  assert.strictEqual(parts.length, 3);
  const tamperedSig = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
  const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;

  assert.throws(
    () => decodeCursor(tampered, { secret, enforce: true }),
    /invalid cursor/
  );
});
