'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: STEP target inputs are mapped from app composer UI to payload target', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes("const rawLimit = Number(document.getElementById('targetLimit')?.value);"));
  assert.ok(js.includes("const region = (document.getElementById('targetRegion')?.value || '').trim();"));
  assert.ok(js.includes('if (region) target.region = region;'));
  assert.ok(js.includes("target.limit = limit;"));
  assert.ok(js.includes("document.getElementById('targetRegion').value = row.target && typeof row.target.region === 'string' ? row.target.region : '';"));
});

test('phase272: planned status is exposed in composer saved filter and dictionary', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  assert.ok(html.includes('<option value="planned"'));
  assert.ok(js.includes("if (raw === 'planned') return 'planned';"));
  assert.ok(dict.includes('"ui.value.composer.status.planned"'));
  assert.ok(dict.includes('"notifications": ["draft", "active", "planned", "sent"]'));
});
