'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase583: monitor route parses fallbackOnEmpty and blocks empty-only global fallback when false', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/monitorInsights.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const fallbackOnEmptyRaw = url.searchParams.get('fallbackOnEmpty');"));
  assert.ok(src.includes('const fallbackOnEmpty = parseFallbackOnEmpty(fallbackOnEmptyRaw);'));
  assert.ok(src.includes("error: 'invalid fallbackOnEmpty'"));
  assert.ok(src.includes('if (!fallbackBlocked && fallbackOnEmpty) {'));
  assert.ok(src.includes('fallbackOnEmpty,'));
});

