'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

function mapCompletion(completion) {
  if (completion === 'completed') return 'completed';
  if (completion === 'legacy') return 'deprecated';
  if (completion === 'planned') return 'planned';
  if (completion === 'in_progress') return 'in_progress';
  return 'in_progress';
}

test('phase311: feature completion maps deterministically to developer status', () => {
  const featureMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/feature_map.json', 'utf8'));
  const repoMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/repo_map_ui.json', 'utf8'));

  const byId = new Map();
  (repoMap.layers && repoMap.layers.developer && repoMap.layers.developer.categories || []).forEach((category) => {
    (category.items || []).forEach((item) => byId.set(item.id, item.status));
  });

  (featureMap.features || []).forEach((feature) => {
    const actual = byId.get(feature.feature);
    assert.ok(actual, `developer item missing for feature: ${feature.feature}`);
    assert.strictEqual(actual, mapCompletion(feature.completion), `feature status mismatch: ${feature.feature}`);
  });
});
