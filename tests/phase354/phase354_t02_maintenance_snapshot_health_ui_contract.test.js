'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase354: maintenance pane contains snapshot health controls and table', () => {
  const file = path.join(process.cwd(), 'apps/admin/app.html');
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('maintenance-snapshot-health-limit'));
  assert.ok(html.includes('maintenance-snapshot-health-stale-after'));
  assert.ok(html.includes('maintenance-snapshot-health-type'));
  assert.ok(html.includes('maintenance-snapshot-health-reload'));
  assert.ok(html.includes('maintenance-snapshot-health-rows'));
});
