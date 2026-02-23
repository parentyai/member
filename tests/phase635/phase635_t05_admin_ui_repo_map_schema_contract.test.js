'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { repoMapCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: repo map minimum schema validation detects broken payload', () => {
  const okPayload = {
    meta: { version: 'v1' },
    categories: [],
    systemOverview: { what: [] }
  };
  const ok = repoMapCore.validateSchemaMin(okPayload);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.errors, []);

  const broken = repoMapCore.validateSchemaMin({ meta: {} });
  assert.equal(broken.ok, false);
  assert.ok(broken.errors.includes('categories missing'));
  assert.ok(broken.errors.includes('systemOverview missing'));
});

test('phase635: repo map todo card builder maps urgency/task/why/impact', () => {
  const cards = repoMapCore.buildTodoCards({
    categories: [{
      labelJa: '運用',
      items: [{
        id: 'ops_1',
        cannotDo: ['fallback modeの統一が未完'],
        risks: ['誤判定率が増える'],
        nextActions: ['fallback modeをpane横断で統一']
      }]
    }]
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].urgency, 'high');
  assert.equal(cards[0].task, 'fallback modeをpane横断で統一');
  assert.equal(cards[0].why, 'fallback modeの統一が未完');
  assert.equal(cards[0].impact, '誤判定率が増える');
});
