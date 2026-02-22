'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase342: maintenance pane includes retention runs read-only panel', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('maintenance-retention-runs-reload'));
  assert.ok(html.includes('maintenance-retention-runs-rows'));
  assert.ok(html.includes('maintenance-retention-runs-trace'));
  assert.ok(html.includes('maintenance-open-audit'));
});
