'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase311: matrix render uses entity-first blocks with canonical step/type/title ordering', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("'/api/admin/os/notifications/list?limit=500'"));
  assert.ok(js.includes("'/admin/read-model/notifications?limit=500'"));
  assert.ok(js.includes("const REPO_MAP_MATRIX_TYPE_ORDER = Object.freeze(['STEP', 'GENERAL', 'ANNOUNCEMENT', 'VENDOR', 'AB'])"));
  assert.ok(js.includes('function sortRepoMapMatrixSteps(stepKeys)'));
  assert.ok(js.includes('entries.sort(compareRepoMapMatrixEntries);'));
  assert.ok(js.includes('trigger/order: UNKNOWN'));
  assert.ok(js.includes('planHash: ${entry && entry.planHash ? entry.planHash : \'-\'}'));
  assert.ok(js.includes('function mergeNotificationMatrixFromItems'));
  assert.ok(js.includes("headId: 'composer-matrix-head'"));
  assert.ok(js.includes("bodyId: 'composer-matrix-rows'"));
  assert.ok(js.includes('state.composerScenarioStepMatrix = matrix;'));
  assert.ok(js.includes('renderComposerMatrix(matrix);'));

  const repoMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/repo_map_ui.json', 'utf8'));
  const matrix = repoMap.layers && repoMap.layers.developer && repoMap.layers.developer.scenarioStepMatrix;
  assert.ok(matrix && Array.isArray(matrix.scenarios) && matrix.scenarios.length > 0);
  assert.ok(Array.isArray(matrix.steps) && matrix.steps.length > 0);
  assert.ok(Array.isArray(matrix.cells) && matrix.cells.length > 0);
});
