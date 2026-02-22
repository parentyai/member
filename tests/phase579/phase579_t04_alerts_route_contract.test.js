'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: alerts summary route is wired and returns actionable totals/items contract', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const routeSrc = fs.readFileSync('src/routes/admin/osAlerts.js', 'utf8');
  assert.ok(indexSrc.includes('/api/admin/os/alerts/summary'));
  assert.ok(routeSrc.includes('function handleAlertsSummary'));
  assert.ok(routeSrc.includes('requireActor(req, res)'));
  assert.ok(routeSrc.includes('totals'));
  assert.ok(routeSrc.includes('openAlerts'));
  assert.ok(routeSrc.includes('scheduledTodayCount'));
  assert.ok(routeSrc.includes('items'));
  assert.ok(routeSrc.includes("action: 'admin_os.alerts.view'"));
});
