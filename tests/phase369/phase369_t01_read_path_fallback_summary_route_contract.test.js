'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase369: read path fallback summary route exposes grouped and recent rows', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/readPathFallbackSummary.js'), 'utf8');
  assert.ok(src.includes('read_path.fallback.summary.view'));
  assert.ok(src.includes('READ_PATH_FALLBACK_ACTIONS'));
  assert.ok(src.includes('windowHours'));
  assert.ok(src.includes('items,'));
  assert.ok(src.includes('recent'));
});
