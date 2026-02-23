'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: notifications saved list has category/scenario/step sortable columns', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('data-composer-sort-key="notificationCategory"'));
  assert.ok(html.includes('data-composer-sort-key="scenarioKey"'));
  assert.ok(html.includes('data-composer-sort-key="stepKey"'));
  assert.ok(html.includes('data-composer-sort-key="targetCount"'));
  assert.ok(html.includes('data-composer-sort-key="ctr"'));
});
