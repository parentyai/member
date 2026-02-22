'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase330: phase4 notifications summary route parses snapshotMode', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsOverview.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const snapshotModeRaw = url.searchParams.get('snapshotMode');"));
  assert.ok(src.includes('const snapshotMode = parseSnapshotMode(snapshotModeRaw);'));
  assert.ok(src.includes("throw new Error('invalid snapshotMode')"));
  assert.ok(src.includes('snapshotMode'));
});
