'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: retention policy uses balanced profile and explicit INDEFINITE', () => {
  const src = fs.readFileSync('src/domain/retention/retentionPolicy.js', 'utf8');
  assert.ok(src.includes("kind: 'event', retentionDays: 180"));
  assert.ok(src.includes("kind: 'aggregate', retentionDays: 90"));
  assert.ok(src.includes("kind: 'transient', retentionDays: 30"));
  assert.ok(src.includes("kind: 'evidence', retentionDays: 365"));
  assert.ok(src.includes("kind: 'config', retentionDays: 'INDEFINITE'"));
  assert.ok(src.includes('retentionDays: null'));
});
