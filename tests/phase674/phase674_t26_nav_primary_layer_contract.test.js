'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: left nav primary groups expose layer labels and keep one primary entry per pane', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  const dashboardStart = html.indexOf('class="nav-group nav-group-dashboard"');
  const developerStart = html.indexOf('class="nav-group nav-group-developer"', dashboardStart);
  assert.ok(dashboardStart >= 0 && developerStart > dashboardStart, 'primary nav region missing');

  const primaryBlock = html.slice(dashboardStart, developerStart);
  assert.ok(primaryBlock.includes('Dashboard（判断）'));
  assert.ok(primaryBlock.includes('Workbench（実行）'));
  assert.ok(primaryBlock.includes('Data / Evidence / System'));

  const paneMatches = Array.from(primaryBlock.matchAll(/data-pane-target="([^"]+)"/g)).map((entry) => entry[1]);
  const counts = paneMatches.reduce((acc, pane) => {
    acc[pane] = (acc[pane] || 0) + 1;
    return acc;
  }, Object.create(null));

  assert.equal(counts.monitor, 1, 'monitor should have one primary nav entry');
  Object.keys(counts).forEach((pane) => {
    assert.equal(counts[pane], 1, `duplicate primary nav entry found for pane=${pane}`);
  });
});

test('phase674: control group keeps data/evidence/system layering and settings ordering contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const controlStart = html.indexOf('class="nav-group nav-group-control"');
  const developerStart = html.indexOf('class="nav-group nav-group-developer"', controlStart);
  assert.ok(controlStart >= 0 && developerStart > controlStart, 'control nav group missing');

  const controlBlock = html.slice(controlStart, developerStart);
  assert.ok(controlBlock.includes('nav-layer-label">Data</div>'));
  assert.ok(controlBlock.includes('nav-layer-label">Evidence</div>'));
  assert.ok(controlBlock.includes('nav-layer-label">System</div>'));
  assert.ok(controlBlock.includes('data-pane-target="read-model"'));
  assert.ok(controlBlock.includes('data-pane-target="alerts"'));
  assert.ok(controlBlock.includes('data-pane-target="errors"'));
  assert.ok(controlBlock.includes('id="nav-open-settings"'));
  assert.ok(controlBlock.includes('data-pane-target="ops-feature-catalog"'));
  assert.ok(controlBlock.includes('data-pane-target="ops-system-health"'));
  assert.ok(controlBlock.indexOf('data-pane-target="errors"') < controlBlock.indexOf('id="nav-open-settings"'));
});
