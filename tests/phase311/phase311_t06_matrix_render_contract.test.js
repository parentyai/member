'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase311: developer matrix render uses scenario-step cells with count and state labels', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("'/api/admin/os/notifications/list?limit=500'"));
  assert.ok(js.includes("ui.label.repoMap.matrix.notifications"));
  assert.ok(js.includes("ui.label.repoMap.matrix.states"));
  assert.ok(js.includes('function mergeNotificationMatrixFromItems'));

  const repoMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/repo_map_ui.json', 'utf8'));
  const matrix = repoMap.layers && repoMap.layers.developer && repoMap.layers.developer.scenarioStepMatrix;
  assert.ok(matrix && Array.isArray(matrix.scenarios) && matrix.scenarios.length > 0);
  assert.ok(Array.isArray(matrix.steps) && matrix.steps.length > 0);
  assert.ok(Array.isArray(matrix.cells) && matrix.cells.length > 0);
});
