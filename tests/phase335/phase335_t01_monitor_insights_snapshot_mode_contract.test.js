'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase335: monitor insights route parses snapshotMode and has require no-fallback branch', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/monitorInsights.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const snapshotModeRaw = url.searchParams.get('snapshotMode');"));
  assert.ok(src.includes('normalizeSnapshotMode(snapshotModeRaw)'));
  assert.ok(src.includes('isSnapshotRequired(snapshotMode)'));
  assert.ok(src.includes("'NOT AVAILABLE'"));
});
