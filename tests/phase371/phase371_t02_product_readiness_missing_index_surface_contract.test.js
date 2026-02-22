'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase371: product readiness checks include missing-index surface block', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('missingIndexSurface: {'));
  assert.ok(src.includes('missing_index_surface_unavailable'));
  assert.ok(src.includes('missing_index_surface_over_budget'));
  assert.ok(src.includes('surfaceCount'));
  assert.ok(src.includes('pointCount'));
  assert.ok(src.includes('MISSING_INDEX_SURFACE_PATH'));
});
