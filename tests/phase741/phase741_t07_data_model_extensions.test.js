'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeStepRule } = require('../../src/repos/firestore/stepRulesRepo');
const { normalizeTaskContent } = require('../../src/repos/firestore/taskContentsRepo');
const { normalizeCityPackContentPatch } = require('../../src/repos/firestore/cityPacksRepo');

test('phase741: normalizeStepRule accepts category/time/vendor fields add-only', () => {
  const prevFlag = process.env.ENABLE_TASK_CATEGORY_SYSTEM_V1;
  process.env.ENABLE_TASK_CATEGORY_SYSTEM_V1 = '1';
  try {
    const row = normalizeStepRule('bank_open', {
      ruleId: 'bank_open',
      stepKey: 'bank_open',
      trigger: { eventKey: 'assignment.created', source: 'system' },
      leadTime: { kind: 'after', days: 7 },
      category: 'BANKING',
      estimatedTimeMin: 20,
      estimatedTimeMax: 40,
      recommendedVendorLinkIds: ['vendor_a', 'vendor_b']
    });
    assert.ok(row);
    assert.equal(row.category, 'BANKING');
    assert.equal(row.estimatedTimeMin, 20);
    assert.equal(row.estimatedTimeMax, 40);
    assert.deepEqual(row.recommendedVendorLinkIds, ['vendor_a', 'vendor_b']);
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_CATEGORY_SYSTEM_V1;
    else process.env.ENABLE_TASK_CATEGORY_SYSTEM_V1 = prevFlag;
  }
});

test('phase741: normalizeTaskContent keeps checklist/checklistItems compatibility', () => {
  const row = normalizeTaskContent('bank_open', {
    taskKey: 'bank_open',
    title: '銀行口座を作る',
    category: 'BANKING',
    dependencies: ['immigration_complete'],
    checklist: ['パスポート準備', 'SSN確認'],
    recommendedVendorLinkIds: ['vendor_bank'],
    archived: true
  });
  assert.ok(row);
  assert.equal(row.category, 'BANKING');
  assert.deepEqual(row.dependencies, ['immigration_complete']);
  assert.deepEqual(row.checklist, ['パスポート準備', 'SSN確認']);
  assert.equal(row.checklistItems.length, 2);
  assert.equal(row.recommendedVendorLinkIds[0], 'vendor_bank');
  assert.equal(row.archived, true);
});

test('phase741: normalizeCityPackContentPatch accepts city_packs.recommendedTasks', () => {
  const row = normalizeCityPackContentPatch({
    recommendedTasks: [
      { ruleId: 'school_enrollment', module: 'schools', priorityBoost: 20 },
      { ruleId: 'housing_search', module: 'housing', priorityBoost: -5 }
    ]
  });
  assert.ok(row);
  assert.equal(Array.isArray(row.recommendedTasks), true);
  assert.equal(row.recommendedTasks.length, 2);
  assert.equal(row.recommendedTasks[0].ruleId, 'school_enrollment');
});
