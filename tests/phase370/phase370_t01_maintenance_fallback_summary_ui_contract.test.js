'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase370: maintenance pane contains fallback summary controls and table', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'apps/admin/app.html'), 'utf8');
  assert.ok(html.includes('maintenance-fallback-summary-limit'));
  assert.ok(html.includes('maintenance-fallback-summary-window'));
  assert.ok(html.includes('maintenance-fallback-summary-reload'));
  assert.ok(html.includes('maintenance-fallback-summary-rows'));
});
