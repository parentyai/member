'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase349: index wires ops snapshot health admin endpoint', () => {
  const file = path.join(process.cwd(), 'src/index.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/ops-snapshot-health'"));
  assert.ok(src.includes("require('./routes/admin/opsSnapshotHealth')"));
  assert.ok(src.includes('handleOpsSnapshotHealth(req, res);'));
});
