'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const DANGER_IDS = [
  'approve',
  'plan',
  'execute',
  'city-pack-bulletin-create',
  'vendor-edit',
  'vendor-activate',
  'vendor-disable'
];

test('phase674: dangerous static controls are marked as workbench-zone controls in app.html', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('data-workbench-zone="true"'));

  DANGER_IDS.forEach((id) => {
    const pattern = new RegExp(`<[^>]*id="${id}"[^>]*data-workbench-zone="true"[^>]*>|<[^>]*data-workbench-zone="true"[^>]*id="${id}"[^>]*>`, 'm');
    assert.match(html, pattern, `workbench-zone missing for #${id}`);
  });
});
