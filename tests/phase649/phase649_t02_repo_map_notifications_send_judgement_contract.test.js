'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function findFeature(repoMap, featureId) {
  const categories = Array.isArray(repoMap && repoMap.categories) ? repoMap.categories : [];
  for (const category of categories) {
    const items = Array.isArray(category && category.items) ? category.items : [];
    for (const item of items) {
      if (item && item.id === featureId) return { category, item };
    }
  }
  return null;
}

test('phase649: notifications feature card describes send judgement checks (kill switch / CTA / link / warn / recipients)', () => {
  const repoMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/repo_map_ui.json', 'utf8'));
  const found = findFeature(repoMap, 'notifications');
  assert.ok(found, 'notifications feature not found in repo_map_ui.json');
  assert.equal(found.category.key, 'notifications');

  const canDo = (found.item.canDo || []).join(' ');
  const cannotDo = (found.item.cannotDo || []).join(' ');

  assert.ok(canDo.includes('Kill Switch'), 'canDo should mention Kill Switch');
  assert.ok(cannotDo.includes('CTA'), 'cannotDo should mention CTA');
  assert.ok(cannotDo.includes('LinkRegistry'), 'cannotDo should mention LinkRegistry');
  assert.ok(cannotDo.includes('直URL'), 'cannotDo should mention direct URL block');
  assert.ok(cannotDo.includes('WARN'), 'cannotDo should mention WARN link block');
  assert.ok(cannotDo.includes('配信対象'), 'cannotDo should mention recipients/target');

  assert.ok(!canDo.includes('管理画面とAPIから利用できます'), 'canDo should not keep old generic phrasing');
});

