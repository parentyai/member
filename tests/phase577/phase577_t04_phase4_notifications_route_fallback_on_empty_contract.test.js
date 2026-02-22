'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase577: phase4 notifications summary route parses fallbackOnEmpty', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsOverview.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const fallbackOnEmptyRaw = url.searchParams.get('fallbackOnEmpty');"));
  assert.ok(src.includes('const fallbackOnEmpty = parseFallbackOnEmpty(fallbackOnEmptyRaw);'));
  assert.ok(src.includes('if (fallbackOnEmptyRaw && fallbackOnEmpty === null)'));
  assert.ok(src.includes("throw new Error('invalid fallbackOnEmpty')"));
  assert.ok(src.includes('fallbackOnEmpty,'));
});

