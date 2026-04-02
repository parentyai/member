'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase892: operator topbar first row is limited to search scope and urgent entry', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const topbarMainStart = html.indexOf('<div class="topbar-v3-main">');
  const topbarMainEnd = html.indexOf('<div class="topbar-v3-secondary">');
  const topbarMain = html.slice(topbarMainStart, topbarMainEnd);
  const topbarSecondary = html.slice(topbarMainEnd, html.indexOf('</section>', topbarMainEnd));

  assert.ok(topbarMain.includes('topbar-v3-search'));
  assert.ok(topbarMain.includes('topbar-v3-scope'));
  assert.ok(topbarMain.includes('topbar-v3-alerts'));
  assert.ok(!topbarMain.includes('v3-shell-switch-system'));
  assert.ok(!topbarMain.includes('role-switch'));

  assert.ok(topbarSecondary.includes('role-switch'));
  assert.ok(topbarSecondary.includes('id="v3-shell-switch-system"'));
  assert.ok(topbarSecondary.includes('id="v3-shell-switch-ops"'));
});
