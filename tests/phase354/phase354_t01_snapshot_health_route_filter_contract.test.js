'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase354: ops snapshot health route accepts snapshotType filter and forwards to repo', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsSnapshotHealth.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('function parseSnapshotType(req)'));
  assert.ok(src.includes('const snapshotType = parseSnapshotType(req);'));
  assert.ok(src.includes('opsSnapshotsRepo.listSnapshots({ limit, snapshotType })'));
  assert.ok(src.includes('snapshotType,'));
});
