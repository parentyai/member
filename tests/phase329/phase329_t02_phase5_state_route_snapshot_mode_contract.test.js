'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase329: phase5 state summary route parses snapshotMode', () => {
  const file = path.join(process.cwd(), 'src/routes/phase5State.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const snapshotModeRaw = url.searchParams.get('snapshotMode');"));
  assert.ok(src.includes('const snapshotMode = parseSnapshotMode(snapshotModeRaw);'));
  assert.ok(src.includes("throw new Error('invalid snapshotMode')"));
});
