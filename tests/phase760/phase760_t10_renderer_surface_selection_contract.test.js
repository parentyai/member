'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { selectLineSurface } = require('../../src/v1/line_surface_policy/lineInteractionPolicy');

test('phase760: line surface policy selects handoff and flex appropriately', () => {
  assert.equal(selectLineSurface({ handoffRequired: true, miniAppUrl: 'https://example.com' }), 'mini_app');
  assert.equal(selectLineSurface({ handoffRequired: true, liffUrl: 'https://liff.line.me/xxx' }), 'liff');
  assert.equal(selectLineSurface({ text: 'a'.repeat(900) }), 'flex');
  assert.equal(selectLineSurface({ text: 'ok' }), 'text');
});
