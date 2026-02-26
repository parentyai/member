'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase261: /admin/app uses decision cards and removes summary header blocks', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(!html.includes('summary-header'), 'summary-header should be removed');
  assert.ok(!html.includes('今日の流れ'), 'flow explanation should be removed');

  [
    'home',
    'composer',
    'monitor',
    'emergency-layer',
    'errors',
    'read-model',
    'vendors',
    'city-pack'
  ].forEach((pane) => {
    assert.ok(html.includes(`id="${pane}-decision-card"`), `missing decision card: ${pane}`);
    assert.ok(html.includes(`id="${pane}-pane-details"`), `missing details panel: ${pane}`);
  });
});
