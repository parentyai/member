'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: quality patrol audience switch keeps operator and human views separate', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('<option value="operator">operator</option>'));
  assert.ok(html.includes('<option value="human">human</option>'));
  assert.ok(js.includes('function resolveQualityPatrolAudience(value)'));
  assert.ok(js.includes('function buildQualityPatrolAudienceLabel(value)'));
  assert.ok(js.includes("document.getElementById('quality-patrol-audience-select')?.addEventListener('change'"));
  assert.ok(js.includes("if (audience !== 'operator')"));
  assert.ok(js.includes('human view では trace の内部識別子を縮約表示します。'));
});
