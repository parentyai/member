'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase658: cleanup report generator keeps catchup checks in CI checklist contract', () => {
  const src = fs.readFileSync('scripts/generate_cleanup_reports.js', 'utf8');
  assert.ok(src.includes('## Catchup Required checks (W0-W4)'));
  assert.ok(src.includes('`npm run catchup:drift-check`'));
  assert.ok(src.includes('`npm run test:admin-nav-contract`'));
  assert.ok(src.includes('`npm run firestore-indexes:check -- --contracts-only`'));
  assert.ok(src.includes('`npm run catchup:gate:full`'));
  assert.ok(src.includes('## catchup:drift-checkで検証すること'));
  assert.ok(src.includes('repo map / docs artifacts が再生成差分なし'));
});
