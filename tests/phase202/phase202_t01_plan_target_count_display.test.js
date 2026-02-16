'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function read(path) {
  return readFileSync(path, 'utf8');
}

test('phase202: composer shows plan target count label', () => {
  const composer = read('apps/admin/composer.html');
  assert.ok(composer.includes('id="planTargetCount"'));
  assert.ok(composer.includes('対象人数（plan）'));
});

test('phase202: ops segment plan note includes count', () => {
  const ops = read('apps/admin/ops_readonly.html');
  assert.ok(ops.includes('id="segment-plan-note"'));
  assert.ok(ops.includes('count:'));
});
