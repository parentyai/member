'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase341: internal ops snapshot job forwards targets payload', () => {
  const file = path.join(process.cwd(), 'src/routes/internal/opsSnapshotJob.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('targets: payload.targets'));
});
