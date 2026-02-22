'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase336: index wires /api/admin/retention-runs route', () => {
  const file = path.join(process.cwd(), 'src/index.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/retention-runs'"));
  assert.ok(src.includes("const { handleRetentionRuns } = require('./routes/admin/retentionRuns');"));
});
