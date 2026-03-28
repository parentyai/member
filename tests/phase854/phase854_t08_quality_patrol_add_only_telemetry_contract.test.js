'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: admin dictionary keeps quality patrol telemetry add-only wording', () => {
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  assert.ok(dict.includes('Quality Patrol'));
  assert.ok(dict.includes('add-only'));
  assert.ok(dict.includes('response-quality contract version'));
  assert.ok(dict.includes('run provenance'));
  assert.ok(dict.includes('counterexample queue'));
});
