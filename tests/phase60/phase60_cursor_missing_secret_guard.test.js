'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { encodeCursor, decodeCursor } = require('../../src/infra/cursorSigner');

test('phase60: missing secret is rejected when unsigned not allowed', () => {
  assert.throws(
    () => encodeCursor({ lastSortKey: { readinessRank: 0, cursorCandidate: null, lineUserId: 'U1' } }, { allowUnsigned: false }),
    /cursor secret required/
  );

  const unsigned = encodeCursor({
    lastSortKey: { readinessRank: 0, cursorCandidate: null, lineUserId: 'U1' }
  }, { allowUnsigned: true });

  assert.throws(
    () => decodeCursor(unsigned, { allowUnsigned: false }),
    /cursor secret required/
  );
});
