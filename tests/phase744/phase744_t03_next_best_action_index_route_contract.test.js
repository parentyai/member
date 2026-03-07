'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('phase744: index routes /api/admin/os/next-best-action to admin handler', () => {
  const file = path.join(process.cwd(), 'src/index.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("require('./routes/admin/nextBestAction')"));
  assert.ok(src.includes("pathname === '/api/admin/os/next-best-action'"));
  assert.ok(src.includes('await handleNextBestAction(req, res);'));
});
