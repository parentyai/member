'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { signCursor, verifyCursor } = require('../../src/domain/cursorSigning');

test('phase80: cursor sign/verify roundtrip', () => {
  const signed = signCursor('2026-02-08T00:00:00.000Z', 'secret', false);
  const raw = verifyCursor(signed, 'secret', false);
  assert.strictEqual(raw, '2026-02-08T00:00:00.000Z');
});
