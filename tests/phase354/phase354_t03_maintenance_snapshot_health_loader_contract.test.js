'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase354: admin app loads snapshot health via admin API', () => {
  const file = path.join(process.cwd(), 'apps/admin/assets/admin_app.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('async function loadSnapshotHealth(options)'));
  assert.ok(src.includes('/api/admin/ops-snapshot-health?'));
  assert.ok(src.includes('renderSnapshotHealth(state.snapshotHealthItems);'));
  assert.ok(src.includes('maintenance-snapshot-health-reload'));
});
