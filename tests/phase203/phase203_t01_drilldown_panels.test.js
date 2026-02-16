'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function read(path) {
  return readFileSync(path, 'utf8');
}

test('phase203: ops has list/detail sections', () => {
  const ops = read('apps/admin/ops_readonly.html');
  assert.ok(ops.includes('id="ops-console-list-section"'));
  assert.ok(ops.includes('id="ops-console-detail-section"'));
});

test('phase203: monitor has drilldown detail panel', () => {
  const monitor = read('apps/admin/monitor.html');
  assert.ok(monitor.includes('id="monitor-detail"'));
  assert.ok(monitor.includes('clickable-row'));
});

test('phase203: read-model has drilldown detail panel', () => {
  const readModel = read('apps/admin/read_model.html');
  assert.ok(readModel.includes('id="read-model-detail"'));
  assert.ok(readModel.includes('clickable-row'));
});
