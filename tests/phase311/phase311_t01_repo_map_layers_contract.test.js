'use strict';

const assert = require('assert');
const { test } = require('node:test');

const payload = require('../../docs/REPO_AUDIT_INPUTS/repo_map_ui.json');

test('phase311: repo map exposes three layers and canonical developer statuses', () => {
  assert.ok(payload && typeof payload === 'object');
  assert.ok(payload.layers && typeof payload.layers === 'object');
  assert.ok(payload.layers.operational && typeof payload.layers.operational === 'object');
  assert.ok(payload.layers.developer && typeof payload.layers.developer === 'object');
  assert.ok(payload.layers.communication && typeof payload.layers.communication === 'object');

  const categories = payload.layers.developer.categories;
  assert.ok(Array.isArray(categories) && categories.length > 0);
  const statuses = new Set();
  categories.forEach((group) => {
    (group.items || []).forEach((item) => statuses.add(item.status));
  });
  for (const status of statuses.values()) {
    assert.ok(['planned', 'in_progress', 'completed', 'deprecated'].includes(status), `unexpected status: ${status}`);
  }
});
