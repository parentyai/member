'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: page header keeps pane-purpose subtitle visible for primary work surfaces', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="page-subtitle"'), 'page subtitle element missing');
  assert.ok(js.includes("subtitleEl.setAttribute('data-pane-purpose', paneKey);"));
  assert.ok(!js.includes("paneKey === 'composer'"), 'pane-specific subtitle blanking should be removed');
  assert.ok(js.includes("'ops-feature-catalog': { titleKey: 'ui.label.page.featureCatalog', subtitleKey: 'ui.desc.page.featureCatalog' }"));
  assert.ok(js.includes("'ops-system-health': { titleKey: 'ui.label.page.systemHealth', subtitleKey: 'ui.desc.page.systemHealth' }"));
  assert.ok(js.includes("llm: { titleKey: 'ui.label.page.llm', subtitleKey: 'ui.desc.page.llm' }"));
});
