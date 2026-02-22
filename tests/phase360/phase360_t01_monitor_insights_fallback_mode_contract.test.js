'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase360: monitor insights route accepts fallbackMode and blocks listAll fallback', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/monitorInsights.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const fallbackModeRaw = url.searchParams.get(\'fallbackMode\');'));
  assert.ok(src.includes('const fallbackMode = resolveFallbackMode(fallbackModeRaw);'));
  assert.ok(src.includes('const fallbackBlocked = fallbackMode === \'block\';'));
  assert.ok(src.includes('if (!all.length) {'));
  assert.ok(
    src.includes('if (!fallbackBlocked) {') ||
      src.includes('if (!fallbackBlocked && fallbackOnEmpty) {')
  );
  assert.ok(src.includes("dataSource = 'not_available';"));
  assert.ok(src.includes("note = 'NOT AVAILABLE';"));
});
