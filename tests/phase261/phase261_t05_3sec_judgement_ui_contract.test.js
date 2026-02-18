'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase261: initial pane contract keeps 3-action decision layout', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const requiredActionIds = [
    'composer-action-edit',
    'composer-action-activate',
    'composer-action-disable',
    'monitor-action-edit',
    'monitor-action-activate',
    'monitor-action-disable',
    'errors-action-edit',
    'errors-action-activate',
    'errors-action-disable',
    'read-model-action-edit',
    'read-model-action-activate',
    'read-model-action-disable',
    'vendors-action-edit',
    'vendors-action-activate',
    'vendors-action-disable',
    'city-pack-action-edit',
    'city-pack-action-activate',
    'city-pack-action-disable'
  ];

  requiredActionIds.forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `missing decision action button: ${id}`);
  });

  assert.ok(!html.includes('状態サマリー'));
});
