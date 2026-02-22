'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase337: phase5 summary routes include metadata fields', () => {
  const file = path.join(process.cwd(), 'src/routes/phase5Ops.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes('includeMeta: true'));
  assert.ok(src.includes('dataSource: meta && meta.dataSource ? meta.dataSource : null'));
  assert.ok(src.includes('freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, \'freshnessMinutes\') ? meta.freshnessMinutes : null'));
});
