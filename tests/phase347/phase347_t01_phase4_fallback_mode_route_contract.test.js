'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase347: phase4 summary routes parse fallbackMode and reject invalid values', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsOverview.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const fallbackModeRaw = url.searchParams.get('fallbackMode');"));
  assert.ok(src.includes('const fallbackMode = parseFallbackMode(fallbackModeRaw);'));
  assert.ok(src.includes("throw new Error('invalid fallbackMode')"));
  assert.ok(src.includes('fallbackMode,'));
});
