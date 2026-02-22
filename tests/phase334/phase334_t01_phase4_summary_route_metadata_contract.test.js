'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase334: phase4 summary routes include metadata fields and includeMeta option', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsOverview.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('includeMeta: true'));
  assert.ok(src.includes('dataSource'));
  assert.ok(src.includes('asOf'));
  assert.ok(src.includes('freshnessMinutes'));
});
