'use strict';

const assert = require('assert');
const { test } = require('node:test');

const payload = require('../../docs/REPO_AUDIT_INPUTS/repo_map_ui.json');

test('phase310: repo_map_ui.json exposes required machine-readable sections', () => {
  assert.ok(payload && typeof payload === 'object');
  assert.ok(payload.meta && typeof payload.meta === 'object');
  assert.ok(typeof payload.meta.generatedAt === 'string' && payload.meta.generatedAt.length > 0);
  assert.ok(Array.isArray(payload.systemOverview.what));
  assert.ok(Array.isArray(payload.categories));
  assert.ok(payload.categories.length >= 1);
  assert.ok(payload.scenarioStepMatrix && Array.isArray(payload.scenarioStepMatrix.cells));
  assert.ok(payload.glossaryJa && payload.glossaryJa.link_registry);

  const statusSet = new Set();
  payload.categories.forEach((group) => {
    (group.items || []).forEach((item) => statusSet.add(item.status));
  });
  for (const status of statusSet.values()) {
    assert.ok(['未着手', '開発中', '実装済み', '改修中', '非推奨'].includes(status));
  }
});
