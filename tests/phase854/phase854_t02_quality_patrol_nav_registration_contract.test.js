'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: quality patrol nav is add-only and admin nav contract suite includes phase854', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const controlStart = html.indexOf('class="nav-group nav-group-control"');
  const developerStart = html.indexOf('class="nav-group nav-group-developer"', controlStart);
  const controlBlock = html.slice(controlStart, developerStart);

  assert.ok(controlBlock.includes('data-pane-target="quality-patrol"'));
  assert.ok(controlBlock.indexOf('data-pane-target="audit"') < controlBlock.indexOf('data-pane-target="quality-patrol"'));
  assert.ok(controlBlock.indexOf('data-pane-target="quality-patrol"') < controlBlock.indexOf('id="nav-open-settings"'));
  assert.ok(js.includes("'quality-patrol': { titleKey: 'ui.label.page.qualityPatrol'"));
  assert.ok(js.includes("'quality-patrol', 'settings'"));
  assert.ok(pkg.scripts['test:admin-nav-contract'].includes('tests/phase854/*.test.js'));
});
