'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase369: index routes /api/admin/read-path-fallback-summary', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/index.js'), 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/read-path-fallback-summary'"));
  assert.ok(src.includes('handleReadPathFallbackSummary'));
});
